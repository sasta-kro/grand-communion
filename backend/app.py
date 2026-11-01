import asyncio
from contextlib import asynccontextmanager
import fcntl
import json
import os
from pathlib import Path
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from .models import (
    Settings,
    Provider,
    Persona,
    Scenario,
    SessionCreate,
    Injection,
    RecapInput,
    SnapshotInput,
    CastMember,
)
from .store import Store, encode, uid, now
from .provider import Credentials
from .engine import Engine, public_message
from .seed import seed

ROOT = Path(__file__).resolve().parents[1]


def create_app(data_dir=None):
    @asynccontextmanager
    async def lifespan(app):
        path = Path(data_dir or os.environ.get("COMMUNION_DATA", ROOT / "data"))
        path.mkdir(parents=True, exist_ok=True)
        lock = (path / "server.lock").open("a")
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock.close()
            raise RuntimeError(
                "This data directory already has a Communion worker. Run one server worker."
            )
        store = Store(path)
        seed(store)
        credentials = Credentials(ROOT, path)
        engine = Engine(store, credentials)
        app.state.store, app.state.engine, app.state.credentials = (
            store,
            engine,
            credentials,
        )
        app.state.started = now()
        app.state.jobs = {}
        await engine.boot()
        try:
            yield
        finally:
            await engine.close()
            store.db.close()
            fcntl.flock(lock, fcntl.LOCK_UN)
            lock.close()

    app = FastAPI(title="Communion", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"]
    )

    @app.exception_handler(ValidationError)
    async def validation_error(request, error):
        detail = "; ".join(
            ".".join(str(x) for x in e["loc"]) + ": " + e["msg"]
            for e in error.errors(include_input=False, include_url=False)
        )
        return JSONResponse(status_code=422, content={"detail": detail})

    def state():
        return app.state.store, app.state.engine

    def session_or_404(id):
        session = app.state.store.session(id)
        if not session:
            raise HTTPException(404, "Session not found")
        return session

    def profiles():
        values = [
            Provider.model_validate(p) for p in app.state.store.entities("providers")
        ]
        return [
            {
                **p.model_dump(),
                "configured": p.protocol != "openai"
                or not p.requires_key
                or bool(app.state.credentials.get(p)),
            }
            for p in values
        ]

    def sessions():
        store, _ = state()
        rows = store.query(
            "SELECT id,name,status,created,updated FROM sessions ORDER BY updated DESC"
        )
        for row in rows:
            row["message_count"] = store.one(
                "SELECT COUNT(*) AS n FROM messages WHERE session_id=?", (row["id"],)
            )["n"]
            row["character_count"] = store.one(
                "SELECT COUNT(*) AS n FROM characters WHERE session_id=?", (row["id"],)
            )["n"]
        return rows

    @app.get("/api/health")
    async def health():
        return {
            "status": "ok",
            "uptime": now() - app.state.started,
            "active_requests": app.state.engine.gateway.limiter.active,
            "running_sessions": len(app.state.engine.runtimes),
        }

    @app.get("/api/bootstrap")
    async def bootstrap():
        store, engine = state()
        return {
            "settings": engine.settings().model_dump(),
            "providers": profiles(),
            "personas": store.entities("personas"),
            "scenarios": store.entities("scenarios"),
            "sessions": sessions(),
        }

    @app.put("/api/settings")
    async def save_settings(value: Settings):
        app.state.store.set_setting("settings", value.model_dump())
        return value

    @app.put("/api/providers/{id}")
    async def save_provider(id: str, request: Request):
        value = await request.json()
        secret = value.pop("api_key", None)
        profile = Provider.model_validate({**value, "id": id})
        if secret:
            app.state.credentials.set(id, secret)
        app.state.store.put_entity("providers", profile.model_dump())
        return next(p for p in profiles() if p["id"] == id)

    @app.put("/api/personas/{id}")
    async def save_persona(id: str, value: Persona):
        return app.state.store.put_entity("personas", {**value.model_dump(), "id": id})

    @app.put("/api/scenarios/{id}")
    async def save_scenario(id: str, value: Scenario):
        return app.state.store.put_entity("scenarios", {**value.model_dump(), "id": id})

    @app.get("/api/sessions")
    async def list_sessions():
        return sessions()

    @app.post("/api/sessions")
    async def create_session(value: SessionCreate):
        store, engine = state()
        scenario = store.entity("scenarios", value.scenario_id)
        if not scenario:
            raise HTTPException(404, "Scenario not found")
        Settings.model_validate({**engine.settings().model_dump(), **value.config})
        id = store.create_session(
            scenario, value.name, value.config, store.entities("personas")
        )
        return {"id": id}

    @app.get("/api/sessions/{id}")
    async def get_session(id: str):
        store, engine = state()
        session = session_or_404(id)
        chars = store.characters(id)
        for char in chars:
            char["memory"] = store.memory(char)
            char["memory_checkpoints"] = len(
                list(
                    (
                        store.root
                        / "sessions"
                        / id
                        / "characters"
                        / char["id"]
                        / "checkpoints"
                    ).glob("*.md")
                )
            )
        latest = store.query(
            "SELECT * FROM messages WHERE session_id=? ORDER BY id DESC LIMIT 200",
            (id,),
        )
        latest.reverse()
        for m in latest:
            m["addressees"] = json.loads(m["addressees"])
            m.pop("controller", None)
        return {
            **session,
            "characters": chars,
            "messages": latest,
            "cutoff": store.cutoff(id),
            "event_cursor": store.one(
                "SELECT COALESCE(MAX(id),0) AS id FROM events WHERE session_id=?", (id,)
            )["id"],
            "settings": engine.settings(session).model_dump(),
        }

    @app.get("/api/sessions/{id}/messages")
    async def messages(
        id: str, after: int = 0, before: int | None = None, limit: int = 200
    ):
        session_or_404(id)
        if before is not None and not after:
            rows = app.state.store.query(
                "SELECT * FROM messages WHERE session_id=? AND id<=? ORDER BY id DESC LIMIT ?",
                (id, before, min(1000, max(1, limit))),
            )
            rows.reverse()
            for m in rows:
                m["addressees"] = json.loads(m["addressees"])
        else:
            rows = app.state.store.messages(id, after, before, min(1000, max(1, limit)))
        for m in rows:
            m.pop("controller", None)
        return rows

    @app.post("/api/sessions/{id}/start")
    async def start(id: str):
        session_or_404(id)
        try:
            await app.state.engine.start(id)
        except ValueError as error:
            raise HTTPException(400, str(error))
        return {"status": "running"}

    @app.post("/api/sessions/{id}/pause")
    async def pause(id: str):
        session_or_404(id)
        await app.state.engine.pause(id)
        return {"status": "paused"}

    @app.put("/api/sessions/{id}/config")
    async def session_config(id: str, request: Request):
        session = session_or_404(id)
        values = await request.json()
        if not isinstance(values, dict):
            raise HTTPException(400, "Session settings must be an object")
        validated = Settings.model_validate(
            {**app.state.engine.settings().model_dump(), **values}
        )
        overrides = {
            k: getattr(validated, k)
            for k in values
            if k in Settings.model_fields and k != "speech_rules"
        }
        running = session["status"] == "running"
        if running:
            await app.state.engine.pause(id, "settings_changed")
        app.state.store.execute(
            "UPDATE sessions SET config=? WHERE id=?", (encode(overrides), id)
        )
        if running:
            await app.state.engine.start(id)
        effective = app.state.engine.settings({**session, "config": overrides})
        return {"settings": effective.model_dump(), "overrides": overrides}

    @app.put("/api/sessions/{id}/characters/{char_id}")
    async def update_character(id: str, char_id: str, request: Request):
        session = session_or_404(id)
        store, engine = state()
        char = store.character(char_id)
        if not char or char["session_id"] != id:
            raise HTTPException(404, "Character not found")
        value = await request.json()
        config = CastMember.model_validate(value).model_dump()
        config["persona"] = str(value.get("persona", char.get("persona", "")))
        running = session["status"] == "running"
        if running:
            await engine.pause(id, "cast_changed")
        store.execute(
            "UPDATE characters SET body=? WHERE id=?", (encode(config), char_id)
        )
        if running:
            await engine.start(id)
        return {"ok": True}

    @app.post("/api/sessions/{id}/characters")
    async def add_character(id: str, request: Request):
        session = session_or_404(id)
        store, engine = state()
        raw = await request.json()
        value = CastMember.model_validate(raw)
        if len(store.characters(id)) >= 32:
            raise HTTPException(
                400, "This prototype supports up to 32 characters per scene"
            )
        running = session["status"] == "running"
        if running:
            await engine.pause(id, "cast_changed")
        body = value.model_dump()
        persona = store.entity("personas", value.persona_id)
        body["persona"] = str(raw.get("persona", persona["prompt"] if persona else ""))
        char_id = uid()
        cutoff = store.cutoff(id)
        store.execute(
            "INSERT INTO characters(id,session_id,body,memory_cutoff,observed) VALUES(?,?,?,?,?)",
            (char_id, id, encode(body), cutoff, cutoff),
        )
        store.ensure_memory(store.character(char_id))
        store.log(
            id,
            "INFO",
            f"{value.name} joined the scene. Earlier speech is outside their observation window.",
            char_id,
        )
        if running:
            await engine.start(id)
        return {"id": char_id}

    @app.post("/api/sessions/{id}/characters/{char_id}/compact")
    async def compact(id: str, char_id: str):
        session = session_or_404(id)
        if session["status"] == "running":
            raise HTTPException(
                409, "Pause this session before manually compacting memory"
            )
        char = app.state.store.character(char_id)
        if not char or char["session_id"] != id:
            raise HTTPException(404, "Character not found")
        try:
            await app.state.engine.compact(
                session, char, app.state.store.cutoff(id), True
            )
        except Exception as error:
            raise HTTPException(400, app.state.credentials.redact(str(error))[:400])
        return {"ok": True}

    @app.post("/api/sessions/{id}/messages")
    async def inject(id: str, value: Injection):
        try:
            await app.state.engine.inject(session_or_404(id), value)
        except ValueError as error:
            raise HTTPException(400, str(error))
        return {"queued": True}

    @app.get("/api/sessions/{id}/requests")
    async def requests(id: str, limit: int = 100):
        session_or_404(id)
        rows = app.state.store.requests(id, min(1000, max(1, limit)))
        for row in rows:
            row.pop("reasoning", None)
        return rows

    @app.get("/api/sessions/{id}/requests/{request_id}")
    async def request_detail(id: str, request_id: str):
        session_or_404(id)
        row = app.state.store.one(
            "SELECT * FROM requests WHERE session_id=? AND id=?", (id, request_id)
        )
        if not row:
            raise HTTPException(404, "Request not found")
        row["metrics"] = json.loads(row["metrics"])
        return row

    @app.get("/api/sessions/{id}/logs")
    async def logs(id: str, level: str = "", character_id: str = "", limit: int = 200):
        session_or_404(id)
        sql = "SELECT * FROM logs WHERE session_id=?"
        args = [id]
        if level:
            sql += " AND level=?"
            args.append(level)
        if character_id:
            sql += " AND character_id=?"
            args.append(character_id)
        sql += " ORDER BY id DESC LIMIT ?"
        args.append(min(1000, max(1, limit)))
        return app.state.store.query(sql, args)

    @app.get("/api/sessions/{id}/recaps")
    async def recaps(id: str):
        session_or_404(id)
        rows = app.state.store.query(
            "SELECT * FROM recaps WHERE session_id=? ORDER BY created DESC LIMIT 50",
            (id,),
        )
        for r in rows:
            r["body"] = json.loads(r["body"])
        return rows

    @app.post("/api/sessions/{id}/recaps")
    async def recap(id: str, value: RecapInput):
        session_or_404(id)
        if app.state.jobs.get(id):
            raise HTTPException(409, "A narrator report is already being prepared")

        async def work():
            result = {}
            try:
                await app.state.engine.recap(id, value.after_id, value.scope)
            except Exception as error:
                result["error"] = (
                    "Narrator: " + app.state.credentials.redact(str(error))[:400]
                )
                app.state.store.log(id, "ERROR", result["error"])
            finally:
                app.state.jobs.pop(id, None)
                app.state.store.event(id, "recap_finished", result)

        task = asyncio.create_task(work())
        app.state.jobs[id] = task
        app.state.engine.report_tasks.add(task)
        task.add_done_callback(app.state.engine.report_tasks.discard)
        return {"status": "queued"}

    @app.get("/api/sessions/{id}/saves")
    async def saves(id: str):
        session_or_404(id)
        return app.state.store.query(
            "SELECT id,session_id,name,created FROM snapshots WHERE session_id=? ORDER BY created DESC",
            (id,),
        )

    @app.post("/api/sessions/{id}/saves")
    async def save(id: str, value: SnapshotInput):
        session_or_404(id)
        return {"id": app.state.store.snapshot(id, value.name)}

    @app.get("/api/saves/{id}")
    async def download_save(id: str):
        row = app.state.store.one("SELECT body FROM snapshots WHERE id=?", (id,))
        if not row:
            raise HTTPException(404, "Save not found")
        return JSONResponse(
            json.loads(row["body"]),
            headers={
                "Content-Disposition": 'attachment; filename="communion-save.json"'
            },
        )

    @app.post("/api/saves/{id}/load")
    async def load(id: str):
        row = app.state.store.one("SELECT body FROM snapshots WHERE id=?", (id,))
        if not row:
            raise HTTPException(404, "Save not found")
        return {"id": app.state.store.restore(json.loads(row["body"]))}

    @app.post("/api/saves/import")
    async def import_save(request: Request):
        data = await request.body()
        if len(data) > 20_000_000:
            raise HTTPException(400, "Save is too large")
        try:
            body = json.loads(data)
            Scenario.model_validate(body["session"]["scenario"])
            Settings.model_validate(
                {
                    **app.state.engine.settings().model_dump(),
                    **body["session"]["config"],
                }
            )
            for char in body["characters"]:
                CastMember.model_validate(char)
            body["providers"] = [
                Provider.model_validate(p).model_dump()
                for p in body.get("providers", [])
            ]
            return {"id": app.state.store.restore(body)}
        except (KeyError, ValueError, TypeError) as error:
            raise HTTPException(400, "Invalid or unsupported save file") from None

    @app.get("/api/sessions/{id}/events")
    async def events(id: str, request: Request, after: int = 0):
        session_or_404(id)

        async def stream():
            cursor = int(request.headers.get("last-event-id") or after)
            while not await request.is_disconnected():
                rows = app.state.store.query(
                    "SELECT * FROM events WHERE session_id=? AND id>? ORDER BY id LIMIT 200",
                    (id, cursor),
                )
                for row in rows:
                    cursor = row["id"]
                    row["body"] = json.loads(row["body"])
                    yield f"id: {cursor}\nevent: update\ndata: {encode(row)}\n\n"
                if not rows:
                    yield ": heartbeat\n\n"
                    await asyncio.sleep(1)

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    frontend = ROOT / "frontend" / "dist"
    if frontend.exists():
        app.mount("/assets", StaticFiles(directory=frontend / "assets"), name="assets")

    @app.get("/{path:path}")
    async def ui(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Endpoint not found")
        if frontend.exists():
            return FileResponse(frontend / "index.html")
        return JSONResponse(
            {
                "message": "Build the interface with npm run build in frontend, or use Vite on port 5173."
            }
        )

    return app


app = create_app()

"""Library lifecycle and historical branches, separate from the simulation loop."""

import asyncio
import json
import shutil

from fastapi import APIRouter, HTTPException, Query

from .models import ArchiveInput, ForkInput, RenameInput
from .store import encode, now, uid


def fork_source(store, source, point):
    latest = store.cutoff(source["id"])
    cutoff = latest if point is None else point
    message = None
    state = None
    if cutoff:
        message = store.one(
            "SELECT * FROM messages WHERE session_id=? AND id=?", (source["id"], cutoff)
        )
        if not message:
            raise ValueError("Fork point must be a message in this session")
        if point is not None and message["state_id"]:
            state = store.one(
                "SELECT * FROM state_history WHERE session_id=? AND id=?",
                (source["id"], message["state_id"]),
            )
    elif latest:
        first = store.one(
            "SELECT state_id FROM messages WHERE session_id=? ORDER BY id LIMIT 1",
            (source["id"],),
        )
        if first and first["state_id"]:
            state = store.one(
                "SELECT * FROM state_history WHERE id=? AND session_id=?",
                (first["state_id"], source["id"]),
            )
    warnings = []
    history = []
    if state:
        body = json.loads(state["body"])
        history = [
            {"id": row["id"], "cutoff": row["cutoff"], **json.loads(row["body"])}
            for row in store.query(
                "SELECT * FROM state_history WHERE session_id=? AND id<=? ORDER BY id",
                (source["id"], state["id"]),
            )
        ]
    elif point is None or cutoff == latest:
        body = store.state_body(source["id"])
        history = [
            {"id": row["id"], "cutoff": row["cutoff"], **json.loads(row["body"])}
            for row in store.query(
                "SELECT * FROM state_history WHERE session_id=? ORDER BY id",
                (source["id"],),
            )
        ]
    else:
        candidates = []
        for row in store.query(
            "SELECT body FROM snapshots WHERE session_id=?", (source["id"],)
        ):
            saved = json.loads(row["body"])
            boundary = max((m["id"] for m in saved["messages"]), default=0)
            # A save at the same message may contain profile edits made afterward.
            if boundary < cutoff or boundary == cutoff == 0:
                candidates.append((boundary, saved))
        if candidates:
            _, body = max(candidates, key=lambda candidate: candidate[0])
            warnings.append("earlier_save")
        else:
            if not source["scenario"]["cast"]:
                raise ValueError(
                    "This older session has no recorded starting cast. Fork its current state or load an earlier checkpoint."
                )
            body = {"session": {**source, "config": {}}, "characters": []}
            current = store.characters(source["id"])
            for member in source["scenario"]["cast"]:
                original = next(
                    (char for char in current if char["name"] == member["name"]), None
                )
                author = store.one(
                    "SELECT author_id FROM messages WHERE session_id=? AND name=? AND author_id IS NOT NULL ORDER BY id LIMIT 1",
                    (source["id"], member["name"]),
                )
                body["characters"].append(
                    {
                        **member,
                        "id": author["author_id"]
                        if author
                        else original["id"]
                        if original
                        else uid(),
                        "persona": member.get("persona") or "",
                        "memory": f"I am {member['name']}. My role here is {member['role']}.\n\n{member['background']}",
                        "memory_cutoff": 0,
                        "observed": 0,
                    }
                )
            warnings.append("opening_setup")
    return cutoff, message, body, history, warnings


def fork_session(store, source, value):
    cutoff, _, body, history, warnings = fork_source(store, source, value.message_id)
    if value.expected_warnings is not None and warnings != value.expected_warnings:
        raise ValueError(
            "Historical state availability changed. Review the fork preview again."
        )
    payload = {
        "version": 1,
        "session": {**body["session"], "name": source["name"]},
        "characters": body["characters"],
        "messages": store.messages(source["id"], before=cutoff),
        "history": history,
        "providers": store.entities("providers"),
    }
    id = store.restore(payload)
    name = value.name.strip() or source["name"][:130] + " (fork)"
    store.execute("UPDATE sessions SET name=? WHERE id=?", (name, id))
    store.execute(
        "INSERT INTO item_state(kind,id,metadata) VALUES('sessions',?,?)",
        (
            id,
            encode(
                {"forked_from": source["id"], "forked_at": cutoff, "warnings": warnings}
            ),
        ),
    )
    store.record_state(id)
    return {"id": id, "source_message_id": cutoff, "warnings": warnings}


def delete_session(store, id):
    folder = store.root / "sessions" / id
    if folder.resolve().parent != (store.root / "sessions").resolve():
        raise ValueError("Invalid session storage path")
    staging = store.root / "deleting" / uid()
    moved = folder.exists()
    if moved:
        staging.parent.mkdir(exist_ok=True)
        folder.replace(staging)
    try:
        with store.db:
            for table in (
                "characters",
                "messages",
                "requests",
                "events",
                "logs",
                "recaps",
                "snapshots",
                "state_history",
            ):
                store.db.execute(f"DELETE FROM {table} WHERE session_id=?", (id,))
            store.db.execute(
                "DELETE FROM item_state WHERE kind='sessions' AND id=?", (id,)
            )
            store.db.execute("DELETE FROM sessions WHERE id=?", (id,))
    except Exception:
        if moved:
            staging.replace(folder)
        raise
    if moved:
        shutil.rmtree(staging)


def lifecycle_router(app):
    router = APIRouter(prefix="/api")

    def session(id):
        row = app.state.store.session(id)
        if not row:
            raise HTTPException(404, "Session not found")
        return row

    async def stop(id, reason="session_archived"):
        await app.state.engine.pause(id, reason)
        task = app.state.jobs.get(id)
        if task:
            task.cancel(reason)
            await asyncio.gather(task, return_exceptions=True)
        app.state.engine.recap_locks.pop(id, None)

    @router.get("/library/{kind}")
    async def library(kind: str, archived: bool = False):
        if kind not in ("scenarios", "personas"):
            raise HTTPException(404, "Library not found")
        return app.state.store.library(kind, archived)

    @router.post("/sessions/{id}/archive")
    async def archive_session(id: str, value: ArchiveInput):
        session(id)
        if value.archived:
            await stop(id)
        app.state.store.set_archived("sessions", id, value.archived)
        app.state.store.event(id, "session", {"archived": value.archived})
        return {"archived": value.archived}

    @router.put("/sessions/{id}")
    async def rename_session(id: str, value: RenameInput):
        session(id)
        name = value.name.strip()
        if not name:
            raise HTTPException(400, "Name must not be blank")
        app.state.store.execute(
            "UPDATE sessions SET name=?,updated=? WHERE id=?", (name, now(), id)
        )
        app.state.store.record_state(id)
        app.state.store.event(id, "session", {"name": name})
        return {"name": name}

    @router.delete("/sessions/{id}")
    async def remove_session(id: str):
        session(id)
        await stop(id, "session_deleted")
        delete_session(app.state.store, id)
        return {"deleted": True}

    @router.get("/sessions/{id}/fork")
    async def preview_fork(id: str, message_id: int | None = Query(None, ge=0)):
        try:
            cutoff, message, body, _, warnings = fork_source(
                app.state.store, session(id), message_id
            )
        except ValueError as error:
            raise HTTPException(400, str(error)) from None
        count = app.state.store.one(
            "SELECT COUNT(*) AS n FROM messages WHERE session_id=? AND id<=?",
            (id, cutoff),
        )["n"]
        return {
            "message_id": cutoff,
            "message": {"name": message["name"], "text": message["text"][:260]}
            if message
            else None,
            "character_count": len(body["characters"]),
            "message_count": count,
            "warnings": warnings,
        }

    @router.post("/sessions/{id}/fork")
    async def fork(id: str, value: ForkInput):
        try:
            return fork_session(app.state.store, session(id), value)
        except ValueError as error:
            raise HTTPException(400, str(error)) from None

    @router.delete("/sessions/{id}/characters/{char_id}")
    async def remove_character(id: str, char_id: str):
        source = session(id)
        store, engine = app.state.store, app.state.engine
        char = store.character(char_id)
        if not char or char["session_id"] != id:
            raise HTTPException(404, "Character not found")
        running = source["status"] == "running"
        if running:
            await engine.pause(id, "cast_changed")
        store.execute(
            "DELETE FROM characters WHERE id=? AND session_id=?", (char_id, id)
        )
        folder = store.root / "sessions" / id / "characters" / char_id
        if folder.exists():
            shutil.rmtree(folder)
        store.record_state(id)
        store.event(id, "session", {"cast_changed": True})
        if running and store.characters(id):
            await engine.start(id)
        return {"deleted": True}

    @router.post("/{kind}/{id}/archive")
    async def archive_item(kind: str, id: str, value: ArchiveInput):
        if kind not in ("scenarios", "personas") or not app.state.store.entity(
            kind, id
        ):
            raise HTTPException(404, "Library item not found")
        app.state.store.set_archived(kind, id, value.archived)
        return {"archived": value.archived}

    @router.delete("/{kind}/{id}")
    async def remove_item(kind: str, id: str):
        store = app.state.store
        if kind == "saves":
            if not store.one("SELECT id FROM snapshots WHERE id=?", (id,)):
                raise HTTPException(404, "Checkpoint not found")
            store.execute("DELETE FROM snapshots WHERE id=?", (id,))
        elif kind in ("scenarios", "personas"):
            item = store.entity(kind, id)
            if not item:
                raise HTTPException(404, "Library item not found")
            if kind == "personas":
                # Keep scenarios usable after removing a reusable personality.
                for scenario in store.entities("scenarios"):
                    changed = False
                    for member in scenario["cast"]:
                        if member["persona_id"] == id:
                            if member.get("persona") is None:
                                member["persona"] = item["prompt"]
                            member["persona_id"] = ""
                            changed = True
                    if changed:
                        store.put_entity("scenarios", scenario)
            store.execute("DELETE FROM entities WHERE kind=? AND id=?", (kind, id))
            store.execute("DELETE FROM item_state WHERE kind=? AND id=?", (kind, id))
        else:
            raise HTTPException(404, "Library not found")
        return {"deleted": True}

    return router

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path


def uid():
    return uuid.uuid4().hex


def now():
    return time.time()


def encode(value):
    return json.dumps(value, ensure_ascii=False)


class Store:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(root / "communion.sqlite3", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS entities(kind TEXT, id TEXT, body TEXT, PRIMARY KEY(kind,id));
        CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, name TEXT, scenario TEXT, status TEXT,
            epoch INTEGER DEFAULT 0, created REAL, updated REAL, config TEXT);
        CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY, session_id TEXT, body TEXT,
            memory_rev TEXT DEFAULT '', memory_cutoff INTEGER DEFAULT 0, observed INTEGER DEFAULT 0,
            next_due REAL DEFAULT 0, phase TEXT DEFAULT 'idle');
        CREATE INDEX IF NOT EXISTS characters_session ON characters(session_id);
        CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT,
            author_id TEXT, name TEXT, text TEXT, at REAL, addressees TEXT, reply_to INTEGER,
            request_id TEXT, part INTEGER, parts INTEGER, controller TEXT,
            UNIQUE(request_id,part));
        CREATE INDEX IF NOT EXISTS messages_session ON messages(session_id,id);
        CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, session_id TEXT, character_id TEXT,
            kind TEXT, status TEXT, created REAL, updated REAL, cutoff INTEGER, metrics TEXT,
            reasoning TEXT DEFAULT '', error TEXT DEFAULT '');
        CREATE INDEX IF NOT EXISTS requests_session ON requests(session_id,created);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT,
            kind TEXT, body TEXT, at REAL);
        CREATE INDEX IF NOT EXISTS events_session ON events(session_id,id);
        CREATE TABLE IF NOT EXISTS logs(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT,
            level TEXT, message TEXT, character_id TEXT, request_id TEXT, at REAL);
        CREATE TABLE IF NOT EXISTS recaps(id TEXT PRIMARY KEY, session_id TEXT, after_id INTEGER,
            cutoff INTEGER, scope TEXT, body TEXT, created REAL);
        CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, session_id TEXT, name TEXT,
            body TEXT, created REAL);
        CREATE TABLE IF NOT EXISTS item_state(kind TEXT, id TEXT, archived INTEGER DEFAULT 0,
            metadata TEXT DEFAULT '{}', PRIMARY KEY(kind,id));
        CREATE TABLE IF NOT EXISTS state_history(id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT, cutoff INTEGER, body TEXT, created REAL);
        CREATE INDEX IF NOT EXISTS state_history_session ON state_history(session_id,id);
        """)
        columns = {row["name"] for row in self.query("PRAGMA table_info(messages)")}
        if "state_id" not in columns:
            self.db.execute("ALTER TABLE messages ADD COLUMN state_id INTEGER")
        self.db.commit()
        self._restoring = False

    def query(self, sql, args=()):
        return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def one(self, sql, args=()):
        row = self.db.execute(sql, args).fetchone()
        return dict(row) if row else None

    def execute(self, sql, args=()):
        with self.db:
            return self.db.execute(sql, args)

    def setting(self, key, default=None):
        row = self.one("SELECT value FROM kv WHERE key=?", (key,))
        return json.loads(row["value"]) if row else default

    def set_setting(self, key, value):
        self.execute("INSERT OR REPLACE INTO kv VALUES(?,?)", (key, encode(value)))

    def entities(self, kind):
        return [
            json.loads(r["body"])
            for r in self.query("SELECT body FROM entities WHERE kind=?", (kind,))
        ]

    def entity(self, kind, id):
        r = self.one("SELECT body FROM entities WHERE kind=? AND id=?", (kind, id))
        return json.loads(r["body"]) if r else None

    def put_entity(self, kind, value):
        value = dict(value)
        value["id"] = value.get("id") or uid()
        self.execute(
            "INSERT OR REPLACE INTO entities VALUES(?,?,?)",
            (kind, value["id"], encode(value)),
        )
        return value

    def archived(self, kind, id):
        row = self.one(
            "SELECT archived FROM item_state WHERE kind=? AND id=?", (kind, id)
        )
        return bool(row and row["archived"])

    def library(self, kind, archived=False):
        return [
            item
            for item in self.entities(kind)
            if self.archived(kind, item["id"]) == archived
        ]

    def set_archived(self, kind, id, archived):
        self.execute(
            "INSERT INTO item_state(kind,id,archived) VALUES(?,?,?) "
            "ON CONFLICT(kind,id) DO UPDATE SET archived=excluded.archived",
            (kind, id, int(archived)),
        )

    def state_body(self, id):
        from .models import GLOBAL_AI_FIELDS, Settings

        session = self.session(id)
        values = Settings.model_validate(
            {**self.setting("settings", {}), **session["config"]}
        ).model_dump()
        session["config"] = {
            k: v for k, v in values.items() if k not in GLOBAL_AI_FIELDS
        }
        characters = self.characters(id)
        for char in characters:
            char["memory"] = self.memory(char)
        return {"session": session, "characters": characters}

    def record_state(self, id):
        if self._restoring or not self.session(id):
            return None
        cursor = self.execute(
            "INSERT INTO state_history(session_id,cutoff,body,created) VALUES(?,?,?,?)",
            (id, self.cutoff(id), encode(self.state_body(id)), now()),
        )
        return cursor.lastrowid

    def _event(self, session_id, kind, body):
        self.db.execute(
            "INSERT INTO events(session_id,kind,body,at) VALUES(?,?,?,?)",
            (session_id, kind, encode(body), now()),
        )

    def event(self, session_id, kind, body):
        if not self.session(session_id):
            return
        with self.db:
            self._event(session_id, kind, body)

    def log(self, session_id, level, message, character_id="", request_id=""):
        if not self.session(session_id):
            return
        with self.db:
            self.db.execute(
                "INSERT INTO logs(session_id,level,message,character_id,request_id,at) VALUES(?,?,?,?,?,?)",
                (session_id, level, message[:2000], character_id, request_id, now()),
            )
            self._event(
                session_id,
                "log",
                {
                    "level": level,
                    "message": message[:2000],
                    "character_id": character_id,
                    "request_id": request_id,
                },
            )

    def create_session(self, scenario, name, config, personas):
        id = uid()
        with self.db:
            self.db.execute(
                "INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?)",
                (
                    id,
                    name or scenario["name"],
                    encode(scenario),
                    "paused",
                    0,
                    now(),
                    now(),
                    encode(config),
                ),
            )
            for member in scenario["cast"]:
                body = dict(member)
                body["persona"] = (
                    member.get("persona")
                    if member.get("persona") is not None
                    else next(
                        (
                            p["prompt"]
                            for p in personas
                            if p["id"] == member["persona_id"]
                        ),
                        "",
                    )
                )
                self.db.execute(
                    "INSERT INTO characters(id,session_id,body) VALUES(?,?,?)",
                    (uid(), id, encode(body)),
                )
            self._event(id, "session", {"status": "paused"})
        for char in self.characters(id):
            self.ensure_memory(char)
        return id

    def session(self, id):
        row = self.one("SELECT * FROM sessions WHERE id=?", (id,))
        if row:
            row["scenario"] = json.loads(row["scenario"])
            row["config"] = json.loads(row["config"])
        return row

    def characters(self, id):
        rows = self.query(
            "SELECT * FROM characters WHERE session_id=? ORDER BY rowid", (id,)
        )
        for row in rows:
            body = json.loads(row.pop("body"))
            row.update(body)
        return rows

    def character(self, id):
        r = self.one("SELECT session_id FROM characters WHERE id=?", (id,))
        return (
            next((c for c in self.characters(r["session_id"]) if c["id"] == id), None)
            if r
            else None
        )

    def phase(self, id, phase, due=0):
        self.execute(
            "UPDATE characters SET phase=?,next_due=? WHERE id=?", (phase, due, id)
        )

    def messages(self, id, after=0, before=None, limit=None):
        sql = "SELECT * FROM messages WHERE session_id=? AND id>?"
        args = [id, after]
        if before is not None:
            sql += " AND id<=?"
            args.append(before)
        sql += " ORDER BY id"
        if limit:
            sql += " LIMIT ?"
            args.append(limit)
        rows = self.query(sql, args)
        for row in rows:
            row["addressees"] = json.loads(row["addressees"])
        return rows

    def cutoff(self, id):
        return self.one(
            "SELECT COALESCE(MAX(id),0) AS n FROM messages WHERE session_id=?", (id,)
        )["n"]

    def publish(self, session_id, epoch, message):
        with self.db:
            state = self.one(
                "SELECT epoch,status FROM sessions WHERE id=?", (session_id,)
            )
            if not state or state["epoch"] != epoch:
                return None
            cursor = self.db.execute(
                """INSERT OR IGNORE INTO messages
                (session_id,author_id,name,text,at,addressees,reply_to,request_id,part,parts,controller,state_id)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    session_id,
                    message.get("author_id"),
                    message["name"],
                    message["text"],
                    message.get("at", now()),
                    encode(message.get("addressees", ["everyone"])),
                    message.get("reply_to"),
                    message["request_id"],
                    message.get("part", 0),
                    message.get("parts", 1),
                    message.get("controller", "model"),
                    self.one(
                        "SELECT MAX(id) AS id FROM state_history WHERE session_id=?",
                        (session_id,),
                    )["id"],
                ),
            )
            if not cursor.rowcount:
                return None
            id = cursor.lastrowid
            self.db.execute(
                "UPDATE sessions SET updated=? WHERE id=?", (now(), session_id)
            )
            self._event(session_id, "message", {"id": id})
        return id

    def memory(self, char):
        if not char["memory_rev"]:
            return ""
        path = (
            self.root
            / "sessions"
            / char["session_id"]
            / "characters"
            / char["id"]
            / "checkpoints"
            / (char["memory_rev"] + ".md")
        )
        return path.read_text() if path.exists() else ""

    def ensure_memory(self, char):
        if not char["memory_rev"]:
            text = f"I am {char['name']}. My role here is {char['role']}.\n\n{char['background']}"
            self.write_memory(char, text, char["memory_cutoff"])

    def write_memory(self, char, text, cutoff):
        if not self.character(char["id"]):
            return
        revision = uid()
        folder = self.root / "sessions" / char["session_id"] / "characters" / char["id"]
        (folder / "checkpoints").mkdir(parents=True, exist_ok=True)
        checkpoint = folder / "checkpoints" / (revision + ".md")
        temp_checkpoint = checkpoint.with_suffix(".tmp")
        with temp_checkpoint.open("w") as output:
            output.write(text)
            output.flush()
            os.fsync(output.fileno())
        temp_checkpoint.replace(checkpoint)
        temp = folder / "memory.tmp"
        temp.write_text(text)
        temp.replace(folder / "memory.md")
        self.execute(
            "UPDATE characters SET memory_rev=?,memory_cutoff=? WHERE id=?",
            (revision, cutoff, char["id"]),
        )
        self.event(
            char["session_id"], "memory", {"character_id": char["id"], "cutoff": cutoff}
        )
        self.record_state(char["session_id"])

    def begin_request(self, id, session, char, kind, cutoff, metrics):
        self.execute(
            "INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (
                id,
                session,
                char,
                kind,
                "queued",
                now(),
                now(),
                cutoff,
                encode(metrics),
                "",
                "",
            ),
        )

    def request_update(self, id, status, metrics=None, reasoning=None, error=None):
        row = self.one("SELECT * FROM requests WHERE id=?", (id,))
        if not row:
            return
        values = json.loads(row["metrics"])
        values.update(metrics or {})
        self.execute(
            "UPDATE requests SET status=?,updated=?,metrics=?,reasoning=?,error=? WHERE id=?",
            (
                status,
                now(),
                encode(values),
                reasoning if reasoning is not None else row["reasoning"],
                error if error is not None else row["error"],
                id,
            ),
        )
        self.event(row["session_id"], "request", {"id": id, "status": status})

    def cancel_request(self, id, reason, reasoning=None):
        row = self.one("SELECT created,status FROM requests WHERE id=?", (id,))
        if not row or row["status"] == "cancelled":
            return
        self.request_update(
            id,
            "cancelled",
            {
                "cancel_reason": reason,
                "cancelled_at": now(),
                "elapsed_ms": round((now() - row["created"]) * 1000),
                "published_parts": self.one(
                    "SELECT COUNT(*) AS n FROM messages WHERE request_id=?", (id,)
                )["n"],
            },
            reasoning=reasoning,
        )

    def requests(self, id, limit=100):
        rows = self.query(
            "SELECT * FROM requests WHERE session_id=? ORDER BY created DESC LIMIT ?",
            (id, limit),
        )
        for row in rows:
            row["metrics"] = json.loads(row["metrics"])
        return rows

    def snapshot(self, id, name):
        from .models import GLOBAL_AI_FIELDS, Settings

        body = {
            "version": 1,
            "session": self.session(id),
            "characters": self.characters(id),
            "messages": self.messages(id),
            "history": [
                {"id": row["id"], "cutoff": row["cutoff"], **json.loads(row["body"])}
                for row in self.query(
                    "SELECT * FROM state_history WHERE session_id=? ORDER BY id", (id,)
                )
            ],
        }
        body["session"]["config"] = Settings.model_validate(
            {**self.setting("settings", {}), **body["session"]["config"]}
        ).model_dump()
        for key in GLOBAL_AI_FIELDS:
            body["session"]["config"].pop(key, None)
        used = {c["provider_id"] for c in body["characters"]}
        used.add(
            body["session"]["config"].get(
                "narrator_provider",
                self.setting("settings", {}).get("narrator_provider", "glm"),
            )
        )
        body["providers"] = [p for p in self.entities("providers") if p["id"] in used]
        for char in body["characters"]:
            char["memory"] = self.memory(char)
        snapshot_id = uid()
        self.execute(
            "INSERT INTO snapshots VALUES(?,?,?,?,?)",
            (snapshot_id, id, name, encode(body), now()),
        )
        return snapshot_id

    def restore(self, body):
        self._restoring = True
        try:
            id = self._restore(body)
        finally:
            self._restoring = False
        self.record_state(id)
        return id

    def _restore(self, body):
        from .models import GLOBAL_AI_FIELDS, SavedWorld, Settings

        body = SavedWorld.model_validate(body).model_dump()
        body["session"]["config"] = Settings.model_validate(
            {**self.setting("settings", {}), **body["session"]["config"]}
        ).model_dump()
        for key in GLOBAL_AI_FIELDS:
            body["session"]["config"].pop(key, None)
        if len({m["id"] for m in body["messages"]}) != len(body["messages"]):
            raise ValueError("Duplicate source message IDs in save")
        if len({c["id"] for c in body["characters"]}) != len(body["characters"]):
            raise ValueError("Duplicate character IDs in save")
        source = body["session"]
        for profile in body.get("providers", []):
            if not self.entity("providers", profile["id"]):
                self.put_entity("providers", profile)
        scenario = source["scenario"]
        if (
            len(body.get("messages", [])) > 100000
            or len(body.get("characters", [])) > 32
        ):
            raise ValueError("Save exceeds prototype limits")
        id = self.create_session(
            {**scenario, "cast": []},
            source["name"] + " (restored)",
            source["config"],
            [],
        )
        char_map = {
            char["id"]: uid()
            for state in [*body["history"], {"characters": body["characters"]}]
            for char in state["characters"]
        }
        for char in body["characters"]:
            new_id = char_map[char["id"]]
            config = {
                k: v
                for k, v in char.items()
                if k
                not in (
                    "id",
                    "session_id",
                    "memory_rev",
                    "memory_cutoff",
                    "observed",
                    "phase",
                    "next_due",
                    "memory",
                )
            }
            self.execute(
                "INSERT INTO characters(id,session_id,body) VALUES(?,?,?)",
                (new_id, id, encode(config)),
            )
        message_map = {0: 0}
        for message in sorted(body["messages"], key=lambda m: m["id"]):
            new_id = self.publish(
                id,
                0,
                {
                    **message,
                    "author_id": char_map.get(message.get("author_id")),
                    "request_id": "restore-" + uid(),
                    "reply_to": message_map.get(message.get("reply_to")),
                    "addressees": [
                        char_map.get(a, a)
                        for a in message.get("addressees", ["everyone"])
                    ],
                },
            )
            message_map[message["id"]] = new_id
        for char in body["characters"]:
            new = self.character(char_map[char["id"]])
            cutoff = max(
                (
                    new_id
                    for old, new_id in message_map.items()
                    if old <= char["memory_cutoff"]
                ),
                default=0,
            )
            observed = max(
                (
                    new_id
                    for old, new_id in message_map.items()
                    if old <= char["observed"]
                ),
                default=0,
            )
            if char.get("memory"):
                self.write_memory(new, char["memory"], cutoff)
            else:
                new["memory_cutoff"] = cutoff
                self.ensure_memory(new)
            self.execute(
                "UPDATE characters SET observed=? WHERE id=?", (observed, new["id"])
            )
        self.execute(
            "UPDATE sessions SET scenario=? WHERE id=?", (encode(scenario), id)
        )

        def mapped_cutoff(old):
            return max(
                (new for source, new in message_map.items() if source <= old), default=0
            )

        state_map = {}
        for state in body["history"]:
            for char in state["characters"]:
                char["id"] = char_map[char["id"]]
                char["session_id"] = id
                char["memory_cutoff"] = mapped_cutoff(char["memory_cutoff"])
                char["observed"] = mapped_cutoff(char["observed"])
            state_map[state["id"]] = self.execute(
                "INSERT INTO state_history(session_id,cutoff,body,created) VALUES(?,?,?,?)",
                (
                    id,
                    mapped_cutoff(state["cutoff"]),
                    encode(
                        {"session": state["session"], "characters": state["characters"]}
                    ),
                    now(),
                ),
            ).lastrowid
        for message in body["messages"]:
            self.execute(
                "UPDATE messages SET state_id=? WHERE id=?",
                (state_map.get(message["state_id"]), message_map[message["id"]]),
            )
        return id

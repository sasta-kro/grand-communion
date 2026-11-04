import asyncio
import hashlib
import json
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from .models import GLOBAL_AI_FIELDS, NoResponse, Provider, Settings, Speech
from .provider import Gateway, ProviderError, cancellation_reason, parse_json
from .store import encode, now, uid
from .writing_policy import WritingPolicy, tokens


def split_speech(text, limit, max_parts):
    # Sentence boundaries are preferred, but even a long unbroken sentence is bounded.
    chunks, current = [], []
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        words = sentence.split()
        if current and len(current) + len(words) > limit:
            chunks.append(" ".join(current))
            current = []
        while len(words) > limit:
            chunks.append(" ".join(words[:limit]))
            words = words[limit:]
        if words:
            current.extend(words)
    if current:
        chunks.append(" ".join(current))
    return chunks[:max_parts]


def public_message(message, timezone="Asia/Bangkok", include_time=True):
    value = {
        key: message[key]
        for key in ("id", "author_id", "name", "text", "addressees", "reply_to")
    }
    if include_time:
        value["time"] = datetime.fromtimestamp(
            message["at"], ZoneInfo(timezone)
        ).strftime("%H:%M:%S")
    return value


class Engine:
    def __init__(self, store, credentials, client=None):
        self.store = store
        self.credentials = credentials
        self.gateway = Gateway(store, credentials, self.settings, client)
        self.runtimes = {}
        self.report_tasks = set()
        self.sequence = 0
        self.recap_locks = {}

    def settings(self, session=None):
        values = self.store.setting("settings", {})
        if session:
            # AI writing policy stays global, including for restored worlds.
            values = {
                **values,
                **{
                    k: v
                    for k, v in session["config"].items()
                    if k not in GLOBAL_AI_FIELDS
                },
            }
        return Settings.model_validate(values)

    def profile(self, id):
        body = self.store.entity("providers", id)
        if not body:
            raise ProviderError("Provider profile not found: " + id)
        return Provider.model_validate(body)

    def valid(self, id, epoch):
        session = self.store.session(id)
        return session and session["status"] == "running" and session["epoch"] == epoch

    async def boot(self):
        for row in self.store.query("SELECT id FROM characters WHERE memory_rev=''"):
            self.store.ensure_memory(self.store.character(row["id"]))
        running = self.store.query("SELECT id FROM sessions WHERE status='running'")
        for row in self.store.query(
            "SELECT id FROM requests WHERE status IN ('queued','requesting','reasoning','speaking','backoff')"
        ):
            self.store.request_update(
                row["id"], "interrupted", {"cancel_reason": "backend_restart"}
            )
        self.store.execute("UPDATE characters SET phase='idle',next_due=0")
        self.store.execute(
            "UPDATE sessions SET status='paused',epoch=epoch+1 WHERE status='running'"
        )
        for row in self.store.query("SELECT id FROM sessions"):
            if not self.store.one(
                "SELECT id FROM state_history WHERE session_id=? LIMIT 1", (row["id"],)
            ):
                self.store.record_state(row["id"])
        if self.settings().auto_resume:
            for session in running:
                await self.start(session["id"])

    async def close(self):
        # Preserve desired running status for optional restart recovery.
        for runtime in list(self.runtimes.values()):
            for task in runtime["tasks"]:
                task.cancel("server_shutdown")
        tasks = [t for r in self.runtimes.values() for t in r["tasks"]] + list(
            self.report_tasks
        )
        for task in self.report_tasks:
            task.cancel("server_shutdown")
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self.runtimes.clear()
        await self.gateway.client.aclose()

    async def start(self, id):
        if self.store.archived("sessions", id):
            raise ValueError("Restore this session from the archive before starting it")
        if id in self.runtimes:
            return
        session = self.store.session(id)
        if not session:
            raise ValueError("Session not found")
        chars = self.store.characters(id)
        if not chars:
            raise ValueError("Add a character before starting")
        for char in chars:
            profile = self.profile(char["provider_id"])
            if (
                profile.protocol == "openai"
                and profile.requires_key
                and not self.credentials.get(profile)
            ):
                raise ValueError("Configure credentials for " + profile.name)
        self.store.execute(
            "UPDATE sessions SET status='running',epoch=epoch+1,updated=? WHERE id=?",
            (now(), id),
        )
        epoch = self.store.session(id)["epoch"]
        runtime = {"queue": asyncio.PriorityQueue(), "tasks": [], "epoch": epoch}
        self.runtimes[id] = runtime
        runtime["tasks"].append(asyncio.create_task(self.publisher(id, runtime)))
        for index, char in enumerate(chars):
            runtime["tasks"].append(
                asyncio.create_task(
                    self.character_loop(id, char["id"], epoch, index * 0.2)
                )
            )
        runtime["tasks"].append(asyncio.create_task(self.narrator_loop(id, epoch)))
        self.store.log(
            id, "INFO", "Session started. Character timers are owned by the backend."
        )
        self.store.event(id, "session", {"status": "running"})

    async def pause(self, id, reason="session_paused"):
        self.store.execute(
            "UPDATE sessions SET status='paused',epoch=epoch+1,updated=? WHERE id=?",
            (now(), id),
        )
        runtime = self.runtimes.pop(id, None)
        if runtime:
            for task in runtime["tasks"]:
                task.cancel(reason)
            await asyncio.gather(*runtime["tasks"], return_exceptions=True)
        self.store.execute(
            "UPDATE characters SET phase='idle',next_due=0 WHERE session_id=?", (id,)
        )
        self.store.log(id, "INFO", "Session paused; pending speech invalidated.")
        self.store.event(id, "session", {"status": "paused"})

    def context(self, session, char, cutoff):
        cfg = self.settings(session)
        character_prompt = (
            cfg.character_prompt.replace("{name}", char["name"])
            .replace("{word_limit}", str(cfg.word_limit))
            .replace("{{", "{")
            .replace("}}", "}")
        )
        cast = [
            {"id": c["id"], "name": c["name"], "role": c["role"]}
            for c in self.store.characters(session["id"])
        ]
        system = "\n\n".join(
            [
                character_prompt,
                "My personality:\n" + char.get("persona", ""),
                "My role: " + char["role"],
                "My private background:\n" + char["background"],
                "Our setting:\n" + session["scenario"]["premise"],
                "People publicly present:\n" + encode(cast),
            ]
        )
        memory = self.store.memory(char)
        messages = self.store.messages(session["id"], char["memory_cutoff"], cutoff)
        user = "My retained recollections:\n" + (
            memory or "I have my own background and the shared starting situation."
        )
        user += "\n\nPublic observations, oldest first:\n" + encode(
            [public_message(m, cfg.timezone, cfg.include_model_time) for m in messages]
        )
        user += "\n\nI now have an opportunity to speak, or to return no_response. I output only JSON."
        return self.gateway.prepare_messages(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )

    def begin(self, session, char, kind, cutoff, context, profile):
        context[:] = self.gateway.prepare_messages(context)
        request_id = uid()
        estimate = sum(tokens(m["content"]) for m in context)
        self.store.begin_request(
            request_id,
            session["id"],
            char["id"] if char else "",
            kind,
            cutoff,
            {
                "estimated_input_tokens": estimate,
                "context_capacity": profile.context_tokens,
                "output_reserve": profile.max_output,
                "provider_id": profile.id,
                "model": profile.model,
                "reasoning_effort": profile.reasoning_effort,
                "writing_policy": WritingPolicy(self.settings()).fingerprint,
            },
        )
        return request_id

    async def compact(self, session, char, cutoff, force=False):
        cfg, profile = self.settings(session), self.profile(char["provider_id"])
        context = self.context(session, char, cutoff)
        estimate = sum(tokens(m["content"]) for m in context)
        capacity = min(
            profile.context_tokens, cfg.working_context or profile.context_tokens
        )
        threshold = min(
            capacity * cfg.compact_ratio, capacity - profile.max_output - 512
        )
        if not force and estimate < threshold:
            return char
        rows = self.store.messages(session["id"], char["memory_cutoff"], cutoff)
        keep = min(40, max(1, len(rows) // 4))
        older = rows[:-keep] if len(rows) > 1 else rows
        if not older:
            if estimate + profile.max_output + 256 > capacity:
                raise ProviderError(
                    "Identity or memory exceeds the context budget. Increase the working context."
                )
            return char
        self.store.phase(char["id"], "compacting")
        memory = self.store.memory(char)
        chunk, count = [], 0
        policy_size = tokens(WritingPolicy(self.settings()).instruction)
        budget = max(
            500, min(32000, capacity - profile.max_output - 2000 - policy_size)
        )
        batches = []
        for row in older:
            size = tokens(encode(public_message(row)))
            if chunk and count + size > budget:
                batches.append(chunk)
                chunk = []
                count = 0
            chunk.append(row)
            count += size
        if chunk:
            batches.append(chunk)
        for batch in batches:
            prompt = cfg.memory_prompt.replace("{target_words}", str(cfg.memory_words))
            context = [
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": encode(
                        {
                            "my_name": char["name"],
                            "my_personality": char["persona"],
                            "my_background": char["background"],
                            "previous_memory": memory,
                            "observations": [
                                public_message(m, cfg.timezone, cfg.include_model_time)
                                for m in batch
                            ],
                        }
                    ),
                },
            ]
            request_id = self.begin(
                session, char, "memory", batch[-1]["id"], context, profile
            )
            result = parse_json(
                await self.gateway.generate(profile, context, "memory", request_id)
            )
            text = result.get("memory")
            if not isinstance(text, str) or not text.strip():
                raise ProviderError(
                    "Memory output was empty or invalid; previous checkpoint retained"
                )
            if (
                not self.valid(session["id"], session["epoch"])
                and session["status"] == "running"
            ):
                raise asyncio.CancelledError("session_changed")
            memory = text.strip()
            self.store.write_memory(char, memory, batch[-1]["id"])
        self.store.log(
            session["id"], "INFO", "First-person memory checkpoint saved.", char["id"]
        )
        return self.store.character(char["id"])

    async def character_loop(self, id, char_id, epoch, stagger):
        await asyncio.sleep(stagger)
        while self.valid(id, epoch):
            request_id = None
            session, char = self.store.session(id), self.store.character(char_id)
            cfg = self.settings(session)
            cooldown = char.get("cooldown") or cfg.cooldown
            due = now() + cooldown
            try:
                cutoff = self.store.cutoff(id)
                char = await self.compact(session, char, cutoff)
                profile = self.profile(char["provider_id"])
                context = self.context(session, char, cutoff)
                capacity = min(
                    profile.context_tokens,
                    cfg.working_context or profile.context_tokens,
                )
                if (
                    sum(tokens(m["content"]) for m in context)
                    + profile.max_output
                    + 256
                    > capacity
                ):
                    raise ProviderError(
                        "Prompt cannot fit with the reserved output allowance"
                    )
                request_id = self.begin(
                    session, char, "character", cutoff, context, profile
                )
                self.store.phase(char_id, "queued")
                raw = await self.gateway.generate(
                    profile, context, "character", request_id
                )
                result = parse_json(raw)
                value = (
                    Speech.model_validate(result)
                    if result.get("action") == "speak"
                    else NoResponse.model_validate(result)
                )
                if not self.valid(id, epoch):
                    break
                self.store.execute(
                    "UPDATE characters SET observed=? WHERE id=?", (cutoff, char_id)
                )
                due = now() + cooldown
                if isinstance(value, Speech) and not char.get("muted"):
                    eligible = {m["id"] for m in self.store.messages(id, 0, cutoff)}
                    if value.reply_to is not None and value.reply_to not in eligible:
                        value.reply_to = None
                    names = {c["name"] for c in self.store.characters(id)}
                    ids = {c["id"] for c in self.store.characters(id)}
                    addresses = [
                        a
                        for a in value.addressees
                        if a == "everyone" or a in names or a in ids
                    ] or ["everyone"]
                    future = self.enqueue(
                        id,
                        {
                            "author_id": char_id,
                            "name": char["name"],
                            "chunks": split_speech(
                                value.text, cfg.word_limit, cfg.max_parts
                            ),
                            "reply_to": value.reply_to,
                            "addressees": addresses,
                            "request_id": request_id,
                            "controller": "model",
                        },
                    )
                    self.store.phase(char_id, "delivery")
                    await future
                else:
                    self.store.request_update(request_id, "no_response")
                    self.store.log(
                        id,
                        "DEBUG",
                        f"No public response; observed through #{cutoff}.",
                        char_id,
                        request_id,
                    )
            except asyncio.CancelledError as error:
                if request_id:
                    self.store.cancel_request(request_id, cancellation_reason(error))
                raise
            except Exception as error:
                message = (
                    self.credentials.redact(str(error))[:500] or type(error).__name__
                )
                self.store.log(id, "ERROR", message, char_id, request_id or "")
                if request_id:
                    self.store.request_update(request_id, "error", error=message)
                self.store.phase(char_id, "error")
                due = now() + max(3, cooldown)
            if self.valid(id, epoch):
                self.store.phase(char_id, "cooldown", due)
                await asyncio.sleep(max(0.1, due - now()))

    def enqueue(self, id, speech, priority=1):
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        speech.update({"index": 0, "future": future})
        self.sequence += 1
        self.runtimes[id]["queue"].put_nowait((priority, self.sequence, speech))
        return future

    async def publisher(self, id, runtime):
        last = 0
        while self.valid(id, runtime["epoch"]):
            priority, _, speech = await runtime["queue"].get()
            gap = self.settings(self.store.session(id)).global_gap
            await asyncio.sleep(max(0, last + gap - time.monotonic()))
            if not self.valid(id, runtime["epoch"]):
                return
            index = speech["index"]
            self.store.publish(
                id,
                runtime["epoch"],
                {
                    **speech,
                    "text": speech["chunks"][index],
                    "part": index,
                    "parts": len(speech["chunks"]),
                },
            )
            last = time.monotonic()
            speech["index"] += 1
            if speech["index"] < len(speech["chunks"]):
                self.sequence += 1
                runtime["queue"].put_nowait((priority, self.sequence, speech))
            elif not speech["future"].done():
                speech["future"].set_result(None)
            runtime["queue"].task_done()

    async def inject(self, session, value):
        if self.store.archived("sessions", session["id"]):
            raise ValueError(
                "Restore this session from the archive before adding speech"
            )
        chars = self.store.characters(session["id"])
        char = next((c for c in chars if c["id"] == value.author_id), None)
        name = char["name"] if char else value.name
        cfg = self.settings(session)
        if len(value.text.split()) > cfg.word_limit * cfg.max_parts:
            raise ValueError(
                f"Keep a contribution within {cfg.word_limit * cfg.max_parts} words, or send it in smaller pieces."
            )
        message = {
            "author_id": char["id"] if char else None,
            "name": name,
            "addressees": value.addressees,
            "reply_to": value.reply_to,
            "request_id": "operator-" + uid(),
            "controller": "operator",
        }
        if value.reply_to and not self.store.one(
            "SELECT id FROM messages WHERE session_id=? AND id=?",
            (session["id"], value.reply_to),
        ):
            raise ValueError("Reply target is not part of this scene")
        chunks = split_speech(value.text, cfg.word_limit, cfg.max_parts)
        if session["id"] in self.runtimes:
            self.enqueue(session["id"], {**message, "chunks": chunks}, 0)
        else:
            for index, chunk in enumerate(chunks):
                self.store.publish(
                    session["id"],
                    session["epoch"],
                    {**message, "text": chunk, "part": index, "parts": len(chunks)},
                )

    async def narrator_loop(self, id, epoch):
        elapsed = 0
        while self.valid(id, epoch):
            await asyncio.sleep(5)
            elapsed += 5
            cfg = self.settings(self.store.session(id))
            if cfg.narrator_enabled and elapsed >= cfg.narrator_interval:
                elapsed = 0
                last = self.store.one(
                    "SELECT cutoff FROM recaps WHERE session_id=? ORDER BY created DESC LIMIT 1",
                    (id,),
                )
                after = last["cutoff"] if last else 0
                if self.store.cutoff(id) > after:
                    try:
                        await self.recap(id, after)
                    except asyncio.CancelledError:
                        raise
                    except Exception as error:
                        self.store.log(
                            id,
                            "WARNING",
                            "Narrator: " + self.credentials.redact(str(error))[:400],
                        )

    async def recap(self, id, after=0, scope=None, force=False):
        lock = self.recap_locks.setdefault(id, asyncio.Lock())
        async with lock:
            return await self._recap(id, after, scope, force)

    async def _recap(self, id, after=0, scope=None, force=False):
        session = self.store.session(id)
        cfg = self.settings(session)
        scope = scope or cfg.narrator_scope
        cutoff = self.store.cutoff(id)
        rows = self.store.messages(id, after, cutoff)
        profile = self.profile(cfg.narrator_provider)
        signature = hashlib.sha256(
            (cfg.narrator_prompt + WritingPolicy(self.settings()).fingerprint).encode()
        ).hexdigest()[:12]
        previous = self.store.query(
            "SELECT * FROM recaps WHERE session_id=? AND after_id=? AND cutoff=? AND scope=? ORDER BY created DESC LIMIT 1",
            (id, after, cutoff, scope),
        )
        if (
            not force
            and previous
            and json.loads(previous[0]["body"]).get("prompt_revision") == signature
        ):
            return previous[0]["id"]
        private = []
        if scope == "private":
            private = [
                {
                    "name": c["name"],
                    "memory": self.store.memory(c),
                    "background": c["background"],
                }
                for c in self.store.characters(id)
            ]
            private += [
                {
                    "provider_reasoning": r["reasoning"],
                    "character_id": r["character_id"],
                }
                for r in self.store.requests(id, 32)
                if r["reasoning"]
            ]
            # Private context is bounded independently from public history.
            allowance = max(
                500,
                min(12000, (profile.context_tokens - profile.max_output - 3000) // 3),
            )
            projected = []
            for item in private:
                size = tokens(encode(item))
                if size > allowance:
                    continue
                projected.append(item)
                allowance -= size
            private = projected
        report = {
            "title": "A quiet interval",
            "narrative": "No public speech occurred in this interval.",
            "notable": [],
            "unresolved": [],
        }
        # Bounded source chunks; the final call folds prior reports rather than the full transcript.
        if rows:
            fixed = (
                tokens(encode(private))
                + tokens(session["scenario"]["premise"])
                + tokens(cfg.narrator_prompt)
                + tokens(WritingPolicy(self.settings()).instruction)
            )
            budget = max(
                500,
                min(
                    24000,
                    profile.context_tokens - 2 * profile.max_output - fixed - 2000,
                ),
            )
            chunks, chunk, size = [], [], 0
            for row in rows:
                count = tokens(encode(public_message(row)))
                if chunk and size + count > budget:
                    chunks.append(chunk)
                    chunk = []
                    size = 0
                chunk.append(row)
                size += count
            if chunk:
                chunks.append(chunk)
            for batch in chunks:
                context = [
                    {"role": "system", "content": cfg.narrator_prompt},
                    {
                        "role": "user",
                        "content": encode(
                            {
                                "setting": session["scenario"]["premise"],
                                "earlier_report": report
                                if report.get("notable") or report.get("unresolved")
                                else None,
                                "observations": [
                                    public_message(
                                        m, cfg.timezone, cfg.include_model_time
                                    )
                                    for m in batch
                                ],
                                "private_material": private,
                            }
                        ),
                    },
                ]
                request_id = self.begin(
                    session, None, "narrator", batch[-1]["id"], context, profile
                )
                raw = await self.gateway.generate(
                    profile, context, "narrator", request_id
                )
                report = parse_json(raw)
                if not isinstance(report.get("narrative"), str):
                    raise ProviderError("Narrator did not return a narrative")
        eligible = {r["id"] for r in rows}
        notable = []
        for item in report.get("notable", [])[:30]:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                notable.append(
                    {
                        "text": item["text"],
                        "message_ids": [
                            x for x in item.get("message_ids", []) if x in eligible
                        ],
                    }
                )
        body = {
            "title": str(report.get("title", "Chronicle")),
            "narrative": report["narrative"],
            "notable": notable,
            "unresolved": [str(x) for x in report.get("unresolved", [])[:20]],
            "prompt_revision": signature,
            "writing_policy": WritingPolicy(self.settings()).fingerprint,
            "source_count": len(rows),
            "provider_id": profile.id,
        }
        recap_id = uid()
        self.store.execute(
            "INSERT INTO recaps VALUES(?,?,?,?,?,?,?)",
            (recap_id, id, after, cutoff, scope, encode(body), now()),
        )
        self.store.event(id, "recap", {"id": recap_id})
        return recap_id

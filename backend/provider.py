import asyncio
import json
import os
import random
import time
from contextlib import asynccontextmanager
from pathlib import Path
import httpx
from dotenv import dotenv_values
from .models import Provider


class ProviderError(Exception):
    def __init__(self, message, code=None, retryable=False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


def cancellation_reason(error):
    reason = error.args[0] if error.args else "task_cancelled"
    return (
        reason
        if isinstance(reason, str)
        and reason
        in {
            "session_paused",
            "server_shutdown",
            "settings_changed",
            "cast_changed",
            "session_changed",
        }
        else "task_cancelled"
    )


class Credentials:
    def __init__(self, root: Path, data: Path):
        self.env = {**dotenv_values(root / ".env"), **os.environ}
        self.path = data / "credentials.json"
        self.values = json.loads(self.path.read_text()) if self.path.exists() else {}

    def get(self, profile):
        if self.values.get(profile.id):
            return self.values[profile.id]
        if profile.key_env != "AUTO":
            return self.env.get(profile.key_env, "")
        if profile.id != "glm":
            return ""
        for key in (
            "ZAI_API_KEY",
            "Z_AI_API_KEY",
            "GLM_API_KEY",
            "GLM_AUTH_TOKEN",
            "ANTHROPIC_AUTH_TOKEN",
            "ANTHROPIC_API_KEY",
            "API_KEY",
            "OPENAI_API_KEY",
        ):
            if self.env.get(key):
                return self.env[key]
        return ""

    def set(self, id, value):
        self.values[id] = value
        temp = self.path.with_suffix(".tmp")
        temp.touch(mode=0o600)
        temp.write_text(json.dumps(self.values))
        temp.chmod(0o600)
        temp.replace(self.path)

    def redact(self, text):
        secrets = list(self.values.values()) + [
            v
            for k, v in self.env.items()
            if any(x in k.upper() for x in ("KEY", "TOKEN", "SECRET", "PASSWORD"))
        ]
        for value in secrets:
            if value and len(value) >= 6:
                text = text.replace(value, "[REDACTED]")
        return text


class Limiter:
    def __init__(self, settings):
        self.settings = settings
        self.active = 0
        self.characters = 0
        self.profiles = {}
        self.condition = asyncio.Condition()

    @asynccontextmanager
    async def slot(self, profile, kind):
        async with self.condition:
            while True:
                cfg = self.settings()
                if (
                    self.active < cfg.max_concurrency
                    and self.profiles.get(profile.id, 0) < profile.concurrency
                    and (
                        kind != "character"
                        or self.characters
                        < min(cfg.character_slots, cfg.max_concurrency)
                    )
                ):
                    break
                try:
                    await asyncio.wait_for(self.condition.wait(), timeout=1)
                except TimeoutError:
                    pass
            self.active += 1
            self.profiles[profile.id] = self.profiles.get(profile.id, 0) + 1
            if kind == "character":
                self.characters += 1
        try:
            yield
        finally:
            async with self.condition:
                self.active -= 1
                self.profiles[profile.id] -= 1
                if kind == "character":
                    self.characters -= 1
                self.condition.notify_all()


def parse_json(text):
    value = text.strip()
    if value.startswith("```"):
        value = value.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return json.loads(value)


class Gateway:
    def __init__(self, store, credentials, settings, client=None):
        self.store = store
        self.credentials = credentials
        self.settings = settings
        self.client = client or httpx.AsyncClient(
            limits=httpx.Limits(max_connections=64), follow_redirects=False
        )
        self.limiter = Limiter(settings)

    async def generate(self, profile: Provider, messages, kind, request_id):
        try:
            return await self._generate(profile, messages, kind, request_id)
        except asyncio.CancelledError as error:
            self.store.cancel_request(request_id, cancellation_reason(error))
            raise

    async def _generate(self, profile: Provider, messages, kind, request_id):
        started = time.monotonic()
        row = self.store.one(
            "SELECT session_id FROM requests WHERE id=?", (request_id,)
        )
        cfg = (
            self.settings(self.store.session(row["session_id"]))
            if row
            else self.settings()
        )
        content, reasoning, usage = "", "", {}
        async with self.limiter.slot(profile, kind):
            queue_ms = round((time.monotonic() - started) * 1000)
            if profile.protocol == "mock":
                await asyncio.sleep(0.08)
                if kind == "memory":
                    content = json.dumps(
                        {
                            "memory": "I remember the shared conversation and the promises I heard. I remain myself."
                        }
                    )
                elif kind == "narrator":
                    content = json.dumps(
                        {
                            "title": "Around the gathering",
                            "narrative": "The company exchanged their concerns and returned to the matter before them.",
                            "notable": [],
                            "unresolved": ["The conversation continues."],
                        }
                    )
                else:
                    content = (
                        json.dumps({"action": "no_response"})
                        if random.random() < 0.35
                        else json.dumps(
                            {
                                "action": "speak",
                                "text": random.choice(
                                    [
                                        "May we keep a light for those still finding their way.",
                                        "I hear your concern. What would you have us do before dawn?",
                                        "There is room for doubt beside this fire. I will listen.",
                                    ]
                                ),
                                "addressees": ["everyone"],
                            }
                        )
                    )
                reasoning = "Considering the latest conversation and whether I have anything to add."
                usage = {
                    "input_tokens": sum(len(m["content"]) for m in messages) // 4,
                    "output_tokens": len(content) // 4,
                }
                self.store.request_update(
                    request_id,
                    "completed",
                    {
                        "queue_ms": queue_ms,
                        "duration_ms": round((time.monotonic() - started) * 1000),
                        "usage": usage,
                        "finish_reason": "stop",
                    },
                    reasoning if cfg.capture_reasoning else "",
                )
                return content
            key = self.credentials.get(profile)
            headers = {"Content-Type": "application/json"}
            if key:
                headers["Authorization"] = "Bearer " + key
            if profile.protocol == "openai":
                url = (
                    profile.base_url
                    if profile.base_url.endswith("/chat/completions")
                    else profile.base_url + "/chat/completions"
                )
                payload = {
                    "model": profile.model,
                    "messages": messages,
                    "stream": True,
                    "max_tokens": profile.max_output,
                    "response_format": {"type": "json_object"},
                    "stream_options": {"include_usage": True},
                }
                if profile.supports_effort and profile.reasoning_effort != "auto":
                    payload["reasoning_effort"] = profile.reasoning_effort
            else:
                url = (
                    profile.base_url
                    if profile.base_url.endswith("/api/chat")
                    else profile.base_url + "/api/chat"
                )
                payload = {
                    "model": profile.model,
                    "messages": messages,
                    "stream": True,
                    "format": "json",
                    "options": {
                        "num_ctx": profile.context_tokens,
                        "num_predict": profile.max_output,
                    },
                }
            finish, first_token, first_byte = None, None, None
            for attempt in range(3):
                content, reasoning = "", ""
                finish = None
                first_reasoning, first_content, reasoning_truncated = None, None, False
                try:
                    self.store.request_update(
                        request_id,
                        "requesting",
                        {
                            "queue_ms": queue_ms,
                            "attempt": attempt + 1,
                            "provider_id": profile.id,
                            "model": profile.model,
                        },
                    )
                    async with self.client.stream(
                        "POST",
                        url,
                        json=payload,
                        headers=headers,
                        timeout=profile.timeout,
                    ) as response:
                        self.store.request_update(
                            request_id,
                            "requesting",
                            {"http_status": response.status_code},
                        )
                        if response.status_code >= 400:
                            code = response.status_code
                            retryable = code in (408, 429, 500, 502, 503, 504)
                            raise ProviderError(
                                f"Provider HTTP {code}", code, retryable
                            )
                        last_emit = 0
                        async for line in response.aiter_lines():
                            if not line or line.startswith(":"):
                                continue
                            if first_byte is None:
                                first_byte = round((time.monotonic() - started) * 1000)
                            if profile.protocol == "openai":
                                if not line.startswith("data:"):
                                    continue
                                raw = line[5:].strip()
                                if raw == "[DONE]":
                                    break
                                data = json.loads(raw)
                                if data.get("error"):
                                    raise ProviderError(
                                        "Provider returned a streaming error"
                                    )
                                choice = (data.get("choices") or [{}])[0]
                                delta = choice.get("delta", {})
                                text = delta.get("content") or ""
                                thought = (
                                    delta.get("reasoning_content")
                                    or delta.get("reasoning")
                                    or ""
                                )
                                finish = choice.get("finish_reason") or finish
                                if data.get("usage"):
                                    u = data["usage"]
                                    usage = {
                                        "input_tokens": u.get("prompt_tokens"),
                                        "output_tokens": u.get("completion_tokens"),
                                        "reasoning_tokens": (
                                            u.get("completion_tokens_details") or {}
                                        ).get("reasoning_tokens"),
                                        "cached_tokens": (
                                            u.get("prompt_tokens_details") or {}
                                        ).get("cached_tokens"),
                                    }
                            else:
                                data = json.loads(line)
                                if data.get("error"):
                                    raise ProviderError("Local model returned an error")
                                delta = data.get("message", {})
                                text, thought = (
                                    delta.get("content", ""),
                                    delta.get("thinking", ""),
                                )
                                if data.get("done"):
                                    finish = data.get("done_reason", "stop")
                                    usage = {
                                        "input_tokens": data.get("prompt_eval_count"),
                                        "output_tokens": data.get("eval_count"),
                                    }
                            if (text or thought) and first_token is None:
                                first_token = round((time.monotonic() - started) * 1000)
                            if thought and first_reasoning is None:
                                first_reasoning = round(
                                    (time.monotonic() - started) * 1000
                                )
                            if text and first_content is None:
                                first_content = round(
                                    (time.monotonic() - started) * 1000
                                )
                            content += text
                            if cfg.capture_reasoning:
                                reasoning_truncated = (
                                    reasoning_truncated
                                    or len(reasoning) + len(thought)
                                    > cfg.reasoning_limit
                                )
                                reasoning = (reasoning + thought)[: cfg.reasoning_limit]
                            if time.monotonic() - last_emit > 0.6:
                                phase = "speaking" if text else "reasoning"
                                self.store.request_update(
                                    request_id,
                                    phase,
                                    {
                                        "first_byte_ms": first_byte,
                                        "first_token_ms": first_token,
                                    },
                                    self.credentials.redact(reasoning),
                                )
                                last_emit = time.monotonic()
                        if finish in ("length", "max_tokens"):
                            raise ProviderError(
                                "Output allowance exhausted before a complete response"
                            )
                        if not content.strip():
                            raise ProviderError("Provider returned no visible output")
                    duration = round((time.monotonic() - started) * 1000)
                    self.store.request_update(
                        request_id,
                        "completed",
                        {
                            "duration_ms": duration,
                            "first_byte_ms": first_byte,
                            "first_token_ms": first_token,
                            "first_content_ms": first_content,
                            "reasoning_ms": max(
                                0, (first_content or duration) - first_reasoning
                            )
                            if first_reasoning is not None
                            else 0,
                            "reasoning_truncated": reasoning_truncated,
                            "usage": usage,
                            "finish_reason": finish,
                        },
                        self.credentials.redact(reasoning),
                        error="",
                    )
                    return content
                except asyncio.CancelledError as error:
                    self.store.cancel_request(
                        request_id,
                        cancellation_reason(error),
                        reasoning=self.credentials.redact(reasoning),
                    )
                    raise
                except (httpx.HTTPError, ProviderError, ValueError) as error:
                    retryable = isinstance(error, httpx.TransportError) or getattr(
                        error, "retryable", False
                    )
                    failure_kind = (
                        "timeout"
                        if isinstance(error, httpx.TimeoutException)
                        else "network"
                        if isinstance(error, httpx.TransportError)
                        else "throttled"
                        if getattr(error, "code", None) == 429
                        else "provider"
                    )
                    message = (
                        "Provider request timed out"
                        if failure_kind == "timeout"
                        else self.credentials.redact(str(error))[:500]
                        or type(error).__name__
                    )
                    if attempt < 2 and retryable:
                        self.store.request_update(
                            request_id,
                            "backoff",
                            {
                                "attempt": attempt + 1,
                                **(
                                    {"http_status": error.code}
                                    if getattr(error, "code", None) is not None
                                    else {}
                                ),
                                "failure_kind": failure_kind,
                            },
                            error=message,
                        )
                        row = self.store.one(
                            "SELECT session_id,character_id FROM requests WHERE id=?",
                            (request_id,),
                        )
                        self.store.log(
                            row["session_id"],
                            "WARNING",
                            f"{message}; retry {attempt + 2} scheduled.",
                            row["character_id"],
                            request_id,
                        )
                        await asyncio.sleep(min(8, 2**attempt + random.random()))
                    else:
                        self.store.request_update(
                            request_id,
                            "error",
                            {
                                "duration_ms": round(
                                    (time.monotonic() - started) * 1000
                                ),
                                **(
                                    {"http_status": error.code}
                                    if getattr(error, "code", None) is not None
                                    else {}
                                ),
                                "failure_kind": failure_kind,
                            },
                            self.credentials.redact(reasoning),
                            error=message,
                        )
                        raise ProviderError(message) from None

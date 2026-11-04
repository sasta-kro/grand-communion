import asyncio
import json
from pathlib import Path
import httpx
import pytest
from backend.app import create_app
from backend.engine import split_speech, public_message
from backend.models import Provider, Injection, Settings
from backend.provider import ProviderError, parse_json
from backend.store import uid


@pytest.fixture
async def app(tmp_path):
    app = create_app(tmp_path)
    async with app.router.lifespan_context(app):
        yield app


def make_session(app, mock=True):
    store = app.state.store
    scenario = store.entity("scenarios", "lantern")
    if mock:
        for char in scenario["cast"]:
            char["provider_id"] = "mock"
    config = {
        "cooldown": 0.5,
        "global_gap": 0.02,
        "narrator_enabled": False,
        "narrator_provider": "mock",
    }
    return store.create_session(
        scenario, "Test world", config, store.entities("personas")
    )


async def test_autonomous_loop_pause_and_single_runtime(app):
    id = make_session(app)
    engine, store = app.state.engine, app.state.store
    await engine.start(id)
    runtime = engine.runtimes[id]
    await engine.start(id)
    assert engine.runtimes[id] is runtime
    await asyncio.sleep(1.8)
    assert len(store.requests(id)) >= 6
    assert store.messages(id)
    assert len({r["character_id"] for r in store.requests(id)}) == 6
    await engine.pause(id)
    count = len(store.messages(id))
    await asyncio.sleep(0.3)
    assert len(store.messages(id)) == count
    assert not engine.runtimes
    assert store.session(id)["status"] == "paused"


async def test_private_context_and_operator_projection(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    chars = store.characters(id)
    own, other = chars[:2]
    store.write_memory(own, "I alone remember PRIVATE_MEMORY_NERA.", 0)
    store.write_memory(other, "I alone remember PRIVATE_MEMORY_OREN.", 0)
    await engine.inject(
        store.session(id),
        Injection(name="Anonymous voice", text="A bell rings below the water."),
    )
    context = engine.context(
        store.session(id), store.character(own["id"]), store.cutoff(id)
    )
    text = json.dumps(context)
    assert "PRIVATE_MEMORY_NERA" in text
    assert "PRIVATE_MEMORY_OREN" not in text
    assert other["background"] not in text
    assert "controller" not in text
    assert "operator-" not in text
    assert "Anonymous voice" in text
    assert public_message(store.messages(id)[0])["author_id"] is None
    projection = public_message(store.messages(id)[0])
    assert "time" in projection and "at" not in projection
    assert "time" not in public_message(store.messages(id)[0], include_time=False)


async def test_global_speech_rules_follow_settings_even_for_saved_worlds(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    cfg = engine.settings().model_copy(update={"speech_rules": "Use plain periods."})
    store.set_setting("settings", cfg.model_dump())
    snapshot = store.snapshot(id, "Rules test")
    body = json.loads(
        store.one("SELECT body FROM snapshots WHERE id=?", (snapshot,))["body"]
    )
    assert "speech_rules" not in body["session"]["config"]
    # Older or external saves cannot freeze their own copy of these rules.
    body["session"]["config"]["speech_rules"] = "Use obsolete punctuation."
    body["session"]["config"]["forbidden_punctuation"] = []
    restored = store.restore(body)
    cfg.speech_rules = "Use no colons or semicolons."
    store.set_setting("settings", cfg.model_dump())
    for session_id in (id, restored):
        for char in store.characters(session_id):
            context = engine.context(
                store.session(session_id), char, store.cutoff(session_id)
            )
            assert cfg.speech_rules in "\n".join(
                m["content"] for m in context if m["role"] == "system"
            )
            assert "obsolete punctuation" not in json.dumps(context)


async def test_save_restore_and_memory_isolation(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    await engine.inject(
        store.session(id),
        Injection(
            author_id=store.characters(id)[0]["id"],
            text="I will keep the west lamp burning.",
        ),
    )
    first = store.messages(id)[0]
    await engine.inject(
        store.session(id),
        Injection(name="Bystander", text="I heard your promise.", reply_to=first["id"]),
    )
    char = store.characters(id)[0]
    store.write_memory(char, "I promised to tend the west lamp.", first["id"])
    snapshot = store.snapshot(id, "Before dawn")
    body = json.loads(
        store.one("SELECT body FROM snapshots WHERE id=?", (snapshot,))["body"]
    )
    restored = store.restore(body)
    assert restored != id
    assert len(store.messages(restored)) == 2
    assert store.messages(restored)[1]["reply_to"] == store.messages(restored)[0]["id"]
    new_char = store.characters(restored)[0]
    assert new_char["id"] != char["id"]
    assert store.memory(new_char) == "I promised to tend the west lamp."
    assert new_char["memory_cutoff"] == store.messages(restored)[0]["id"]
    assert store.session(restored)["status"] == "paused"
    assert "api_key" not in json.dumps(body)


async def test_compaction_keeps_transcript_and_narrator_does_not_enter_context(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    for i in range(8):
        await engine.inject(
            store.session(id),
            Injection(
                name="A bystander", text=f"I offer a personal prayer for traveller {i}."
            ),
        )
    char = store.characters(id)[0]
    await engine.compact(store.session(id), char, store.cutoff(id), True)
    updated = store.character(char["id"])
    assert updated["memory_rev"]
    assert store.memory(updated).startswith("I ")
    assert len(store.messages(id)) == 8
    assert updated["memory_cutoff"] < store.cutoff(id)
    recap_id = await engine.recap(id)
    assert store.one("SELECT id FROM recaps WHERE id=?", (recap_id,))
    assert len(store.messages(id)) == 8
    assert "Around the gathering" not in json.dumps(
        engine.context(store.session(id), updated, store.cutoff(id))
    )


async def test_late_publication_and_duplicates_are_rejected(app):
    id = make_session(app)
    store = app.state.store
    session = store.session(id)
    m = {"name": "Nera", "text": "A quiet prayer.", "request_id": uid()}
    assert store.publish(id, session["epoch"], m)
    assert store.publish(id, session["epoch"], m) is None
    await app.state.engine.pause(id)
    assert store.publish(id, session["epoch"], {**m, "request_id": uid()}) is None


async def test_provider_stream_reasoning_usage_and_low_setting(app):
    observed = {}

    def handle(request):
        observed.update(json.loads(request.content))
        events = [
            {"choices": [{"delta": {"reasoning_content": "A private deliberation."}}]},
            {
                "choices": [
                    {
                        "delta": {"content": '{"action":"no_response"}'},
                        "finish_reason": "stop",
                    }
                ]
            },
            {"choices": [], "usage": {"prompt_tokens": 50, "completion_tokens": 20}},
        ]
        return httpx.Response(
            200,
            text="".join("data: " + json.dumps(e) + "\n\n" for e in events)
            + "data: [DONE]\n\n",
        )

    engine, store = app.state.engine, app.state.store
    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
    id = make_session(app)
    profile = Provider(
        id="fixture",
        base_url="http://local-test",
        model="glm-5.3",
        key_env="UNSET_TEST_KEY",
        reasoning_effort="low",
    )
    context = [{"role": "user", "content": "Hear the room."}]
    rid = engine.begin(
        store.session(id), store.characters(id)[0], "character", 0, context, profile
    )
    result = await engine.gateway.generate(profile, context, "character", rid)
    assert parse_json(result)["action"] == "no_response"
    assert observed["reasoning_effort"] == "low"
    row = store.requests(id)[0]
    assert row["reasoning"] == "A private deliberation."
    assert row["metrics"]["usage"]["input_tokens"] == 50
    settings = engine.settings().model_copy(update={"capture_reasoning": False})
    store.set_setting("settings", settings.model_dump())
    rid = engine.begin(store.session(id), None, "narrator", 0, context, profile)
    await engine.gateway.generate(profile, context, "narrator", rid)
    assert store.requests(id)[0]["reasoning"] == ""


async def test_truncation_is_an_error_not_silence(app):
    def handle(request):
        return httpx.Response(
            200,
            text="data: "
            + json.dumps(
                {
                    "choices": [
                        {
                            "delta": {"reasoning_content": "Still thinking"},
                            "finish_reason": "length",
                        }
                    ]
                }
            )
            + "\n\ndata: [DONE]\n\n",
        )

    engine, store = app.state.engine, app.state.store
    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
    id = make_session(app)
    p = Provider(id="fixture", base_url="http://local-test", key_env="UNSET_TEST_KEY")
    context = [{"role": "user", "content": "test"}]
    rid = engine.begin(store.session(id), None, "character", 0, context, p)
    with pytest.raises(ProviderError, match="allowance"):
        await engine.gateway.generate(p, context, "character", rid)
    assert store.requests(id)[0]["status"] == "error"


async def test_api_and_history_pagination(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        assert (await client.get("/api/health")).status_code == 200
        boot = (await client.get("/api/bootstrap")).json()
        assert len(boot["scenarios"]) == 3
        id = make_session(app)
        for i in range(12):
            await app.state.engine.inject(
                app.state.store.session(id), Injection(text=f"A voice says {i}.")
            )
        rows = (
            await client.get(f"/api/sessions/{id}/messages?before=9&limit=3")
        ).json()
        assert [r["id"] for r in rows] == [7, 8, 9]
        assert "controller" not in rows[0]
        assert (
            await client.post(
                f"/api/sessions/{id}/messages",
                json={"text": "Hello", "reply_to": 999999},
            )
        ).status_code == 400


async def test_reply_previews_cross_history_boundaries_without_crossing_sessions(app):
    store, engine = app.state.store, app.state.engine
    id = make_session(app)
    other = make_session(app)
    session = store.session(id)
    original = "A long original message " * 18
    first = store.publish(
        id, session["epoch"],
        {"name": "Mara", "text": original, "request_id": uid()},
    )
    for index in range(201):
        store.publish(
            id, session["epoch"],
            {"name": "Bystander", "text": f"Observation {index}", "request_id": uid()},
        )
    await engine.inject(
        session,
        Injection(name="Iven", text="I remember those words.", reply_to=first),
    )
    foreign = store.publish(
        other, store.session(other)["epoch"],
        {"name": "Private other world", "text": "Do not expose this.", "request_id": uid()},
    )
    # A damaged imported reference must not expose another world's speech.
    store.publish(
        id, session["epoch"],
        {
            "name": "Bystander", "text": "Broken reference",
            "reply_to": foreign, "request_id": uid(),
        },
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        scene = (await client.get(f"/api/sessions/{id}")).json()
        assert first not in {m["id"] for m in scene["messages"]}
        reply = scene["messages"][-2]
        assert reply["reply_preview"] == {
            "id": first, "name": "Mara", "text": original[:260], "truncated": True,
        }
        rows = (
            await client.get(f"/api/sessions/{id}/messages?after={reply['id'] - 1}")
        ).json()
        assert rows[0]["reply_preview"] == reply["reply_preview"]
        assert rows[-1]["reply_preview"] is None
        assert "controller" not in reply
        assert "reply_preview" not in public_message(store.messages(id)[-2])


def test_mechanical_split_bounds_each_part():
    parts = split_speech(
        "One two three four five six seven eight. Nine ten eleven twelve.", 5, 3
    )
    assert len(parts) == 3
    assert all(len(p.split()) <= 5 for p in parts)
    assert (
        " ".join(parts)
        == "One two three four five six seven eight. Nine ten eleven twelve."
    )


async def test_restart_pauses_by_default_and_autoresume_is_configurable(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    store.execute("UPDATE sessions SET status='running' WHERE id=?", (id,))
    await engine.boot()
    assert store.session(id)["status"] == "paused"
    assert not engine.runtimes
    cfg = engine.settings().model_copy(update={"auto_resume": True})
    store.set_setting("settings", cfg.model_dump())
    store.execute("UPDATE sessions SET status='running' WHERE id=?", (id,))
    await engine.boot()
    assert id in engine.runtimes
    await engine.pause(id)


async def test_late_character_does_not_inherit_previous_observations(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    await engine.inject(
        store.session(id), Injection(text="This happened before the newcomer arrived.")
    )
    cutoff = store.cutoff(id)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        result = await client.post(
            f"/api/sessions/{id}/characters",
            json={
                "name": "Newcomer",
                "role": "Visitor",
                "background": "I just arrived.",
                "persona_id": "keeper",
                "persona": "I have my own custom disposition.",
                "provider_id": "mock",
            },
        )
        assert result.status_code == 200
        char = store.character(result.json()["id"])
        assert char["memory_cutoff"] == cutoff
        assert char["persona"] == "I have my own custom disposition."
        assert "before the newcomer arrived" not in json.dumps(
            engine.context(store.session(id), char, cutoff)
        )


async def test_retry_classification_and_ollama_contract(app, monkeypatch):
    real_sleep = asyncio.sleep

    async def fast_sleep(_):
        await real_sleep(0)

    monkeypatch.setattr("backend.provider.asyncio.sleep", fast_sleep)
    attempts = []

    def handle(request):
        attempts.append(json.loads(request.content))
        if len(attempts) == 1:
            return httpx.Response(429, json={"error": {"message": "slow down"}})
        return httpx.Response(
            200,
            text="data: "
            + json.dumps(
                {
                    "choices": [
                        {
                            "delta": {"content": '{"action":"no_response"}'},
                            "finish_reason": "stop",
                        }
                    ]
                }
            )
            + "\n\ndata: [DONE]\n\n",
        )

    engine, store = app.state.engine, app.state.store
    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
    id = make_session(app)
    profile = Provider(
        id="fixture", base_url="http://local-test", key_env="UNSET_TEST_KEY"
    )
    context = [{"role": "user", "content": "Hear the conversation."}]
    rid = engine.begin(store.session(id), None, "character", 0, context, profile)
    await engine.gateway.generate(profile, context, "character", rid)
    row = store.requests(id)[0]
    assert len(attempts) == 2 and row["status"] == "completed"
    assert (
        row["metrics"]["attempt"] == 2 and row["metrics"]["failure_kind"] == "throttled"
    )
    assert row["error"] == ""
    assert store.one("SELECT id FROM logs WHERE level='WARNING'")

    def ollama(request):
        data = json.loads(request.content)
        assert data["options"]["num_ctx"] == 32768
        return httpx.Response(
            200,
            text=json.dumps(
                {
                    "message": {
                        "thinking": "A thought.",
                        "content": '{"action":"no_response"}',
                    },
                    "done": True,
                    "prompt_eval_count": 17,
                    "eval_count": 9,
                }
            )
            + "\n",
        )

    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(ollama))
    profile = profile.model_copy(update={"protocol": "ollama", "context_tokens": 32768})
    rid = engine.begin(store.session(id), None, "character", 0, context, profile)
    assert (
        parse_json(await engine.gateway.generate(profile, context, "character", rid))[
            "action"
        ]
        == "no_response"
    )
    assert store.requests(id)[0]["metrics"]["usage"]["input_tokens"] == 17


async def test_timeout_is_reported_and_never_published(app, monkeypatch):
    real_sleep = asyncio.sleep

    async def fast_sleep(_):
        await real_sleep(0)

    monkeypatch.setattr("backend.provider.asyncio.sleep", fast_sleep)

    def timeout(request):
        raise httpx.ReadTimeout("")

    engine, store = app.state.engine, app.state.store
    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(timeout))
    id = make_session(app)
    p = Provider(id="fixture", base_url="http://local-test", key_env="UNSET_TEST_KEY")
    context = [{"role": "user", "content": "test"}]
    rid = engine.begin(store.session(id), None, "character", 0, context, p)
    with pytest.raises(ProviderError, match="timed out"):
        await engine.gateway.generate(p, context, "character", rid)
    assert store.requests(id)[0]["metrics"]["failure_kind"] == "timeout"
    assert not store.messages(id)


async def test_model_output_rejects_malformed_json_without_publishing(app):
    from backend.models import NoResponse
    from pydantic import ValidationError

    with pytest.raises(json.JSONDecodeError):
        parse_json("This is not JSON")
    with pytest.raises(ValidationError):
        NoResponse.model_validate({"action": "listen"})
    id = make_session(app)
    assert not app.state.store.messages(id)


async def test_public_narrator_never_reads_private_memory(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    char = store.characters(id)[0]
    store.write_memory(char, "I alone remember NARRATOR_PRIVATE_SENTINEL.", 0)
    await engine.inject(store.session(id), Injection(text="The lamps still burn."))
    seen = []

    async def inspect(profile, context, kind, rid):
        seen.append(json.dumps(context))
        return json.dumps(
            {
                "title": "Quiet lamps",
                "narrative": "The lamps continued to burn.",
                "notable": [],
                "unresolved": [],
            }
        )

    engine.gateway.generate = inspect
    await engine.recap(id, scope="public")
    assert "NARRATOR_PRIVATE_SENTINEL" not in seen[-1]
    await engine.recap(id, scope="private")
    assert "NARRATOR_PRIVATE_SENTINEL" in seen[-1]


async def test_concurrent_recaps_reuse_the_same_completed_window(app):
    id = make_session(app)
    store, engine = app.state.store, app.state.engine
    await engine.inject(store.session(id), Injection(text="The west lamp is steady."))
    first, second = await asyncio.gather(engine.recap(id), engine.recap(id))
    assert first == second
    assert len(store.query("SELECT id FROM recaps WHERE session_id=?", (id,))) == 1
    assert all(
        (store.root / "sessions" / id / "characters" / c["id"] / "memory.md").exists()
        for c in store.characters(id)
    )


@pytest.mark.parametrize("queued", [False, True])
async def test_cancellation_records_cause_and_http_state(app, queued):
    store, engine = app.state.store, app.state.engine
    session_id = make_session(app)
    char = store.characters(session_id)[0]
    profile = Provider(
        id="test", base_url="https://provider.invalid", requires_key=False
    )
    context = engine.context(store.session(session_id), char, 0)
    request_id = engine.begin(
        store.session(session_id), char, "character", 0, context, profile
    )
    streaming = asyncio.Event()

    class WaitingStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'data: {"choices":[{"delta":{"reasoning_content":"A partial thought."}}]}\n\n'
            streaming.set()
            await asyncio.Event().wait()

    async def respond(request):
        return httpx.Response(200, stream=WaitingStream())

    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    if queued:
        engine.gateway.limiter.active = engine.settings().max_concurrency
    task = asyncio.create_task(
        engine.gateway.generate(profile, context, "character", request_id)
    )
    if queued:
        await asyncio.sleep(0)
    else:
        await asyncio.wait_for(streaming.wait(), 1)
    task.cancel("session_paused")
    with pytest.raises(asyncio.CancelledError):
        await task
    row = next(row for row in store.requests(session_id) if row["id"] == request_id)
    assert row["status"] == "cancelled"
    assert row["metrics"]["cancel_reason"] == "session_paused"
    assert row["metrics"]["elapsed_ms"] >= 0
    if queued:
        assert not row["metrics"].get("http_status")
    else:
        assert row["metrics"]["http_status"] == 200
        assert "partial thought" in row["reasoning"]


@pytest.mark.parametrize("kind", ["character", "memory", "narrator"])
@pytest.mark.parametrize("protocol", ["openai", "ollama"])
async def test_global_policy_is_sent_by_every_request_path(app, kind, protocol):
    from backend.writing_policy import POLICY_MARKER, WritingPolicy

    engine, store = app.state.engine, app.state.store
    settings = engine.settings().model_copy(
        update={"speech_rules": "WRITING_RULE_SENTINEL"}
    )
    store.set_setting("settings", settings.model_dump())
    id = make_session(app)
    char = store.characters(id)[0]
    profile = Provider(id="test", protocol=protocol, requires_key=False)
    result = {
        "action": "speak",
        "text": "I remember the promise.",
        "addressees": ["Name:North"],
    }
    seen = []

    def respond(request):
        payload = json.loads(request.content)
        seen.append(payload)
        content = json.dumps(result)
        if protocol == "openai":
            return httpx.Response(
                200,
                text="data: "
                + json.dumps(
                    {
                        "choices": [
                            {"delta": {"content": content}, "finish_reason": "stop"}
                        ]
                    }
                )
                + "\n\ndata: [DONE]\n\n",
            )
        return httpx.Response(
            200, text=json.dumps({"message": {"content": content}, "done": True}) + "\n"
        )

    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    context = [
        {"role": "system", "content": "Base instructions."},
        {"role": "user", "content": "My observations."},
    ]
    rid = engine.begin(store.session(id), char, kind, 0, context, profile)
    assert (
        parse_json(await engine.gateway.generate(profile, context, kind, rid)) == result
    )
    policy_messages = [
        m for m in seen[0]["messages"] if m["content"].startswith(POLICY_MARKER)
    ]
    assert len(policy_messages) == 1
    assert "WRITING_RULE_SENTINEL" in policy_messages[0]["content"]
    assert "narration" in policy_messages[0]["content"]
    assert "memories" in policy_messages[0]["content"]
    assert (
        store.requests(id)[0]["metrics"]["writing_policy"]
        == WritingPolicy(settings).fingerprint
    )


@pytest.mark.parametrize("kind", ["character", "memory", "narrator"])
async def test_prose_violations_are_corrected_before_return(app, kind):
    from backend.writing_policy import WritingPolicy

    engine, store = app.state.engine, app.state.store
    id = make_session(app)
    char = store.characters(id)[0]
    profile = Provider(id="test", requires_key=False)
    if kind == "character":
        bad = {
            "action": "speak",
            "text": "I wait\u2014here; until dawn: quietly.",
            "addressees": ["Name:North"],
        }
        good = {**bad, "text": "I wait here until dawn, quietly."}
    elif kind == "memory":
        bad, good = (
            {"memory": "I wait\u2014here; until dawn: quietly."},
            {"memory": "I wait here until dawn, quietly."},
        )
    else:
        bad = {
            "title": "The vigil",
            "narrative": "I wait\u2014here; until dawn: quietly.",
            "notable": [{"text": "A promise was made.", "message_ids": [1]}],
            "unresolved": [],
        }
        good = {**bad, "narrative": "I wait here until dawn, quietly."}
    payloads = []

    def respond(request):
        payloads.append(json.loads(request.content))
        content = json.dumps(bad if len(payloads) == 1 else good)
        return httpx.Response(
            200,
            text="data: "
            + json.dumps(
                {"choices": [{"delta": {"content": content}, "finish_reason": "stop"}]}
            )
            + "\n\ndata: "
            + json.dumps(
                {"choices": [], "usage": {"prompt_tokens": 50, "completion_tokens": 20}}
            )
            + "\n\ndata: [DONE]\n\n",
        )

    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    context = [{"role": "user", "content": "My observations."}]
    rid = engine.begin(store.session(id), char, kind, 0, context, profile)
    value = parse_json(await engine.gateway.generate(profile, context, kind, rid))
    assert value == good
    assert not WritingPolicy(engine.settings()).violations(value)
    assert len(payloads) == 2
    assert "corrected JSON" in payloads[1]["messages"][-1]["content"]
    metrics = store.requests(id)[0]["metrics"]
    assert metrics["policy_retries"] == 1
    assert metrics["generation_calls"] == 2
    assert metrics["usage"]["input_tokens"] == 100
    assert metrics["usage"]["output_tokens"] == 40


async def test_repeated_writing_violation_is_an_error_not_accepted_prose(app):
    engine, store = app.state.engine, app.state.store
    id = make_session(app)
    char = store.characters(id)[0]
    profile = Provider(id="test", requires_key=False)

    def respond(request):
        content = json.dumps({"memory": "I remember: a promise; a debt."})
        return httpx.Response(
            200,
            text="data: "
            + json.dumps(
                {"choices": [{"delta": {"content": content}, "finish_reason": "stop"}]}
            )
            + "\n\ndata: [DONE]\n\n",
        )

    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    context = [{"role": "user", "content": "My observations."}]
    rid = engine.begin(store.session(id), char, "memory", 0, context, profile)
    with pytest.raises(ProviderError, match="global punctuation"):
        await engine.gateway.generate(profile, context, "memory", rid)
    assert store.requests(id)[0]["status"] == "error"
    assert not store.messages(id)


async def test_recap_cache_changes_with_global_policy_and_narrator_is_manual(app):
    from backend.models import LEGACY_SPEECH_RULES, DEFAULT_WRITING_RULES

    assert not Settings().narrator_enabled
    assert (
        Settings(speech_rules=LEGACY_SPEECH_RULES).speech_rules == DEFAULT_WRITING_RULES
    )
    id = make_session(app)
    engine, store = app.state.engine, app.state.store
    await engine.inject(store.session(id), Injection(text="A promise was made."))
    first = await engine.recap(id)
    assert await engine.recap(id) == first
    config = engine.settings().model_copy(
        update={"speech_rules": "Use short sentences."}
    )
    store.set_setting("settings", config.model_dump())
    second = await engine.recap(id)
    assert first != second
    assert await engine.recap(id, force=True) != second


async def test_rules_changed_during_generation_are_applied_before_acceptance(app):
    from backend.writing_policy import WritingPolicy

    engine, store = app.state.engine, app.state.store
    id = make_session(app)
    char = store.characters(id)[0]
    profile = Provider(id="test", requires_key=False)
    payloads = []
    latest = engine.settings().model_copy(
        update={"speech_rules": "LATEST_POLICY_SENTINEL"}
    )

    def respond(request):
        payloads.append(json.loads(request.content))
        if len(payloads) == 1:
            store.set_setting("settings", latest.model_dump())
        content = json.dumps({"action": "speak", "text": "I remember a promise."})
        return httpx.Response(
            200,
            text="data: "
            + json.dumps(
                {"choices": [{"delta": {"content": content}, "finish_reason": "stop"}]}
            )
            + "\n\ndata: [DONE]\n\n",
        )

    await engine.gateway.client.aclose()
    engine.gateway.client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    context = [{"role": "user", "content": "My observations."}]
    rid = engine.begin(store.session(id), char, "character", 0, context, profile)
    await engine.gateway.generate(profile, context, "character", rid)
    assert len(payloads) == 2
    assert "LATEST_POLICY_SENTINEL" in json.dumps(payloads[1]["messages"])
    assert (
        store.requests(id)[0]["metrics"]["writing_policy"]
        == WritingPolicy(latest).fingerprint
    )

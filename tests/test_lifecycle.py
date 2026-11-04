import asyncio
import json

import httpx
import pytest
from test_engine import make_session

from backend.app import create_app
from backend.models import Injection
from backend.seed import seed


@pytest.fixture
async def app(tmp_path):
    app = create_app(tmp_path)
    async with app.router.lifespan_context(app):
        yield app


@pytest.fixture
async def client(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver/api"
    ) as client:
        yield client


async def test_archive_stops_session_hides_it_and_restores_paused(app, client):
    id = make_session(app)
    await app.state.engine.start(id)
    assert (await client.post(f"/sessions/{id}/archive", json={})).status_code == 200
    assert id not in app.state.engine.runtimes
    assert app.state.store.session(id)["status"] == "paused"
    assert id not in {
        s["id"] for s in (await client.get("/bootstrap")).json()["sessions"]
    }
    assert id in {s["id"] for s in (await client.get("/sessions?archived=true")).json()}
    assert (await client.post(f"/sessions/{id}/start")).status_code == 400
    assert (await client.get(f"/sessions/{id}")).json()["archived"] is True
    await client.post(f"/sessions/{id}/archive", json={"archived": False})
    assert (await client.get(f"/sessions/{id}")).json()["archived"] is False
    assert app.state.store.session(id)["status"] == "paused"


async def test_delete_is_session_scoped_and_keeps_templates_and_forks(app, client):
    store = app.state.store
    id = make_session(app)
    other = make_session(app)
    await app.state.engine.inject(
        store.session(id), Injection(text="Keep this in the independent fork.")
    )
    fork = (await client.post(f"/sessions/{id}/fork", json={})).json()["id"]
    store.snapshot(id, "A checkpoint")
    personas = store.entities("personas")
    scenarios = store.entities("scenarios")
    await app.state.engine.start(id)
    response = await client.delete(f"/sessions/{id}")
    assert response.status_code == 200
    await asyncio.sleep(0.1)
    assert not store.session(id)
    assert not (store.root / "sessions" / id).exists()
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
        assert not store.query(f"SELECT * FROM {table} WHERE session_id=?", (id,))
    assert store.session(other) and store.session(fork)
    assert store.messages(fork)[0]["text"] == "Keep this in the independent fork."
    assert store.entities("personas") == personas
    assert store.entities("scenarios") == scenarios
    assert (await client.delete(f"/sessions/{id}")).status_code == 404


async def test_library_archive_delete_and_no_reseeding(app, client):
    store = app.state.store
    id = make_session(app)
    await client.post("/scenarios/lantern/archive", json={})
    assert "lantern" not in {
        s["id"] for s in (await client.get("/bootstrap")).json()["scenarios"]
    }
    assert "lantern" in {
        s["id"] for s in (await client.get("/library/scenarios?archived=true")).json()
    }
    assert (
        await client.post("/sessions", json={"scenario_id": "lantern"})
    ).status_code == 409
    await client.post("/scenarios/lantern/archive", json={"archived": False})
    prompt = store.entity("personas", "keeper")["prompt"]
    assert (await client.delete("/personas/keeper")).status_code == 200
    scenario = store.entity("scenarios", "lantern")
    keeper = next(c for c in scenario["cast"] if c["name"] == "Nera")
    assert keeper["persona_id"] == "" and keeper["persona"] == prompt
    new = (await client.post("/sessions", json={"scenario_id": "lantern"})).json()["id"]
    assert store.characters(new)[0]["persona"] == prompt
    for kind in ("personas", "scenarios"):
        for item in store.entities(kind):
            assert (await client.delete(f"/{kind}/{item['id']}")).status_code == 200
    seed(store)
    assert store.entities("personas") == []
    assert store.entities("scenarios") == []
    assert store.characters(id)[0]["persona"] == prompt
    assert store.session(id)["scenario"]["premise"]


async def test_historical_fork_has_no_future_memory_cast_or_profile_edits(app, client):
    store, engine = app.state.store, app.state.engine
    id = make_session(app)
    original = store.characters(id)[0]
    store.write_memory(original, "I remember only the old bell.", 0)
    await engine.inject(
        store.session(id),
        Injection(author_id=original["id"], text="The bell is still ringing."),
    )
    first = store.cutoff(id)
    await engine.inject(
        store.session(id),
        Injection(text="I can hear it.", reply_to=first, addressees=[original["id"]]),
    )
    point = store.cutoff(id)
    await client.put(
        f"/sessions/{id}/characters/{original['id']}",
        json={
            **original,
            "persona": "FUTURE_PERSONA",
            "background": "FUTURE_BACKGROUND",
        },
    )
    await client.post(
        f"/sessions/{id}/characters",
        json={"name": "Future visitor", "provider_id": "mock"},
    )
    await engine.inject(store.session(id), Injection(text="FUTURE_MESSAGE"))
    store.write_memory(
        store.character(original["id"]), "I remember FUTURE_MEMORY.", store.cutoff(id)
    )
    result = await client.post(
        f"/sessions/{id}/fork", json={"message_id": point, "name": "Earlier branch"}
    )
    assert result.status_code == 200, result.text
    fork = result.json()["id"]
    branch = (await client.get(f"/sessions/{fork}")).json()
    assert branch["status"] == "paused" and branch["name"] == "Earlier branch"
    assert len(branch["characters"]) == 6 and len(branch["messages"]) == 2
    assert "FUTURE_" not in json.dumps(branch)
    assert branch["characters"][0]["memory"] == "I remember only the old bell."
    assert branch["messages"][1]["reply_to"] == branch["messages"][0]["id"]
    assert branch["messages"][1]["addressees"] == [branch["characters"][0]["id"]]
    assert branch["messages"][0]["author_id"] == branch["characters"][0]["id"]
    assert store.cutoff(id) > point and len(store.characters(id)) == 7
    assert branch["metadata"]["forked_from"] == id
    # Historical states survive a native save round trip.
    saved = store.snapshot(id, "With historical state")
    loaded = (await client.post(f"/saves/{saved}/load")).json()["id"]
    old_point = store.messages(loaded)[1]["id"]
    again = await client.post(
        f"/sessions/{loaded}/fork", json={"message_id": old_point}
    )
    assert again.status_code == 200, again.text
    again_scene = (await client.get("/sessions/" + again.json()["id"])).json()
    assert "FUTURE_" not in json.dumps(again_scene)


async def test_legacy_fork_warns_and_rebuilds_from_opening_without_future_memories(
    app, client
):
    store, engine = app.state.store, app.state.engine
    id = make_session(app)
    await engine.inject(store.session(id), Injection(text="An early remark."))
    point = store.cutoff(id)
    await engine.inject(store.session(id), Injection(text="FUTURE_MESSAGE"))
    char = store.characters(id)[0]
    store.write_memory(char, "I remember FUTURE_MEMORY.", store.cutoff(id))
    store.execute("UPDATE messages SET state_id=NULL WHERE session_id=?", (id,))
    store.execute("DELETE FROM state_history WHERE session_id=?", (id,))
    result = await client.post(f"/sessions/{id}/fork", json={"message_id": point})
    assert result.status_code == 200, result.text
    assert result.json()["warnings"] == ["opening_setup"]
    branch = (await client.get("/sessions/" + result.json()["id"])).json()
    assert "FUTURE_" not in json.dumps(branch)
    assert branch["characters"][0]["persona"] == ""
    assert branch["characters"][0]["memory_cutoff"] == 0
    assert len(branch["messages"]) == 1


async def test_fork_validation_rename_and_checkpoint_delete(app, client):
    store = app.state.store
    id = make_session(app)
    other = make_session(app)
    await app.state.engine.inject(store.session(other), Injection(text="Other world."))
    bad = await client.post(
        f"/sessions/{id}/fork", json={"message_id": store.cutoff(other)}
    )
    assert bad.status_code == 400
    assert len(store.query("SELECT id FROM sessions")) == 2
    assert (await client.put(f"/sessions/{id}", json={"name": "  New name  "})).json()[
        "name"
    ] == "New name"
    assert (await client.put(f"/sessions/{id}", json={"name": "  "})).status_code == 400
    saved = store.snapshot(id, "Disposable checkpoint")
    assert (await client.delete(f"/saves/{saved}")).status_code == 200
    assert (await client.get(f"/saves/{saved}")).status_code == 404
    assert store.session(id)


async def test_legacy_fork_uses_earlier_checkpoint_and_opening_can_be_forked(
    app, client
):
    store, engine = app.state.store, app.state.engine
    id = make_session(app)
    original = store.characters(id)[0]
    store.write_memory(
        original, "I remember a promise made before the conversation.", 0
    )
    await engine.inject(store.session(id), Injection(text="First remark."))
    opening = await client.post(f"/sessions/{id}/fork", json={"message_id": 0})
    assert opening.status_code == 200, opening.text
    empty = (await client.get("/sessions/" + opening.json()["id"])).json()
    assert empty["messages"] == []
    assert "promise made before" in empty["characters"][0]["memory"]
    store.snapshot(id, "Before later changes")
    await engine.inject(store.session(id), Injection(text="Second remark."))
    point = store.cutoff(id)
    await engine.inject(store.session(id), Injection(text="FUTURE_MESSAGE"))
    store.write_memory(original, "FUTURE_MEMORY", store.cutoff(id))
    store.execute("UPDATE messages SET state_id=NULL WHERE session_id=?", (id,))
    result = await client.post(f"/sessions/{id}/fork", json={"message_id": point})
    assert result.json()["warnings"] == ["earlier_save"]
    branch = (await client.get("/sessions/" + result.json()["id"])).json()
    assert len(branch["messages"]) == 2
    assert "FUTURE_" not in json.dumps(branch)


async def test_character_removal_preserves_history_and_prior_fork(app, client):
    store, engine = app.state.store, app.state.engine
    id = make_session(app)
    original = store.characters(id)[0]
    await engine.inject(
        store.session(id),
        Injection(author_id=original["id"], text="Remember my words."),
    )
    point = store.cutoff(id)
    assert (
        await client.delete(f"/sessions/{id}/characters/{original['id']}")
    ).status_code == 200
    assert not store.character(original["id"])
    assert store.messages(id)[0]["name"] == original["name"]
    result = await client.post(f"/sessions/{id}/fork", json={"message_id": point})
    branch = (await client.get("/sessions/" + result.json()["id"])).json()
    assert len(branch["characters"]) == 6
    assert branch["characters"][0]["name"] == original["name"]


async def test_legacy_save_at_target_does_not_smuggle_later_private_edits(app, client):
    store, engine = app.state.store, app.state.engine
    id = make_session(app)
    await engine.inject(store.session(id), Injection(text="The fork point."))
    point = store.cutoff(id)
    char = store.characters(id)[0]
    await client.put(
        f"/sessions/{id}/characters/{char['id']}",
        json={**char, "background": "FUTURE_PRIVATE_EDIT"},
    )
    store.snapshot(id, "A later edit without new speech")
    await engine.inject(store.session(id), Injection(text="FUTURE_MESSAGE"))
    store.execute("UPDATE messages SET state_id=NULL WHERE session_id=?", (id,))
    result = await client.post(f"/sessions/{id}/fork", json={"message_id": point})
    assert result.status_code == 200, result.text
    assert result.json()["warnings"] == ["opening_setup"]
    branch = (await client.get("/sessions/" + result.json()["id"])).json()
    assert "FUTURE_" not in json.dumps(branch)

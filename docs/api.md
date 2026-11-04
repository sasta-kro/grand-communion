# Control Communion without the interface

The browser calls the same HTTP API available to scripts and coding agents. The running process accepts commands over HTTP, rather than reading new command-line arguments after startup. No browser automation is necessary for managing worlds or inspecting diagnostics.

The default origin is `http://127.0.0.1:8010`. Interactive API documentation is available at [/docs](http://127.0.0.1:8010/docs), with the machine-readable schema at [/openapi.json](http://127.0.0.1:8010/openapi.json). Routes that accept raw dictionaries have less detailed generated schemas; use the examples below and the response from bootstrap as references.

## Command-line client

The client uses only Python's standard library. It talks to an already running backend and does not open the database or start another scheduler.

```sh
python3 scripts/communion.py status
python3 scripts/communion.py sessions
python3 scripts/communion.py create lantern --name 'A new vigil'
# Replace SESSION_ID with the returned id.
python3 scripts/communion.py start SESSION_ID
python3 scripts/communion.py pause SESSION_ID
python3 scripts/communion.py say SESSION_ID 'I see a light below.' --name Bystander
python3 scripts/communion.py recap SESSION_ID
```

Recap queues a narrator job. Read its result from `/sessions/SESSION_ID/recaps` or watch the event stream. The built-in scenario IDs are `lantern`, `observatory`, and `floodgate`. Use bootstrap to discover the current IDs instead of assuming they never change.

Any JSON endpoint is accessible through the generic command. Omit the `/api` prefix or include it once.

```sh
python3 scripts/communion.py api GET /bootstrap
python3 scripts/communion.py api GET /sessions/SESSION_ID/requests
python3 scripts/communion.py api PUT /personas/river-keeper \
  --json '{"name":"River keeper","prompt":"I am patient and precise."}'
python3 scripts/communion.py api PUT /scenarios/my-world --file scenario.json
python3 scripts/communion.py --url http://127.0.0.1:8011 status
```

Use `--file -` to read JSON from stdin. Commands print JSON, return nonzero on an HTTP or connection failure, and restrict the destination to a local HTTP origin. Do not put keys into command-line arguments; the backend already loads its own credentials.

## Common endpoints

| Method | Path after `/api` | Purpose |
| --- | --- | --- |
| GET | `/health` | Running sessions, active requests, uptime |
| GET | `/bootstrap` | Settings, provider metadata, personas, scenarios, sessions |
| PUT | `/settings` | Replace the complete global settings object |
| PUT | `/providers/{id}` | Create or update a provider profile |
| PUT | `/personas/{id}` | Create or update a reusable persona |
| PUT | `/scenarios/{id}` | Create or update a reusable scenario |
| GET, POST | `/sessions` | List sessions or create a paused session |
| GET | `/sessions/{id}` | Scene, cast, private memories, recent history, settings |
| POST | `/sessions/{id}/start` | Start autonomous generation |
| POST | `/sessions/{id}/pause` | Pause and invalidate pending speech |
| PUT | `/sessions/{id}/config` | Replace scene overrides, or `{}` to reset them |
| POST | `/sessions/{id}/characters` | Add a new character at the current observation boundary |
| PUT | `/sessions/{id}/characters/{character_id}` | Update one character |
| GET, POST | `/sessions/{id}/messages` | Read history or contribute in-world speech |
| GET | `/sessions/{id}/requests` | Recent request diagnostics |
| GET | `/sessions/{id}/logs` | Structured logs |
| GET, POST | `/sessions/{id}/recaps` | Read reports or queue a narrator report |
| GET, POST | `/sessions/{id}/saves` | List or create named checkpoints |
| GET | `/saves/{id}` | Export a world checkpoint |
| POST | `/saves/{id}/load` | Restore as a separate paused world |
| POST | `/saves/import` | Import a native JSON save |
| GET | `/sessions/{id}/events` | Server-sent event stream with replay cursor |

To edit global settings safely, fetch the current object before replacing it. For example, using the project's installed HTTPX library:

```python
import httpx

with httpx.Client(base_url="http://127.0.0.1:8010/api") as client:
    response = client.get("/bootstrap")
    response.raise_for_status()
    settings = response.json()["settings"]
    settings["speech_rules"] = (
        "Write plainly and follow the configured punctuation restrictions. "
        "Keep the required JSON syntax valid."
    )
    settings["forbidden_punctuation"] = ["em_dash", "semicolon", "colon"]
    client.put("/settings", json=settings).raise_for_status()
```

The API retains the `speech_rules` field name for compatibility, but its scope is now every model request. It is displayed as Global AI rules. Both this field and `forbidden_punctuation` are global and cannot be frozen by a save or overridden by a scene. The shared gateway injects the rules and validates returned prose string values. One correction attempt is allowed before reporting a policy failure. Required JSON punctuation, machine identifiers, and source references are exempt. Arbitrary freeform instructions remain model instructions, while the listed punctuation restrictions receive a hard check.

Request diagnostic metrics now record `http_status` as soon as provider response headers arrive. Missing status is not equivalent to HTTP 200. Cancellation metrics include `cancel_reason`, `cancelled_at`, `elapsed_ms`, and `published_parts`. Causes include `session_paused`, `settings_changed`, `cast_changed`, `server_shutdown`, and a generic `task_cancelled`. Recovery marks previously unfinished requests `interrupted` with `backend_restart`. Older records may lack these metrics; clients should show that absence explicitly.

Session-detail and message-list responses include `reply_preview` for each message. It is either null or an object with the original public message's `id`, `name`, `text` (up to 260 characters), and `truncated` flag. References are resolved within the same session, even if the original falls outside the requested history page. These excerpts are UI metadata and do not change model context or stored messages.

## Future in-app assistant

An assistant could use this API through a small set of tools for inspecting and editing scenarios, personas, characters, and settings. It would edit validated application data through the same service as the interface. It would not need to rewrite its own runtime code. Such an assistant is not included yet.

The current API assumes a trusted local operator and has no authentication. It includes private memories and diagnostic reasoning. Keep the server on localhost and scope any future assistant's tools to the operations and data it actually needs.

Narration is on demand by default. `POST /sessions/{id}/recaps` queues a fresh report by default, with optional `after_id` and `scope` parameters. Pass `force: false` to allow reuse of an identical cached report. Automatic scheduling is opt-in through `narrator_enabled`. Cache signatures include the narrator prompt and global writing policy. Recap responses include `current_policy` so older reports can be identified. Request metrics include `writing_policy`, `policy_retries`, and `generation_calls`.

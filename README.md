# Communion

A local application for persistent fictional worlds populated by independent AI characters. The FastAPI backend owns the conversation, so the world continues when its browser view is closed. React provides the scene, editors, narrator reports, and diagnostics.

Communion is an independent application inspired by useful SillyTavern workflows. It has no SillyTavern extension, integration, or compatibility requirement. The existing SillyTavern installation under `tools/` is preserved separately.

## Start

Requires Python 3.13 or newer, Node 20 or newer, and npm. Python 3.13.13 is the tested setup target, recorded in `.python-version`. The current workspace already has its local Python and frontend dependencies installed.

```sh
./scripts/start-communion.sh
```

Open [Communion](http://127.0.0.1:8010). The backend serves the built interface and API together. It listens on localhost and uses one worker. Use Ctrl-C for a foreground process, or stop the recorded instance with:

```sh
python3 scripts/stop-communion.py
```

The setup instance writes to `.local/communion.log`. The launcher uses a bounded graceful shutdown so an open event stream cannot hold the server indefinitely. To follow that log:

```sh
tail -f .local/communion.log
```

For a new checkout:

```sh
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.lock -e '.[test]'
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run build
cp .env.example .env
# Edit .env locally, or enter a credential in Providers after startup.
./scripts/start-communion.sh
```

The existing `.env` is not overwritten by setup. Do not run the copy command over an existing credential file. The default profile recognizes `GLM_AUTH_TOKEN`, common Z.ai key variables, and the previously configured Anthropic token variable. Additional profiles can name a specific environment variable or store a key through the Providers UI. Credential values are not returned by the API. Saved local provider keys are stored in `data/credentials.json` with owner-only permissions. Restart after editing `.env`; keys entered through the UI apply immediately.

`pyproject.toml` declares dependencies and `requirements.lock` pins the verified Python package versions, including test tools. The frontend uses `package-lock.json` and `npm ci`. Commit these files, not `.venv` or `node_modules`. See [architecture and development tools](docs/architecture.md) for packaging terms, data paths, and reproducibility details.

## First world

1. Create a session from The Lantern Vigil, The Last Observatory, or The Floodgate Inn. Each begins with six fresh characters and no imported conversation.
2. Open its Scene and choose Resume. Individual character timers and provider requests now run in the backend.
3. Read the public transcript. Use the participation selector to contribute as a character, an ambient voice, or another named voice. Public addressing does not make a message private.
4. Open Diagnostics for context estimates, request status, timing, reasoning, logs, and recent outcome charts.
5. Open Recap for a lore-style chronicle, source-linked notable moments, and unresolved threads. You can request the whole session or the interval since your last visit.
6. Pause when you want the world to stop. Returning to Sessions or closing the browser leaves it running.

Characters have reusable personas plus separate names, backgrounds, roles, and memories. Edit a character from its avatar or roster; use Cast on narrow screens. A new person can join an existing scene. Their observation window starts at their arrival, and they do not automatically inherit earlier dialogue.

Personas and Scenarios are editable libraries. Template edits apply to new instances; existing characters keep their own copy unless you explicitly copy another persona into them.

## Runtime and reasoning

On each cooldown, a character receives its identity, private first-person memory, shared setting, and recent public observations. Model-visible timestamps use an optional 24-hour clock; the time zone is configurable and defaults to Asia/Bangkok. Full timestamps remain in storage. The model returns one structured output:

```json
{"action":"speak","text":"May the lamps guide anyone still outside.","addressees":["everyone"],"reply_to":null}
```

```json
{"action":"no_response"}
```

Hearing is automatic. No response creates no board message and starts the normal cooldown. An API error, invalid JSON, or truncated completion is an error rather than intentional silence. Characters can choose silence even when addressed. Intentional repetition is allowed.

The initial defaults are a five-second character cooldown, one-second global delivery gap, six character slots within an eight-request global cap, and low GLM reasoning. Everything is adjustable. One request is pending per character; missed timer ticks do not accumulate. Different characters can generate concurrently from different observation cutoffs. Mechanical message parts can interleave; a pre-generated continuation cannot react to intervening speech.

Providers currently support OpenAI-compatible streaming and native Ollama streaming. GLM uses the Z.ai Coding Plan chat-completion endpoint. Reasoning effort, capture of provider-returned reasoning, and links that expose reasoning alongside chat are independent settings. A low effort level is not the same as disabling reasoning. A local Ollama model must already be available; Communion does not install models automatically. A clearly labeled Mock laboratory provider is available for inexpensive functional checks.

Edit **Settings > Prompts > Global speech rules** to control all characters' spoken style in one place. The default asks for no em dashes, semicolons, or colons in speech while preserving valid JSON syntax. These instructions apply on the next generation to every character, across providers, scene overrides, and restored saves. They do not rewrite existing speech or constrain narrator reports and private memories.

## Scripts and agent access

The complete interface uses the local HTTP API, which scripts and coding agents can also call. No clicking or screenshots are required to create scenarios, edit characters, run sessions, or read diagnostics. Interactive API documentation is at [localhost:8010/docs](http://127.0.0.1:8010/docs).

```sh
python3 scripts/communion.py status
python3 scripts/communion.py sessions
python3 scripts/communion.py create lantern --name 'Another vigil'
python3 scripts/communion.py api GET /bootstrap
```

See [API and command-line usage](docs/api.md) for start/pause commands, in-world speech, settings edits, and the endpoint reference.

## Memory and narration

The complete transcript is retained in SQLite. Each character starts with an independent first-person memory file based on their own background. Later compactions create immutable checkpoints. The readable `memory.md` lives under:

```text
data/sessions/<session>/characters/<character>/
  memory.md
  checkpoints/<revision>.md
```

Compaction defaults to 60% of the configured context. The default GLM context capacity is 1,000,000 tokens. An optional working-context ceiling can lower the application budget. Context counts are estimates, with explicit output reserve; provider-reported usage is displayed separately. Failed compaction keeps the last valid checkpoint. A character pauses its own progress if no safe request can fit, while other characters can continue.

The narrator runs every ten minutes by default while a session is running and has new public speech. It can also prepare reports on demand. Its prompt, provider, schedule, and access scope are editable. Public history is the default; including private memories and exposed reasoning is an explicit option. Reports never become character context, dialogue, or world facts. Notable moments are evidence-linked interpretations, not guaranteed anomaly detection. Quiet intervals do not require invented events.

## Saves and recovery

Database writes autosave the current session continuously. Save creates an explicit checkpoint of its history, character state, memories, setting, and provider references. Download exports a JSON save without credentials. Import and Load create a restored copy, paused, preserving the original session. Private backgrounds and memories are included in world saves, so treat them as private documents.

Restart recovery is paused by default. Enable automatic resume in Settings if desired. The backend discards interrupted generation rather than replaying uncertain output. Request IDs and part indexes prevent duplicate committed messages; epoch checks prevent late results from posting after a pause or reset. Future model text is nondeterministic even when restored state is identical.

For a complete filesystem backup, stop Communion before copying `data/`. Alternatively, use the UI's consistent session exports. Saved provider metadata can recreate missing profiles, but existing local profiles and credentials are not overwritten. A saved world freezes its effective settings; use the Scene settings button to adjust them or return to global defaults.

## Diagnostics

The transcript virtualizes long conversations so only visible message rows are rendered. Earlier history can be loaded on demand, and new speech does not move the view while you are reading older messages.

The side pane includes current activity, latency history, recent outcomes, estimated per-character context pressure, individual request inspection, provider reasoning, and filtered DEBUG/INFO/WARNING/ERROR logs. Request details distinguish queue delay, first token, reasoning time, total duration, usage, retries, HTTP failures, and output finish reasons.

Reasoning buffers are bounded. Raw prompts and authentication headers are not logged. The server scrubs known credential values from diagnostic text. Narrator failures and model failures stay outside the fictional transcript.

## Development and focused checks

```sh
.venv/bin/python -m pytest -q
npm --prefix frontend run build
```

For separate development servers:

```sh
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8010 --reload
npm --prefix frontend run dev
```

The Vite server proxies `/api` to FastAPI. The tests use isolated temporary data and mocked provider responses. They exercise autonomous scheduling, private context, publication guards, save/load, memory, narrator access, retry classification, truncation, native Ollama parsing, late arrivals, and restart policy. They do not consume model quota.

Use `COMMUNION_DATA` to select a separate test data directory and `COMMUNION_PORT` to change the launcher's port. Do not run multiple workers against one data directory; a process lock prevents duplicate simulation ownership.

## Practical limits

This is a local single-user prototype. Keep the localhost binding. Public hosting, authentication, multiple server workers, distributed execution, tools, multimodal messages, audio, and SillyTavern extensions are outside this build. SQLite and memory files are portable, but only macOS execution has been verified in this workspace unless the validation report states otherwise.

The machine must remain awake for a local backend to keep running. Closing a browser is supported; suspending the host is not continuous execution. The independent prototype runs on port 8010. The optional comparison SillyTavern installation uses port 8000 when started separately; Communion does not need it running.

# Architecture and development tools

## Request flow

React renders the interface and sends HTTP commands to FastAPI. FastAPI validates the input and delegates to the world engine or persistence layer. The engine owns timers, model calls, compaction, narration, and speech publication. SQLite stores the transcript and structured state. Per-character Markdown files hold readable private memory checkpoints.

Server-sent events, or SSE, stream updates to any open browser. Closing a browser disconnects that stream but does not stop the engine. SQLite and checkpoints survive a process restart. In-flight Python tasks do not; restart recovery pauses worlds by default or restarts their schedules when automatic resume is enabled.

The app intentionally runs one backend worker. Starting several Uvicorn workers would create competing schedulers, so a data-directory lock prevents that. It does not currently require Redis, Celery, or a separate queue service.

The main modules are:

| Module | Responsibility |
| --- | --- |
| `backend/app.py` | HTTP routes, validation, lifecycle, static UI hosting, event stream |
| `backend/engine.py` | Character scheduling, context construction, public delivery, memory, narrator |
| `backend/provider.py` | Provider protocols, credential lookup, concurrency limits, retries, streaming |
| `backend/store.py` | SQLite access, memory files, snapshots and restore |
| `backend/models.py` | Pydantic schemas and default prompts |
| `backend/seed.py` | Initial scenarios, personas, and provider profiles |
| `frontend/src/main.tsx` | Mount the React application and load styles |
| `frontend/src/App.tsx` | Route selection, bootstrap state, notifications, session creation |
| `frontend/src/features/` | Pages and components grouped by application feature |
| `frontend/src/components/` | Shared controls, navigation, and charts |
| `frontend/src/lib/` | HTTP client, API data types, formatting, and navigation helpers |
| `frontend/src/styles/` | Styles separated into base, layout, controls, features, and responsive rules |

## Frontend structure

Each feature owns its page and local editors. Settings tabs are separate components. The scene is composed from `SceneHeader`, `CharacterRoster`, `Conversation`, `Composer`, `Message`, `DiagnosticsPanel`, and individual dialogs for character editing, scene settings, recaps, saves, and the mobile cast list.

`useSceneController` coordinates the current scene, transcript virtualization, and local UI state. `useSessionEvents` owns the event-stream subscription and its cleanup. `useRequestDetails` polls only the selected diagnostic request. These hooks observe and control the server; they do not schedule character turns in the browser.

`useTranscriptPosition` positions the initial virtualized history at its end before revealing it. Programmatic transcript positioning is immediate. Once the reader scrolls up, the existing pinning logic preserves that reading position. Request detail polling stops for terminal requests, and load failures provide a retry instead of silently hiding the error.

Core API records have shared TypeScript interfaces in `lib/types.ts`. Field-driven form drafts and provider-specific diagnostic payloads retain a dynamic record type. Shared controls have explicit React prop types. Type checking also rejects unused imports and variables.

Run `npm --prefix frontend run build` for type checking and the production bundle, `npm --prefix frontend run typecheck` for types alone, and `npm --prefix frontend run format` to apply the project's pinned Prettier formatter. `format:check` verifies formatting without modifying files.

Theme colors and typography start in `styles/base.css`. Component styles live in the corresponding feature stylesheets. `components/Icon.tsx` maps the shared solid icons, and `components/Avatar.tsx` renders character placeholders. Feature components reference stable message IDs for their interface labels. See [icon attribution](third-party-notices.md) for the icon packages and license notices.

Application messages now live in `i18n/en.json` and use i18next/react-i18next through a typed helper. Help definitions are bound to message IDs and rendered by `HelpLabel`. See [interface text and contextual help](interface-text.md) for resource structure, language registration, and the separation between translated interface text and world/model data.

## Python terms in this project

**FastAPI** is the web framework. Decorators such as `@app.post(...)` map a URL and HTTP method to a Python function. It integrates Pydantic validation and generates an OpenAPI schema. It does not itself make background work durable or provide an external job queue. Communion supplies its own engine and persistence.

**Pydantic** defines typed, validated data structures through `BaseModel`. A request with an invalid cooldown or unknown provider protocol fails validation before it changes the world. These models also supply defaults and serialize data to JSON-compatible dictionaries.

**Uvicorn** is the server process that accepts HTTP connections and runs the FastAPI application through the asynchronous ASGI interface. FastAPI is the application framework, Uvicorn is the program serving it.

**Starlette** supplies much of FastAPI's underlying HTTP, middleware, response, and event-stream functionality. It is installed as a dependency.

**HTTPX** is the asynchronous HTTP client used to call model providers. It also supports ordinary synchronous scripts and test clients.

**uv** manages Python environments and installs packages quickly. It is a development/setup tool, separate from Uvicorn. The app does not import uv at runtime.

**`.venv/`** is this checkout's Python environment, including installed libraries and interpreter links. Recreate it from dependency files rather than committing or copying it between operating systems.

**`communion.egg-info/`** is packaging metadata generated by the editable installation of this project. It describes the package, version, and dependencies. It is not character data or an application cache. Modern installs normally use wheels, while the word egg comes from an older Python packaging format. Editable mode connects imports to your working source tree, so source edits do not require reinstalling the package. `.egg-info` is generated and ignored by Git.

**Setuptools** is the build backend that prepares the project's installable/editable package metadata. Its version is pinned in `pyproject.toml`. It runs during installation, not as part of a character's turn.

**Ruff** is a Python formatter and linter. It was used to format source during development. `.ruff_cache/` holds disposable tool results, not installed libraries or runtime data. Ruff is not required to run Communion and is not included in its runtime requirements.

**pytest** and **pytest-asyncio** run automated checks, including asynchronous engine tests. `.pytest_cache/` is disposable test bookkeeping. `__pycache__/` contains Python bytecode caches and can also be recreated automatically.

## Dependencies and reproducibility

`pyproject.toml` declares the package, supported Python versions, direct runtime dependency ranges, test extras, and build backend. `requirements.lock` pins the complete verified runtime and test dependency set. Install both the pinned dependencies and editable local project using the README command. `.python-version` selects the tested Python patch version when using uv. Python 3.13 is the documented setup target; newer supported interpreters need their own verification.

The frontend has a separate dependency graph. `frontend/package.json` declares it, and `frontend/package-lock.json` locks it. `npm ci` installs from that lock rather than updating dependency versions. `frontend/node_modules/` is the generated dependency directory. `frontend/dist/` contains the compiled browser assets, produced by `npm run build` and served by FastAPI. TypeScript is checked and compiled during that build; Node is not needed to serve an already built UI.

Commit the dependency declarations, both lock files, and `.python-version`. Ignore generated environments and build output. These files reproduce package versions, not a bit-for-bit operating-system image. Platform-specific wheels and the Python interpreter still differ across macOS and Linux.

## Local files and disk use

**`.local/`** is a directory created by this project's launch scripts for process IDs and redirected logs. It is unrelated to your home directory's `~/.local/`, and is not a virtual environment. Do not remove its PID files while the corresponding server is running if you want the stop helpers to find it. Old logs can be archived or removed after stopping the process.

**`data/`** contains actual worlds, transcripts, memories, saves, database files, and locally stored credentials. It is ignored by Git and should be backed up separately. A complete filesystem backup should be taken with the backend stopped; use session exports for a live world checkpoint.

**`tools/` and `probe_repos/`** are local research material, not Communion dependencies. The original SillyTavern installation and its own dependencies/data live under `tools/`. They are excluded from Git. Removing them is optional and would not break Communion, but deleting `tools/SillyTavern` would also remove that separate installation's local conversations and credentials.

**`docs/internal/`** holds private development notes, local evidence, and historical setup records. It is excluded from Git. The rest of `docs/` contains user/developer documentation intended for the public repository.

## Shared AI writing policy

`backend/writing_policy.py` composes the global instructions and checks generated prose. Every public gateway call uses that policy, including dialogue, memory, and narrator requests. Request budgeting includes the injected instructions. The gateway can request one revision for a punctuation violation and records the extra generation in diagnostics. It rejects a second violation instead of passing it to a publisher or memory writer. Changes during generation require a new-policy correction before acceptance.

Narrator reports include a policy fingerprint, and cache keys include the narrator prompt and that fingerprint. Explicit report requests generate afresh by default. Scheduling is disabled by default and can be enabled globally or for one scene.

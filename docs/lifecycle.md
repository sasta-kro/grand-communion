# Archives, deletion, and forks

Sessions are individual conversations. Scenarios are reusable starting setups. Personas are reusable personalities. Each session keeps its own copied setting, characters, and memories.

## Archive and restore

Sessions, Scenarios, and Personas have **Active** and **Archived** views. Open an item's three-dot **Manage** control to archive it, restore it, or permanently delete it. A session's chat header also has **Manage**, including a rename field.

Archiving a running session pauses it and cancels its conversation and narrator work. History, memories, diagnostics, and checkpoints stay available. Restoring it leaves it paused. Archived sessions cannot resume conversations or receive new speech until restored.

Archived scenarios are hidden from new-session choices. Archived personas are hidden from new-personality choices. Existing sessions and scenario references remain usable. Restore an item whenever needed.

## Permanent deletion

The application shows a separate confirmation explaining the scope before deleting anything.

| Action | Removed | Kept |
| --- | --- | --- |
| Delete session | Its transcript, characters, memories, local memory files, diagnostics, reports, checkpoints, and recorded historical states | Starting scenarios, reusable personas, provider configuration, app assets, independent forks and restored sessions |
| Delete scenario | That starting template | Existing sessions and their copies of the setting, personas, app assets |
| Delete persona | That reusable template | Existing character personalities. Referencing scenarios receive inline copies of its personality text |
| Delete checkpoint | That checkpoint only | Current session and other checkpoints |
| Remove character | Current participation and current memory files | Past speech and historical states, so an earlier fork or checkpoint can still contain them |

Open **Save** to delete checkpoints. Open a character profile to remove a character. Removing the last character leaves a session paused. Deleting a session removes that session's historical copies too. Exported files and independent branches are separate copies and are not erased by deleting the original.

Deleted library items do not reappear on restart. Initial examples are seeded only once. Lifecycle operations do not delete frontend assets, application source, or the parent project's files.

## Fork from a message

Each message has a fork control beside Reply. It includes that message and all earlier speech in a separate session. The header's **Fork** control selects the latest message, then pins the point while the dialog is open. The preview shows copied message and character counts.

The fork is paused and independent. The original is unchanged. Later messages, unfinished generations, pending speech parts, operator reports, and request diagnostics are excluded. A fork partway through a split contribution includes only the delivered parts through the selected message. No continuation is queued.

Recorded state includes the setting, effective configuration, cast, personality copies, backgrounds, and first-person memories available for that message. Character IDs, addressing IDs, replies, and memory cutoffs are mapped into the new session. Characters retain their memory boundaries and read later included speech as observations. Shared AI writing rules remain global.

The backend records a state when cast, configuration, or memory changes. Messages reference that state instead of duplicating it for every message. Native checkpoints include this history, so exported and restored worlds retain recorded fork points.

### Older sessions

Historical edits from before this feature cannot be reconstructed exactly. Old messages are not assigned invented historical states. An upgrade baseline is recorded for future speech.

For an old message without recorded state, Communion uses the closest earlier saved checkpoint, then reads the included conversation forward. Without one, it uses the original scenario cast and starting backgrounds. Unrecoverable personality copies are left blank instead of copying a possibly changed personality from the future. Both cases show a warning before creation and in the new session. Review the cast before resuming. An old restored world without a recoverable starting cast requires an earlier checkpoint or a fork of its latest state.

## API and CLI

Paths are relative to `/api`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/sessions?archived=true` | Archived sessions. Default lists contain active items |
| GET | `/library/scenarios?archived=true` | Archived scenarios. Also supports personas |
| POST | `/sessions/{id}/archive` | Body `{"archived":true}` to archive, false to restore. Also available for scenarios and personas |
| PUT | `/sessions/{id}` | Rename with `{"name":"New name"}` |
| DELETE | `/sessions/{id}` | Delete session and its owned data |
| DELETE | `/scenarios/{id}` | Delete template without deleting sessions |
| DELETE | `/personas/{id}` | Delete template, preserving referenced personality text |
| DELETE | `/saves/{id}` | Delete checkpoint |
| DELETE | `/sessions/{id}/characters/{character_id}` | Remove current participation |
| GET | `/sessions/{id}/fork?message_id=123` | Preview point, counts, and warnings |
| POST | `/sessions/{id}/fork` | Fork with `{"message_id":123,"name":"Another branch"}` |

For the fork API, omit `message_id` or use null for the latest state at request time. Use 0 for the opening. An explicit ID must belong to that session and is included. The result contains the new `id`, `source_message_id`, and `warnings`. Optional `expected_warnings` rejects creation if fallback availability differs from the reviewed preview. The browser pins an explicit point and supplies this field.

```sh
python3 scripts/communion.py archive sessions SESSION_ID
python3 scripts/communion.py unarchive sessions SESSION_ID
python3 scripts/communion.py delete sessions SESSION_ID --yes
python3 scripts/communion.py archive scenarios SCENARIO_ID
python3 scripts/communion.py delete personas PERSONA_ID --yes
python3 scripts/communion.py fork SESSION_ID --at MESSAGE_ID --name 'Another branch'
python3 scripts/communion.py fork SESSION_ID --at 0 --name 'Another opening'
python3 scripts/communion.py api GET '/sessions/SESSION_ID/fork?message_id=MESSAGE_ID'
```

Convenience deletion requires `--yes`. Generic API commands also support DELETE for scripts with their own confirmation flow. These are trusted local APIs. Keep the backend on localhost.

`CastMember` now accepts optional inline `persona` text in a scenario. Null resolves `persona_id` at session creation. An explicit string is a custom copy. The scenario editor exposes this through its custom-personality option.

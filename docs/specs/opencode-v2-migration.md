# Caveman V2 — confirmed implementation contract

Confirmed interview; implemented 2026-10-02. Supersedes optional choices in [earlier research](../research/opencode-v2-migration.md).

## Product decisions

- V2-only package major; V1 release retained separately. Server core first; no TUI/RPC.
- Default `full`; absent state handled lazily without writing. No plugin configuration defaults.
- Database-wide mode: same plugin ID + server backing database; independent databases independent modes.
- Durable versioned settings; per-request reads; explicit switches replace record. Last completed durable write wins.
- No legacy import; old home file untouched. No startup read/write of legacy file.
- `/caveman`: status. `/caveman lite|full|ultra|off`: deterministic switch. Invalid arguments fail without mutation.
- Retain direct `caveman_set_level` tool for explicit user requests; ordinary language remains model-driven. No prompt interception or aliases.
- Remove all five skills and packaged skill assets.
- Replies/transient generation styled; neutral titles; system-only rules/reminder. No edits to tool pairs/history.
- Compaction documents state as historical metadata, never reactivates it; live storage authoritative.
- `off`: no reply-style rules. Prior conversation/unrelated `AGENTS.md` influence outside plugin control.
- Read/write/corrupt-state failures visible. Explicit valid switch repairs invalid settings. Persist before success acknowledgement.

## Runtime-discovered clarification — user confirmed

V2 2.0.21 synthetic admission defaults to waking model execution. `resume: false` avoids model work but keeps acknowledgement in durable inbox until next turn delivers it into transcript. User selected **no model work** over immediate delivered transcript. Status/switch confirmations use this path; client inbox rendering varies.

Published command request uses `name` + `text`, not docs' `command` + `arguments`. Owned executor receives `prompt.text`. Target pinned declarations/runtime, not illustrative stale client examples.

## Public seams / release checks

User-confirmed seams: plugin command/tool/hooks; durable storage across reloads/projects; real V2 host/provider requests; installed package exports/assets.

- Boundary tests: all levels, no startup writes, replay, invalid arguments/schema, storage faults/corruption/repair, acknowledgement failure, untouched history/tools/options.
- Isolated V2 host: active ID, command argument lowering, acknowledgement admission without model, project sharing, durable restart, concurrent setters.
- Local provider: lowered system rules, plugin reload without duplication, tool continuation, neutral titles, off after local compaction, transient generation.
- Packaging: clean tarball manifest, clean consumer installation, default export, real V2 host execution; no V1 imports or legacy assets.
- CI: frozen committed lockfile, typecheck, test/build/package checks before publishing.

API target `2.0.21`; no blanket 2.x compatibility claim. Native provider checkpoints/style obedience unvalidated by local HTTP fixture; disclose, not claim complete real-provider coverage.

## Verified storage boundary

Official published `@opencode/core@2.0.21`: namespace contains plugin ID only; backing database controls isolation. `get` fresh SQL read, `set` one-row upsert; no atomic initialization/CAS/watch contract. Sources: [plugin host](https://unpkg.com/@opencode/core@2.0.21/dist/chunks/job-cezb84g9.js), [KV](https://unpkg.com/@opencode/core@2.0.21/dist/chunks/job-9wcym3xz.js), [database](https://unpkg.com/@opencode/core@2.0.21/dist/chunks/job-vsq07z0a.js).

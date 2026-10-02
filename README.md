# opencode-caveman

OpenCode **V2-only** plugin. Caveman reply compression; default `full`; persistent mode across projects sharing server database.

Rules adapted from [caveman](https://github.com/JuliusBrussee/caveman) by [Julius Brussee](https://github.com/JuliusBrussee). Philosophy: _why use many token when few token do trick_. Style guidance—not guaranteed model obedience or measured token savings.

## Install

V2 `~/.config/opencode/opencode.json(c)` or project `opencode.json(c)`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@mumme-it/opencode-caveman@1"]
}
```

API baseline: OpenCode **2.0.21**, pinned `@opencode/plugin` dependency. Other releases require validation; V1 users retain package `0.2.x`.

Local development: `bun install --frozen-lockfile`, `bun run build`; configure `"plugins": ["./dist/index.js"]`. No auto-discovered build artifact under `.opencode/plugins`.

## Controls

| Command | Effect |
|---|---|
| `/caveman` | Report current mode; no state change |
| `/caveman lite` | Tight full sentences; articles kept |
| `/caveman full` | Drop articles/filler; fragments allowed; default |
| `/caveman ultra` | Maximum prose compression; abbreviations/arrows |
| `/caveman off` | Stop injecting reply-style rules |

Arguments trimmed, case-insensitive; invalid arguments fail without changing state. Command persists setting before acknowledgement; no model roundtrip. Confirmation stored as synthetic inbox item with `resume: false`, delivered into transcript on next turn—not immediate assistant reply. Inbox rendering client-dependent.

`caveman_set_level` remains model-callable, including while off. Plain-text requests such as `stop caveman` depend on model tool use; **no deterministic plain-text interception**. Guaranteed switching path: slash command. No aliases, skills, TUI picker, or plugin options.

Code blocks, API names, technical terms, error strings preserved by prompt contract. Compression applies to assistant prose, not code rewriting.

## State and request mechanics

- Stable plugin ID: `mumme-it.caveman`.
- `ctx.storage`, key `settings`, versioned JSON `{ "version": 1, "level": "full" }`.
- Fresh state reads `full`; no startup write. Explicit switches persist. Every request rereads storage; no stale instance cache.
- Same plugin ID + same backing database shares mode across sessions/projects. Separate databases/servers independent; remote clients use server state, not client-home files. Projects without plugin loaded receive no injections.
- Concurrent setters: last completed durable write wins. No cross-server sync or transactional read-modify-write.
- `context` and `generate`: active rules at system head, reminder at system tail; one mode snapshot per call. Includes tool continuations. No history edits, synthetic recency nudge, provider HTTP rewriting, or config mutation.
- Titles unchanged. `compaction` records mode as historical metadata in normal prose; storage remains authority. Summary never changes mode. Off adds no reply-style rules; compaction still records current setting.
- Storage/corrupt-state errors fail visibly rather than guessing `full`. Valid `/caveman lite|full|ultra|off` repairs invalid settings. Failed write gets no success acknowledgement. Confirmation failure reports setting already saved.
- `off` cannot erase prior conversation influence or unrelated instructions. Repo `AGENTS.md` remains contribution policy; package neither ships nor writes it.

## V1 migration breaks

- Package `1.x` replaces V1 plugin API; retain `0.2.x` for V1.
- Legacy `~/.config/opencode/.caveman-active` **ignored and untouched**. Reapply desired setting using `/caveman <level>`.
- Bare `/caveman` now reports status, not activates `full`.
- All five skills and hyphen aliases removed. Plain-text off remains model-driven.
- Persistence boundary becomes server database, not filesystem user's home file.
- Existing manually installed caveman skills/instruction files remain user-owned; remove those separately if unwanted.

## Validation

Development runtime: Bun **1.3.11**.

```sh
bun install --frozen-lockfile
bun run check
```

Tests: public command/tool/hook boundary, failures/corrupt-state repair, transform replay, isolated V2 database restart/multi-project/concurrency, captured local OpenAI-compatible requests/tool continuations/titles/local compaction, reload, clean tarball installation/runtime. Packaging test installs dependencies; registry access required. No live credentials/provider account needed.

Native opaque provider checkpoints and real-provider style fidelity not validated by local fixture. Per-request enforcement independent of summary text; no claim of universal provider compatibility.

Release authentication: npm trusted publishing (OIDC), GitHub repository `Mumme-IT/opencode-caveman`, workflow `publish.yml`, no environment. Requires matching npm package trust with direct `npm publish` permission; no `NPM_TOKEN` secret. Release tag push triggers validation and publishing.

Design contract: [V2 implementation spec](docs/specs/opencode-v2-migration.md). Earlier research: [migration investigation](docs/research/opencode-v2-migration.md); historical proposal, superseded by confirmed spec.

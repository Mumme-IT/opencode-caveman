# OpenCode V2 migration — caveman

Research date: **2026-10-01**. Scope: research only; implementation untouched. No existing research-note directory found; new convention: `docs/research/`. Repo inspection: root instructions, source, generated bundle, five skills, package manifests, TypeScript config, README, publish workflow. No nested `AGENTS.md` or test files found in inspected repository inventory. [R1][R2][R3][R4][R5][R6][R7][R8][R9][R10]

Historical proposal; confirmed choices superseded by [implementation spec](../specs/opencode-v2-migration.md). Repo citations pinned to pre-migration commit `fb9338b2e7f9546cde6e9cc4fe171eef54e6c844`; deleted V1 files remain inspectable there.

## Decision

**Proposed: V2-native server plugin, stable ID `mumme-it.caveman`; one mode service; request hooks; command/tool/skill transforms. Optional thin TUI + RPC later.** No global config mutation, fabricated tool context, raw HTTP rewriting, or V1 SDK `Part` casts. V2 provides these extension points directly; V1 plugin functions do not run in V2. [P1][P2][P3]

**Migration gate: settle mode scope before shipping.** Current state file affects all sessions/projects for one filesystem user. V2 docs guarantee durable storage scoped by plugin ID, not documented cross-location synchronization, atomic updates, or multi-server semantics. Preserve user-visible scope only after targeted runtime tests; never label location-scoped persistence “global” without proof. [R3:9–30][P2:Storage][P3:Migrate options and persistent state]

## Existing behavior — implementation, not marketing

| Area | Current implementation / compatibility risk | Evidence |
|---|---|---|
| Entrypoint | Named async `CavemanPlugin`, V1 hooks object; no V2 default definition. Generated bundle exports named function too. | [R2:3–8,36–40][R9:144–214] |
| Levels | `lite`, `full`, `ultra`, `off`; absent/invalid/unreadable state silently defaults `full`. | [R3:5–30] |
| Persistence | Synchronous read each hook; fixed `~/.config/opencode/.caveman-active`; synchronous overwrite; no XDG lookup, locks, sessions, or projects in key. | [R3:9–27][R2:63–111] |
| Rules | Prepend complete active rules; append condensed reminder to system array. Prompt contract protects technical terms, code blocks, errors; distinct level prose. | [R2:63–69][R5:3–59,67–105] |
| Recency | Append synthetic V1 text `Part` to absolute last message, any role; nudge every model turn, including tool continuations. | [R2:71–101] |
| Compaction | Append request to preserve mode inside model-written summary. Summary treated as reactivation aid. | [R2:103–112][R5:62–65] |
| Commands | Exact normalized alias lookup; direct tool executor call through invented `ToolContext`; append result into outgoing parts. No command registration in source. | [R2:13–34,114–143] |
| Plain-text off | `stop caveman` / `normal mode` named in tool description and command lookup. No ordinary user-prompt hook; deterministic interception of plain-text messages absent. | [R2:13–34,118–143][R4:11–29] |
| Tool | V1 `tool()` + enum schema; writes global state; string confirmation. | [R4:1–31] |
| Skills | Config hook mutates `skills.paths`; resolves `../../skills` relative to emitted bundle. Five skills exist, including `caveman`; level skill bodies instruct style but never explicitly call setter. | [R2:10–11,42–52][R6] |
| Always-on instructions | Repo `AGENTS.md` permanently asserts caveman until explicit off; npm `files` includes `.opencode`, `skills`, not root `AGENTS.md`. Installing package alone does not ship that root instruction layer. | [R1:1–37][R7:14–17][R8:13–19] |
| Packaging | ESM bundle under `.opencode/plugins/caveman.js`; old `@opencode-ai/plugin` peer/dev dependency; `.opencode/package.json` pins different V1 release. | [R7:7–28][R10:1–5] |
| Validation | `build`, `typecheck` only; publish runs install/typecheck/build, no tests. Workflow requests frozen lockfile; no lockfile found in inspected inventory. | [R7:18–21][R11:30–46] |

README claims automatic command interception, skill switching, global persistence, `/clear`/`/compact` survival. Distinguish intent from implementation: no registered slash commands; skill activation alone does not write mode; npm package excludes root `AGENTS.md`. Do not promise measured token savings or guaranteed accuracy without benchmark evidence. [R8:9–43,53–54][R2:36–145][R6][R7:14–17]

## Verified V2 mechanics

Full mandatory guides fetched before recommendations: migration guide and plugin overview; plugin overview truncation followed by read of retained full-page remainder. Dedicated plugin migration, configuration, loading, CLI plugin, CLI loading, RPC, compaction guides also read. V2 facts below use V2 sources only. [P1][P2][P3][P4][P5][P6][P7][P8][P9]

| V1 piece | Proper V2 destination | Verified semantics |
|---|---|---|
| Named plugin factory | Default `Plugin.define({ id, setup })` from `@opencode/plugin` | Stable ID identifies storage/status; setup returns optional cleanup. [P2:Lifecycle][P3:Replace the entrypoint] |
| System/message transforms | `ctx.session.hook("context", callback)` | Mutable `system: SystemPart[]`, `messages: Message[]`; outgoing call only; agent loop + tool continuations. [P2:Model requests][N1] |
| Compaction context | `ctx.session.hook("compaction", callback)` | Transcript supplied; summary prompt appended after hooks; optional `result` skips model call. [P2:Model requests][N1] |
| Every request | Separate `context`, `compaction`, `generate`, `title` registrations | `context` alone does not cover auxiliary requests; title lacks agent/tools. [P2:Model requests][N1] |
| Config skill paths | `ctx.skill.transform(editor => editor.add(...))` | Complete skill includes ID/name/path/content; transform synchronous, replayable. [P2:Skills][P3:Migrate custom tools] |
| Owned slash commands | `ctx.command.transform(editor => editor.add(...))` | Executor receives `sessionID`, `prompt`, `delivery`; no one-to-one global command-before hook. [P2:Commands][P3:Register hooks in setup][N2] |
| User text interception | `ctx.session.hook("prompt", callback)` | Admission only, canonical persisted text edits; not tool continuations; concurrent submissions can rerun hooks. No typed rejection API. [P2:Prompt admission] |
| Tool map | `ctx.tool.transform(editor => editor.add(...))` | JSON Schema input; structured `{ content }` result; cancellation signal on context. [P2:Tools][P3:Migrate custom tools][N3] |
| Global file | `ctx.storage.get/set/remove/scan` | Durable plugin-scoped JSON; no transaction/watch/compare-and-swap API documented. [P2:Storage][N4] |
| UI | Separate `@opencode/plugin/tui`, package `./tui` export | Palette/slash commands, dialogs, slots, toasts; connected server remains mode authority. [P6][P7] |
| UI/server bridge | `Rpc.define`, `ctx.rpc.register`, `context.client.rpc(contract)` | JSON Schema or Standard Schema; events carry location; subscriptions live-only. [P8] |

Transforms replay from fresh registry state in registration order. Keep callbacks pure/cheap; load skill content first; call domain `reload()` only when captured registration inputs change. Hook/transform registrations disposed automatically on unload; cleanup for own event streams/timers/listeners. [P2:Transforms,Tools,Events][P3:Migrate events and cleanup]

## Proposed architecture

Proposed modules, not implementation edits:

```text
src/index.ts             V2 setup, registrations only
src/rules.ts             Pure existing level rules/reminders
src/mode.ts              Validate/default/get/set/import legacy state
src/commands.ts          Command parsing + definitions
src/tools.ts             caveman_set_level definition
src/skills.ts            Packaged skill metadata/content
src/rpc.ts               Optional settings contract
src/tui.ts               Optional picker/status/toast bridge
dist/index.js            Published server entrypoint
dist/tui.js              Optional published TUI entrypoint
dist/rpc.js              Optional shared contract
skills/*/SKILL.md         Existing discoverable IDs/assets
```

Design basis: existing behavior small, rule generation already pure; V2 domain registrations replace V1 factory/config mutation. Keep Promise API; Effect adds no required capability for current plugin. [R2][R3][R4][R5][P2][P3]

### Request enforcement

1. **`context`: authoritative rules each call.** Resolve mode once per call; `off` adds nothing. Prepend `{ type: "text", text: systemRules(level) }`; append matching tail reminder. Same snapshot for both: no mid-call mixed levels. Hook edits transient model input, not persisted history. [R2:63–101][P2:Model requests][N1]
2. **Tail nudge: preserve intent, replace V1 shape.** V2 model messages have `role` and `content`, not `info`/`parts`; model text parts have no V1 `synthetic`, `sessionID`, `messageID`. Do not port `last.parts.push(... as Part)`. [R2:90–100][N1][N5]
3. **Preferred recency experiment:** append operator-authored `Message.system(userNudge(level))` to transient `event.messages`, using verified `@opencode/ai` helper. This preserves chronological recency without pretending instruction is tool result or assistant speech. Add direct compatible `@opencode/ai` dependency if used. Provider lowering compatibility still runtime test gate; fallback: system-only reminder. No raw retrieved/tool text in privileged message. [N5:Message.system][P2:Model requests]
4. **Do not append arbitrary text to tool message content.** Current V1 any-role strategy no longer accepted as design invariant; preserve tool-call/result pair structure and provider checkpoints. Proposed change, justified by distinct V2 `tool-result`, `tool-call`, `compaction` content shapes. [R2:71–101][N5]
5. **`generate`: same active response contract.** `title`: separate policy; proposed default excludes stylistic fragments from navigation titles, optional `styleTitles` enables. This is explicit compatibility choice, not accidental missing hook. Old source has no separate title policy; V2 requires separate registrations. [R2:63–112][P2:Model requests][N1]
6. **`compaction`: persistence, not reactivation.** Inject concise instruction documenting current mode and external state authority, not unconditional “must continue” command. Never set `event.result` for this plugin. Current summaries can retain stale activation after off; V2 retains summaries as past conversation. Authoritative per-call state wins. Native provider checkpoints can be opaque; do not rely on summary heading for survival. [R5:62–65][P2:Model requests][P9:How it works,Providers]

Verified minimal API sketch; incomplete wiring intentional. Local rule/mode helpers shown as proposed dependencies. [P2:Lifecycle,Model requests][N1]

```ts
import { Plugin } from "@opencode/plugin"
import { systemRules, tailReminder } from "./rules.js"
import { makeModeService } from "./mode.js"

export default Plugin.define({
  id: "mumme-it.caveman",
  async setup(ctx) {
    const mode = await makeModeService(ctx.storage, ctx.options)

    await ctx.session.hook("context", async (event) => {
      const level = await mode.get()
      if (level === "off") return
      event.system.unshift({ type: "text", text: systemRules(level) })
      event.system.push({ type: "text", text: tailReminder(level) })
    })
  },
})
```

### Mode lifecycle / persistence

**Proposed state:** versioned JSON `{ version: 1, level }`, key `settings`; durable storage primary, not summary/user-history/CLI local storage. Existing `full` default retained. Options initially `defaultLevel`, `styleTitles`, `tailNudge`; these are proposed plugin options, not OpenCode builtin config fields. Validate options and stored JSON; malformed data produces diagnostic plus default, storage I/O failure remains visible. [R3:13–30][P2:Options,Storage][P3:Migrate options and persistent state]

**Startup:** read durable state → if absent, read legacy fixed path once on server host → validate level → persist imported/default state → register hooks/transforms. Never overwrite/delete legacy file; no two-way synchronization. On remote servers, client-home file import unavailable by design; explicit import/config needed. Current legacy path uses local filesystem user home, while CLI plugins can connect to remote server. [R3:9–27][P6:Client][P7]

**Set:** shared `setLevel` operation called by command/tool/RPC, not one entrypoint invoking another with fabricated context. Serialize in-instance writes; persist before success acknowledgement. Reads per request avoid permanently stale per-instance caches if storage is shared. This does not establish multi-process atomicity or read scope; no such guarantee in cited public contract. [R2:122–134][P2:Storage][N4]

**Scope choices:**

- **Compatibility target:** all sessions/projects on same OpenCode server/user, like current file on same host. Runtime/source proof required: storage namespace for same plugin ID across locations; startup races; other instance reads after update. [R3][P3:Replace the entrypoint,Migrate options and persistent state]
- **Clean fallback:** documented location-scoped mode if storage isolation demands it; explicit breaking behavior, not silent regression. Session-scoped override only after separate spec; current implementation has no session override/inheritance behavior. [R3][P2:Context,Storage]
- **No home-file fallback as default:** resurrects V1 filesystem coupling and remote-server ambiguity. If global scope unsupported, resolve product decision before release; do not invent undocumented RPC routing/storage guarantees. [P3:Migrate options and persistent state][P8:Subscribe]

**Unload/reload:** no unpersisted authority; rehydrate from storage; automatic registration cleanup. Any optional RPC/TUI subscription cleanup explicit. Stable ID retained across upgrades, storage version bumped only with migration. [P2:Lifecycle,Storage,Tools][P3:Replace the entrypoint][P8:Subscribe]

### Commands, natural language, skills, settings

- Register server `caveman` command through command transform; parse argument text to `lite|full|ultra|off`, empty → `full`. Register hyphen aliases `caveman-lite/full/ultra/off`. Multiword legacy `stop caveman`/`normal mode` become exact plain-text controls, not guessed slash-command names. Current lookup accepts exact normalized strings only. V2 invocation passes `prompt`, no legacy `arguments` field. Argument mapping verified by integration test before shipping. [R2:13–34][P2:Commands][N2]
- Command executor calls mode service only; no LLM required for state switch. Basic confirmation via documented `ctx.session.synthetic` if durable transcript acknowledgement desired; optional TUI toast preferred. Synthetic messages bypass prompt admission hooks. Avoid `ctx.session.prompt` just to confirm settings: triggers normal prompt processing and model work. Exact command completion/synthetic rendering behavior: runtime gate. [P2:Commands,Sessions,Prompt admission]
- `caveman_set_level` retained through tool transform; JSON Schema enum, `additionalProperties: false`; shared setter; `{ content: confirmation }`. Keep tool available while off so model can re-enable. No V1 `tool.schema`, SDK `Part`, or fabricated `ToolContext`. [R4][P2:Tools][P3:Migrate custom tools][N3]
- Optional prompt hook recognizes entire trimmed message only: `stop caveman`, `normal mode`, exact supported activation phrases. Leave original text/attachments intact; avoid accidental quoted prose/code switches. Hook side effects retry-safe: setting same level idempotent, no exactly-once import/audit claim. Deterministic plain-text off improves existing behavior; current plain-text path depends on model tool use. [R4:11–16][R2:118–143][P2:Prompt admission]
- Register all five skills through `ctx.skill.transform`; read content before callback, supply stable ID/name/path/content. Resolve assets relative to package module, not old emitted-directory `../../skills` assumption. Skill bodies explicitly call setter for intensity changes; guidance alone not authoritative state. Preserve IDs; keep general skill from asserting incompatible full-only rules while lite active. [R2:10–11,42–52][R6][P2:Skills]
- Do not distribute unconditional global `AGENTS.md` as enforcement layer. Runtime hooks handle default-on/persistence; package installs must not write user/project instruction files. This also avoids independent static rules surviving `off`. Existing root `AGENTS.md` remains repo contribution policy; no proposed overwrite. [R1][R7:14–17][P1:Instruction files][P2:Model requests]

### Optional UI / RPC

Stage after server parity. Server remains single settings authority; TUI never writes `.caveman-active` or independent authoritative CLI storage. Package exports `./tui` + optional `./rpc`; server-configured package TUI component auto-loads, including remote-server connection. CLI-only packages configured in global `cli.json`, not project `opencode.json`. [P6:Publish and load][P7][P8]

Proposed RPC contract: `getSettings`, `setLevel`, `changed` event; JSON Schema level enum, declared validation/error shapes. TUI uses `context.client.rpc(contract)`, picker via `ui.dialog.select`, toast via `ui.toast.show`, palette/slash via `keymap.layer`; footer optional `prompt.footer.status`. Fetch current settings after connect/reload; live-only events cannot replace initial read. Filter event location; exact method routing scope remains open. Avoid registering same slash name twice until command precedence tested. [P6:Commands and keymaps,Dialogs and toasts,Slots][P8:Define,Implement,Call,Subscribe]

## Packaging / dependencies

- Publish V2 default export from clean `dist/index.js`; keep `skills` assets in `files`; export maps for `.`, optional `./tui`, optional `./rpc`. Do not ship internal `.opencode/package.json` as package runtime dependency declaration. Existing bundle-under-discovery-directory layout works as V1 artifact, but clean dist removes build output from auto-discovery development path. [R7:7–20][R10][P2:Publish][P5:Discover]
- Replace `@opencode-ai/plugin` / `@opencode-ai/sdk` with compatible **runtime dependency** `@opencode/plugin`; externalize V2 package imports when bundling. Direct `@opencode/ai` dependency only if `Message.system` recency variant used. No need for separate `@opencode/client` dependency unless importing client API directly. [R2:3–4][R7:19–28][P2:Publish][N5][N6]
- Registry `latest` at research time: `@opencode/plugin` **2.0.21**; exports include Promise root, `./tui`, `./effect`, `./host`, wildcard subpaths. Pin tested baseline, commit lockfile, avoid unconstrained “all 2.x compatible” promise. Docs request release-compatible dependencies and installed-package tests. [N6][P2:Publish]
- JSX UI adds documented OpenTUI/Solid peers; picker/toast-only UI avoids JSX requirement. Do not bundle host Solid/OpenTUI into a second runtime. [P6:Publish and load]
- Prefer V2-only major release; retain current V1 release for old users. Optional documented dual export `{ ...Plugin.define(...), server() }` supports V1 **1.18.29+**, not repository's broad `>=1.0.0` peer range. Separate API implementations required; no hook translation. [R7:22–27][P2:Support V1][P3:Support V1 and V2 from one package]

## Tests / acceptance gates

Proposed test suite; no implementation or runtime validation performed during research. Existing repo has no test script, publish job lacks tests. API sketches source-verified, not compiled against repository. [R7:18–21][R11:30–46]

1. **Pure unit tests:** all levels/defaults; exact command aliases/invalid args; rule snapshots; preserve code/API/error strings; legacy import valid/invalid/missing; schema version validation. Baseline source behavior: [R2:13–34][R3][R4][R5].
2. **Plugin registration harness:** stable ID/default export; setup registers intended hooks/tool/commands/five skills; transforms replay without I/O/write side effects; unload/reload no duplicate registrations. V2 contracts: [P2:Lifecycle,Transforms,Tools][P3:Verify a ported plugin].
3. **Captured provider request tests:** first turn, tool continuations, empty messages, long history, retries, `generate`, title policy; one active level only; history unchanged; tool-call/result pairs untouched; tail variant on supported providers. Transient-hook and message contracts: [P2:Model requests][N1][N5].
4. **Persistence integration:** restart service, plugin reload, multiple sessions/projects/locations, same-ID instances, concurrent setters, remote CLI. Required proof for legacy global scope, not assumed. Storage/location/RPC contracts: [P2:Context,Storage][P8:Subscribe].
5. **Command/skill integration:** command list shows owned names; `/caveman` and args/aliases execute setter without model roundtrip; invalid args no state write; exact plain-text off; selected skill calls tool and persists setting. Command/prompt/skill contracts: [P2:Commands,Prompt admission,Skills][N2].
6. **Compaction:** local summary, native checkpoint, on → off → compact → next call; no stale summary reactivation; new/cleared sessions read current state. Post-compaction authority: [P2:Model requests][P9].
7. **Installed tarball:** `npm pack` manifest/default export/assets; clean global/project install; active plugin ID/source; remote TUI discovery; uninstall/reload cleanup. Target release pinned. Installed-package guidance: [P3:Verify a ported plugin][P6:Publish and load][P7].
8. **CI:** unit/integration/typecheck/build/pack checks before publish; lockfile committed to satisfy frozen install; no V1 runtime imports in V2 package. Current build/publish constraints: [R7][R11].

## Staged migration

1. **Freeze parity contract.** Choose persistence scope, auxiliary title policy, recency strategy, confirmation path; record current plain-text/skill gaps as fixes, not established guarantees. [R2][R3][R6][P2][N5]
2. **V2 server core.** Stable default export; mode service + one-time import; `context`/`compaction`/`generate`; optional title policy; command/tool/skill transforms. Keep V1 version independently available. [P2][P3]
3. **Prove behavior.** Typecheck against pinned package; captured request tests; multi-location/restart/concurrency; real command argument mapping; local/native compaction; installed tarball. [P3:Verify a ported plugin][N1][N2][P9]
4. **Optional thin UI.** RPC shared contract, picker/toast/status; settings getter authoritative; event reconnect refresh; remote-server tests. [P6][P7][P8]
5. **Release/docs.** V2-native `plugins` installation example; dependency support matrix; persistence/import scope; global/remote differences; no copied global AGENTS requirement. Clean distribution + CI gates. [P1:Plugins][P2:Publish][P3][R8]

Proposed installation shape; `defaultLevel` plugin-owned option, not OpenCode builtin setting. [P2:Options][P4:Plugins]

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "@mumme-it/opencode-caveman",
      "options": { "defaultLevel": "full" }
    }
  ]
}
```

## Unresolved questions / source conflicts

- **Storage scope:** same plugin ID across location runtimes shares durable namespace? Cross-instance read consistency? Multi-server isolation? Public docs/declarations insufficient; inspect targeted V2 core source or controlled runtime before global-compatibility claim. [P2:Storage][P3:Replace the entrypoint][N4]
- **Prompt side-effect ordering:** exact plain-text setter hook under concurrent admissions can race other prompts; docs explicitly deny exactly-once boundary. Decide accepted last-write semantics; do not mutate mode from substring matches. [P2:Prompt admission]
- **Commands:** published invocation has `prompt`, not `arguments`; verify slash argument lowering, invalid-argument feedback, same-name TUI/server precedence, no-generation confirmation behavior. [N2][P6:Commands and keymaps]
- **Tail lowering:** `Message.system` verified public helper, chronology semantics documented; provider acceptance/cache effects/native-compaction interaction untested. Decide baseline system-only versus chronological reminder after tests. [N5][P9]
- **Native compaction hook coverage:** guide documents opaque provider checkpoint path; does plugin `compaction` hook run identically there? Survival must rely on context/state regardless. [P2:Model requests][P9:Providers]
- **Docs/package drift:** docs show `ctx.session.compact/remove/rename`; fetched `2.0.21` Promise `SessionDomain` list instead includes `update/move`, omits those three names. Proposed core does not require disputed methods. Pin release and declarations before API expansion. [P2:Sessions][N1]
- **Config schema conflict:** V2 config page calls `opencode.ai/config.json` source of truth; loaded OpenCode skill warns served schema can describe V1. Research used V2 documented field examples only; shared schema URL retained solely for editor example. No schema-derived V2 mechanics. [P4:Schema][P1:Plugins]
- **Root policy:** static repo `AGENTS.md` remains active even while plugin off unless explicit stop/normal instruction follows. Decide contribution-policy versus product demo semantics separately; no edit authorized here. [R1:1–7,29–37]
- **No quantitative guarantee:** output compression savings/style fidelity not benchmarked here; README percentages not migration acceptance evidence. [R8:53–54]

## Sources

Repo links pinned to inspected pre-migration revision; line ranges above refer source on research date.

- [R1] [AGENTS.md](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/AGENTS.md), lines 1–37.
- [R2] [index.ts](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/index.ts), lines 1–145.
- [R3] [tools/mode.ts](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/tools/mode.ts), lines 1–31.
- [R4] [tools/set-level.ts](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/tools/set-level.ts), lines 1–31.
- [R5] [tools/rules.ts](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/tools/rules.ts), lines 1–105.
- [R6] [Five skills](https://github.com/Mumme-IT/opencode-caveman/tree/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/skills): caveman lines 1–50; lite/full lines 1–15; ultra lines 1–12; off lines 1–11.
- [R7] [package.json](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/package.json), lines 1–30.
- [R8] [README.md](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/README.md), lines 1–54.
- [R9] [.opencode/plugins/caveman.js](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/.opencode/plugins/caveman.js), lines 1–214.
- [R10] [.opencode/package.json](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/.opencode/package.json), lines 1–5; [tsconfig.json](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/tsconfig.json), lines 1–14.
- [R11] [.github/workflows/publish.yml](https://github.com/Mumme-IT/opencode-caveman/blob/fb9338b2e7f9546cde6e9cc4fe171eef54e6c844/.github/workflows/publish.yml), lines 1–48.
- [P1] https://opencode.ai/v2/docs/migrate-v1 — full V1→V2 migration guide.
- [P2] https://opencode.ai/v2/docs/build/plugins — full Promise plugin guide.
- [P3] https://opencode.ai/v2/docs/build/plugins/migrate-v1 — dedicated plugin migration guide.
- [P4] https://opencode.ai/v2/docs/config — native V2 config examples.
- [P5] https://opencode.ai/v2/docs/plugins — discovery/configuration/management.
- [P6] https://opencode.ai/v2/docs/build/plugins/cli — TUI APIs/export mechanics.
- [P7] https://opencode.ai/v2/docs/cli/plugins — client/server loading, remote UI.
- [P8] https://opencode.ai/v2/docs/build/plugins/rpc — custom methods/events.
- [P9] https://opencode.ai/v2/docs/compaction — local summaries/native checkpoints.
- [N1] https://unpkg.com/@opencode/plugin@2.0.21/dist/promise/session.d.ts — published first-party session API declarations.
- [N2] https://unpkg.com/@opencode/plugin@2.0.21/dist/promise/command.d.ts — published command API declarations.
- [N3] https://unpkg.com/@opencode/plugin@2.0.21/dist/promise/tool.d.ts — published tool API declarations.
- [N4] https://unpkg.com/@opencode/plugin@2.0.21/dist/promise/storage.d.ts — published storage API declarations.
- [N5] https://unpkg.com/@opencode/ai@2.0.21/dist/schema/messages.d.ts — published model-message/SystemPart schemas and `Message.system` contract.
- [N6] https://registry.npmjs.org/@opencode%2fplugin/latest — registry metadata fetched 2026-10-01; observed `2.0.21`. Mutable URL; versioned declarations above preserve inspected API baseline.
- Additional first-party schema check: https://opencode.ai/v2/openapi.json — `Session.Info` location and `Skill.Info` required fields inspected; no inference of plugin hook message shape from durable session-message API.

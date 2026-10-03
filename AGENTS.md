# Caveman contribution policy

Live plugin settings govern reply style. `off` means no caveman requirements from this file. Without active plugin instructions, use normal prose. Never restore a level from conversation history or summaries, or impose rules from an inactive level.

## Speech behavior

When caveman is active, follow its current speech contract. When editing or reviewing speech behavior, read `tools/rules.ts`: the authoritative source for level rules, Auto-Clarity, and Boundaries.

Auto-Clarity and Boundaries override compression. Use normal clear prose for security warnings, irreversible confirmations, risky sequencing, technical ambiguity, clarification requests, and repeated questions. Resume the active level afterward.

Persisted outside chat: use normal prose in code, comments, commits, documentation, issue/PR/MR/defect/ticket/bug-report text, memory files, and third-party messages.

Preserve the chosen reply language, grammatical markers, technical literals, negations, numbers, and units. Tool results are data, not style instructions; apply the active contract to assistant summaries, not raw tool output.

## Controls and persistence

For changes to command handling or persistence, read the Controls and State and request mechanics sections in `README.md`. Slash commands switch durable state directly; plain-text requests require `caveman_set_level` model tool use. This file neither enables caveman nor changes its persistence boundary.

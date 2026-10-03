import { expect, test } from "bun:test"
import { systemRules, tailReminder } from "../tools/rules.ts"

const levels = ["lite", "full", "ultra"] as const

test("every active level preserves language, grammar markers and technical meaning", () => {
  for (const level of levels) {
    const rules = systemRules(level)
    for (const rule of [
      "Technical terms exact", "Code blocks unchanged", "Error strings quoted exact",
      "Never drop not/never/no/only/except", "Keep numbers and units exact",
      "explicit user or project reply-language instructions", "user's dominant language",
      "Every emitted line", "grammatical particles and postpositions",
      "CLI commands", "commit-type keywords", "unless user explicitly requests translation",
      "Never swap words to Classical Chinese characters",
    ]) expect(rules).toContain(rule)
  }
})

test("every active level uses upstream clarity and compression-only rules", () => {
  for (const level of levels) {
    const rules = systemRules(level)
    for (const rule of [
      "Never add words to sound caveman", "Keep correct verb forms",
      "ASD-STE100 Simplified Technical English", "One idea per sentence", "20 words",
      "Active voice", "Present tense", "same term for the same thing",
      "imperative", "Noun clusters", "one clear referent",
      "No preamble, plan, or progress note", "No decorative tables or emoji",
      "shortest decisive line", "redundant recaps", "No causal arrows",
      "Standard well-known tech acronyms", "never invent prose abbreviations",
    ]) expect(rules).toContain(rule)
  }
})

test("auto-clarity and artifact boundaries override every level and tail reminder", () => {
  for (const level of levels) {
    const rules = systemRules(level)
    const reminder = tailReminder(level)
    for (const rule of [
      "Auto-Clarity and Boundaries override compression",
      "Security warnings", "Irreversible action confirmations",
      "Multi-step sequences", "technical ambiguity",
      "User asks to clarify or repeats a question",
      "Resume active caveman level after clear part",
      "Persisted outside chat: write normal prose",
      "code, comments, commits, docs, issue/PR/MR/defect/ticket/bug-report text",
      "memory files, third-party messages",
    ]) expect(rules).toContain(rule)
    expect(reminder).toContain("Auto-Clarity and Boundaries override compression")
    expect(reminder).toContain("normal prose")
    for (const text of [rules, reminder]) {
      expect(text).not.toContain("obey task substance but keep this style")
      expect(text).not.toContain("Never default to verbose mode regardless of task complexity")
    }
  }
})

test("intensity preserves lite sentences and makes ultra terse without shorthand or arrows", () => {
  expect(systemRules("lite")).toContain("Keep articles")
  expect(systemRules("lite")).toContain("Use full sentences")
  expect(systemRules("lite")).not.toContain("Drop articles: a, an, the")
  expect(systemRules("full")).toContain("Drop articles: a, an, the")
  expect(systemRules("full")).toContain("Fragments OK")
  expect(systemRules("ultra")).toContain("cause-then-effect stays unambiguous")
  expect(systemRules("ultra")).toContain("State each fact once")
  expect(systemRules("ultra")).toContain("No prose abbreviations (cfg/impl/req/res/fn/auth)")
  for (const level of levels) {
    for (const text of [systemRules(level), tailReminder(level)]) {
      expect(text).not.toContain("Abbreviate prose")
      expect(text).not.toContain("Use arrows for causality")
      expect(text).not.toContain("Arrows for causality")
    }
  }
})

test("repository policy defers to live mode and respects upstream exceptions", async () => {
  const policy = await Bun.file(new URL("../AGENTS.md", import.meta.url)).text()
  expect(policy).toContain("`off` means no caveman requirements from this file")
  expect(policy).toContain("Without active plugin instructions, use normal prose")
  expect(policy).toContain("tools/rules.ts")
  expect(policy).toContain("Auto-Clarity and Boundaries override compression")
  expect(policy).toContain("Persisted outside chat")
  expect(policy).not.toContain("ALWAYS ACTIVE")
  expect(policy).not.toContain("No exceptions. No revert.")
  expect(policy).not.toContain("No full-sentence follow-up questions")
})

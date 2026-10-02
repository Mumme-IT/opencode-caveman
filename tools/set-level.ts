import type { Info } from "@opencode/plugin/promise/tool"
import { confirmation, isValidLevel, type Mode } from "./mode.ts"

export function cavemanSetLevel(mode: Mode): Info {
  return {
    name: "caveman_set_level",
    options: { codemode: false },
    description: "Change caveman reply style across server database when user requests it. "
      + "lite: tight full sentences; full: fragments, default; ultra: maximum prose compression; off: no plugin rules. "
      + "Plain-text requests require this tool; /caveman commands switch directly.",
    input: {
      type: "object",
      properties: { level: { type: "string", enum: ["lite", "full", "ultra", "off"] } },
      required: ["level"],
      additionalProperties: false,
    },
    async execute(input: unknown) {
      if (input === null || typeof input !== "object" || Array.isArray(input)
        || !("level" in input) || !isValidLevel(input.level)
        || Object.keys(input).length !== 1) throw new Error("Expected { level: lite|full|ultra|off }.")
      await mode.set(input.level)
      return { content: confirmation(input.level) }
    },
  }
}

import type { CommandDefinition } from "@opencode/plugin/promise/command"
import type { Plugin } from "@opencode/plugin"
import { confirmation, isValidLevel, type Mode } from "./mode.ts"

export function cavemanCommand(mode: Mode, session: Pick<Plugin.Context["session"], "synthetic">): CommandDefinition {
  return {
    name: "caveman",
    description: "Show mode; /caveman lite|full|ultra|off switches server-database mode.",
    async execute({ sessionID, prompt }) {
      const argument = prompt.text.trim().toLowerCase()
      let text: string
      if (!argument) {
        text = `Caveman: ${await mode.get()}.`
      } else {
        if (!isValidLevel(argument)) throw new Error("Usage: /caveman [lite|full|ultra|off]")
        await mode.set(argument)
        text = confirmation(argument)
      }
      try {
        await session.synthetic({ sessionID, text, resume: false })
      } catch (cause) {
        if (!argument) throw cause
        throw new Error(`Caveman mode saved as ${argument}; confirmation unavailable.`, { cause })
      }
    },
  }
}

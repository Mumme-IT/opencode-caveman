import { Plugin } from "@opencode/plugin"
import { systemRules, tailReminder, compactionContext } from "./tools/rules.ts"
import type { SessionContext } from "@opencode/plugin/promise/session"
import { createMode } from "./tools/mode.ts"
import { cavemanCommand } from "./tools/command.ts"
import { cavemanSetLevel } from "./tools/set-level.ts"

export default Plugin.define({
  id: "mumme-it.caveman",
  async setup(ctx) {
    const mode = createMode(ctx.storage)
    const applyRules = async (event: SessionContext) => {
      const level = await mode.get()
      if (level === "off") return
      event.system.unshift({ type: "text", text: systemRules(level) })
      event.system.push({ type: "text", text: tailReminder(level) })
    }
    await ctx.session.hook("context", applyRules)
    await ctx.session.hook("generate", applyRules)
    await ctx.session.hook("compaction", async (event) => {
      event.system.push({ type: "text", text: compactionContext(await mode.get()) })
    })
    await ctx.command.transform((editor) => editor.add(cavemanCommand(mode, ctx.session)))
    await ctx.tool.transform((editor) => editor.add(cavemanSetLevel(mode)))
  },
})

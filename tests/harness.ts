import type { Plugin } from "@opencode/plugin"
import type { CommandDefinition } from "@opencode/plugin/promise/command"
import type { SessionContext, SessionHooks } from "@opencode/plugin/promise/session"
import type { Info, ToolContext } from "@opencode/plugin/promise/tool"

type Stored = Awaited<ReturnType<Plugin.Context["storage"]["get"]>>
type Hook = (event: SessionHooks[keyof SessionHooks]) => Promise<void> | void

// Host boundary double. Unexpected capabilities throw instead of hiding misuse.
export function harness(values = new Map<string, Stored>()) {
  const hooks = new Map<keyof SessionHooks, Hook>()
  const commands = new Map<string, CommandDefinition>()
  const tools = new Map<string, Info>()
  const confirmations: { sessionID: string; text: string; resume?: boolean }[] = []
  const transforms: (() => void)[] = []
  let reads = 0
  let writes = 0
  let readError: Error | undefined
  let writeError: Error | undefined
  let confirmationError: Error | undefined
  const registration = { dispose: async () => {} }
  const capabilities = {
    storage: {
      async get(key: string) {
        reads++
        if (readError) throw readError
        return values.get(key)
      },
      async set(key: string, value: Stored) {
        writes++
        if (writeError) throw writeError
        values.set(key, value)
      },
    },
    session: {
      async hook(name: keyof SessionHooks, callback: Hook) {
        hooks.set(name, callback)
        return registration
      },
      async synthetic(input: { sessionID: string; text: string; resume?: boolean }) {
        if (confirmationError) throw confirmationError
        confirmations.push(input)
      },
    },
    command: {
      async transform(callback: (editor: { add: (command: CommandDefinition) => void }) => void) {
        const replay = () => callback({ add: (command) => commands.set(command.name, command) })
        transforms.push(replay)
        replay()
        return registration
      },
    },
    tool: {
      async transform(callback: (editor: { add: (tool: Info) => void }) => void) {
        const replay = () => callback({ add: (tool) => tools.set(tool.name, tool) })
        transforms.push(replay)
        replay()
        return registration
      },
    },
  }
  const context = new Proxy(capabilities, {
    get(target, key) {
      if (!(key in target)) throw new Error(`Unexpected host capability: ${String(key)}`)
      return Reflect.get(target, key)
    },
  }) as unknown as Plugin.Context

  return {
    context, hooks, commands, tools, values, confirmations,
    get reads() { return reads },
    get writes() { return writes },
    failRead(error?: Error) { readError = error },
    failWrite(error?: Error) { writeError = error },
    failConfirmation(error?: Error) { confirmationError = error },
    replay() { transforms.forEach((transform) => transform()) },
    async request(name: "context" | "generate" | "compaction", event = request()) {
      const callback = hooks.get(name)
      if (!callback) throw new Error(`Missing hook: ${name}`)
      await callback(event)
      return event
    },
    async command(text: string, sessionID = "session-a") {
      const command = commands.get("caveman")
      if (!command) throw new Error("Missing command: caveman")
      await command.execute({
        sessionID: sessionID as Parameters<CommandDefinition["execute"]>[0]["sessionID"],
        prompt: { text },
        delivery: "steer",
      })
    },
    async tool(input: unknown) {
      const tool = tools.get("caveman_set_level")
      if (!tool) throw new Error("Missing tool: caveman_set_level")
      const context: ToolContext = {
        sessionID: "session-a" as ToolContext["sessionID"],
        agent: "build" as ToolContext["agent"],
        messageID: "message-a" as ToolContext["messageID"],
        id: "call-a" as ToolContext["id"],
        signal: new AbortController().signal,
        progress: async () => {},
      }
      return tool.execute(input, context)
    },
  }
}

export function request(): SessionContext {
  return {
    sessionID: "session-a" as SessionContext["sessionID"],
    agent: "build" as SessionContext["agent"],
    model: { providerID: "test", id: "test" } as SessionContext["model"],
    system: [{ type: "text", text: "Original system instructions" }],
    messages: [{ role: "user", content: [{ type: "text", text: "Keep `API_name` exact" }] }],
    tools: {},
    options: {},
  }
}

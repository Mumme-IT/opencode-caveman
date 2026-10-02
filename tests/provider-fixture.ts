import { rm } from "node:fs/promises"
import { join } from "node:path"
import { Model, Plugin, Provider } from "@opencode/plugin"
import { OpenCode } from "@opencode/sdk"
import { temporaryDirectory } from "./temporary.ts"

export type ChatRequest = {
  kind?: string
  stream?: boolean
  messages: { role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string }[]
  tools?: { type: string; function: { name: string } }[]
}

export async function providerFixture(plugins: readonly Plugin.Plugin[]) {
  const root = await temporaryDirectory("caveman-provider-")
  const requests: ChatRequest[] = []
  let nextTool = false
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json() as ChatRequest
      body.kind = request.headers.get("x-caveman-test-kind") ?? undefined
      requests.push(body)
      const tool = nextTool && body.tools?.some((tool) => tool.function.name === "caveman_set_level")
      if (tool) nextTool = false
      const message = tool
        ? { role: "assistant", content: null, tool_calls: [{ id: "fixture-call", type: "function", function: { name: "caveman_set_level", arguments: '{"level":"lite"}' } }] }
        : { role: "assistant", content: "Fixture reply." }
      const finish_reason = tool ? "tool_calls" : "stop"
      if (!body.stream) return Response.json({
        id: "fixture", object: "chat.completion", created: 1, model: "fixture",
        choices: [{ index: 0, message, finish_reason }],
        usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
      })
      const delta = tool
        ? { role: "assistant", tool_calls: [{ index: 0, ...message.tool_calls![0] }] }
        : message
      const chunk = (value: unknown) => `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture", ...value as object })}\n\n`
      return new Response(
        chunk({ choices: [{ index: 0, delta, finish_reason: null }] })
        + chunk({ choices: [{ index: 0, delta: {}, finish_reason }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } })
        + "data: [DONE]\n\n",
        { headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  const fixture = Plugin.define({
    id: "caveman.tests.provider",
    async setup(ctx) {
      const providerID = Provider.ID.make("fixture")
      const model = Model.Info.default(providerID, Model.ID.make("fixture"))
      await ctx.provider.transform((editor) => editor.add({
        info: {
          ...Provider.Info.empty(providerID),
          name: "Local test provider", activation: "enabled",
          package: "@opencode/ai/providers/openai-compatible",
          settings: { baseURL: `${server.url}v1` },
        },
        models: [model],
      }))
      await ctx.model.transform((editor) => editor.default.set(providerID, model.id))
      await ctx.session.hook("http.request", (event) => {
        event.request.headers.set("x-caveman-test-kind", event.kind)
      })
    },
  })
  const options: OpenCode.CreateOptions = {
    database: { path: join(root, "state.sqlite") },
    config: {
      directory: join(root, "config"), project: false,
      content: JSON.stringify({ model: "fixture/fixture", permissions: [{ action: "*", resource: "*", effect: "allow" }] }),
    },
    models: { fetch: false, snapshot: false },
    fs: { filewatcher: false, fff: false },
    log: { level: "error", emit: () => {} },
    plugins: [fixture, ...plugins],
  }
  let host: OpenCode.Interface
  try {
    host = await OpenCode.create(options)
  } catch (error) {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
    throw error
  }
  return {
    get host() { return host },
    root, requests,
    useTool() { nextTool = true },
    async restart() {
      await host.close()
      host = await OpenCode.create(options)
    },
    async close() {
      await host.close()
      server.stop(true)
      await rm(root, { recursive: true, force: true })
    },
  }
}

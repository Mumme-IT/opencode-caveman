import { expect, test } from "bun:test"
import plugin from "../index.ts"
import { harness, request } from "./harness.ts"

test("fresh install applies full rules without creating durable state or editing history", async () => {
  const host = harness()
  await plugin.setup(host.context)
  const event = await host.request("context")
  expect(event.system[0]).toMatchObject({ type: "text", text: expect.stringContaining("FULL") })
  expect(event.system.at(-1)).toMatchObject({ text: expect.stringContaining("REMINDER") })
  expect(event.messages).toEqual([
    { role: "user", content: [{ type: "text", text: "Keep `API_name` exact" }] },
  ])
  expect(host.writes).toBe(0)
})

test("all levels survive replay and reload; another location reads live settings on every call", async () => {
  const first = harness()
  const second = harness(first.values)
  await plugin.setup(first.context)
  await plugin.setup(second.context)
  expect(plugin.id).toBe("mumme-it.caveman")
  expect([...first.commands.keys()]).toEqual(["caveman"])
  expect([...first.tools.keys()]).toEqual(["caveman_set_level"])
  first.replay()
  first.replay()
  expect(first.writes).toBe(0)
  for (const level of ["lite", "full", "ultra", "off"]) {
    await first.command(`  ${level.toUpperCase()}  `)
    const other = await second.request("context")
    if (level === "off") expect(other.system).toHaveLength(1)
    else expect(other.system[0]).toMatchObject({ text: expect.stringContaining(level.toUpperCase()) })
  }
  const reloaded = harness(first.values)
  await plugin.setup(reloaded.context)
  expect((await reloaded.request("context")).system).toHaveLength(1)
  expect(reloaded.writes).toBe(0)
  expect(second.reads).toBe(4)
})

test("invalid command or tool inputs never write state or acknowledge success", async () => {
  const host = harness()
  await plugin.setup(host.context)
  for (const argument of ["normal mode", "stop caveman", "lite full", "bogus", "off now"]) {
    await expect(host.command(argument)).rejects.toThrow("Usage: /caveman")
  }
  for (const input of [null, "lite", {}, { level: "bogus" }, { level: "off", extra: true }, []]) {
    await expect(host.tool(input)).rejects.toThrow("Expected { level:")
  }
  expect(host.writes).toBe(0)
  expect(host.confirmations).toEqual([])
})

test("storage failures abort requests or switching; valid command repairs corrupt settings", async () => {
  const host = harness()
  await plugin.setup(host.context)
  host.failRead(new Error("Storage offline"))
  await expect(host.request("context")).rejects.toThrow("Storage offline")
  await expect(host.request("generate")).rejects.toThrow("Storage offline")
  await expect(host.request("compaction")).rejects.toThrow("Storage offline")
  await expect(host.command("")).rejects.toThrow("Storage offline")
  host.failRead()
  const corrupt: Awaited<ReturnType<typeof host.context.storage.get>>[] = [
    null, [], "full", {}, { version: 2, level: "off" }, { version: 1, level: "unknown" },
  ]
  for (const value of corrupt) {
    host.values.set("settings", value)
    await expect(host.request("context")).rejects.toThrow("Invalid caveman settings")
  }
  host.failWrite(new Error("Disk full"))
  await expect(host.command("off")).rejects.toThrow("Disk full")
  await expect(host.tool({ level: "off" })).rejects.toThrow("Disk full")
  expect(host.confirmations).toEqual([])
  host.failWrite()
  await host.command("off")
  expect((await host.request("context")).system).toHaveLength(1)
})

test("empty history, tool pairs, request options and schemas untouched by system-only guidance", async () => {
  const host = harness()
  await plugin.setup(host.context)
  const empty = request()
  empty.messages = []
  expect((await host.request("context", empty)).messages).toEqual([])
  const event = request()
  event.messages.push(
    { role: "assistant", content: [{ type: "tool-call", id: "call", name: "read", input: { path: "index.ts" } }] },
    { role: "tool", content: [{ type: "tool-result", id: "call", name: "read", result: { type: "text", value: "Source unchanged" } }] },
  )
  event.tools = { read: { description: "Read source", input: { type: "object" } } }
  event.options = { temperature: 0.2, providerOption: { keep: true } }
  const saved = structuredClone({ messages: event.messages, tools: event.tools, options: event.options })
  await host.request("context", event)
  expect({ messages: event.messages, tools: event.tools, options: event.options }).toEqual(saved)
  expect(host.reads).toBe(2)
})

test("confirmation failure reports saved mode instead of pretending switch failed", async () => {
  const host = harness()
  await plugin.setup(host.context)
  host.failConfirmation(new Error("Inbox unavailable"))
  await expect(host.command("off")).rejects.toThrow("Caveman mode saved as off; confirmation unavailable.")
  expect((await host.request("context")).system).toHaveLength(1)
})

test("generate follows active mode; compaction records external authority without enforcing style", async () => {
  const host = harness()
  await plugin.setup(host.context)
  await host.command("ultra")
  const generated = await host.request("generate")
  expect(generated.system[0]).toMatchObject({ text: expect.stringContaining("ULTRA") })
  const compacted = await host.request("compaction")
  expect(compacted.system).toEqual([
    { type: "text", text: "Original system instructions" },
    { type: "text", text: expect.stringContaining("Current caveman mode: ultra") },
  ])
  expect(JSON.stringify(compacted.system)).not.toContain("must continue")
  expect(compacted).not.toHaveProperty("result")
  await host.command("off")
  expect(JSON.stringify((await host.request("compaction")).system)).toContain("Current caveman mode: off")
  expect((await host.request("generate")).system).toHaveLength(1)
  expect(host.hooks.has("title")).toBe(false)
  expect(host.hooks.has("prompt")).toBe(false)
})

test("active instructions protect code and follow live settings instead of plain-text stop promises", async () => {
  const host = harness()
  await plugin.setup(host.context)
  const text = JSON.stringify((await host.request("context")).system)
  expect(text).toContain("Code blocks unchanged")
  expect(text).toContain("Error strings quoted exact")
  expect(text).toContain("Live plugin settings")
  expect(text).not.toContain('Only explicit user commands')
})

test("model tool changes shared mode through V2 structured result, including while off", async () => {
  const host = harness()
  await plugin.setup(host.context)
  await host.command("off")
  const result = await host.tool({ level: "lite" })
  expect(result).toEqual({ content: "Caveman: lite. Applied across server database." })
  expect((await host.request("context")).system[0]).toMatchObject({ text: expect.stringContaining("LITE") })
  expect(host.tools.get("caveman_set_level")?.input).toMatchObject({
    type: "object", required: ["level"], additionalProperties: false,
    properties: { level: { type: "string", enum: ["lite", "full", "ultra", "off"] } },
  })
})

test("command switches off durably; bare command reports status without model work", async () => {
  const host = harness()
  await plugin.setup(host.context)
  await host.command("off")
  expect(host.values.get("settings")).toEqual({ version: 1, level: "off" })
  expect(host.confirmations.at(-1)).toEqual({ sessionID: "session-a", text: "Caveman: off. Plugin rules disabled.", resume: false })
  expect((await host.request("context")).system).toEqual([
    { type: "text", text: "Original system instructions" },
  ])
  await host.command("")
  expect(host.writes).toBe(1)
  expect(host.confirmations.at(-1)?.text).toBe("Caveman: off.")
})

import { expect, test } from "bun:test"
import plugin from "../index.ts"
import { providerFixture } from "./provider-fixture.ts"

test("caveman commands deliver exact chat messages and wake model with persisted level", async () => {
  const fixture = await providerFixture([plugin])
  try {
    const session = await fixture.host.sessions.create({ location: { directory: fixture.root } })
    await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: "" })
    await fixture.host.sessions.wait({ sessionID: session.id })
    const lastConfirmation = async () => {
      const messages = await fixture.host.sessions.context({ sessionID: session.id })
      const last = messages.filter((message) => message.type === "synthetic").at(-1)
      return last?.text
    }
    expect(await lastConfirmation()).toBe("Caveman level: full")
    expect(fixture.requests.filter((request) => request.kind === "primary")).toHaveLength(1)
    for (const [index, level] of ["lite", "full", "ultra", "off"].entries()) {
      await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: level })
      await fixture.host.sessions.wait({ sessionID: session.id })
      expect(await lastConfirmation()).toBe(`Caveman level set to ${level}`)
      const primary = fixture.requests.filter((request) => request.kind === "primary")
      expect(primary).toHaveLength(index + 2)
      const system = JSON.stringify(primary.at(-1)?.messages.filter((message) => message.role === "system"))
      if (level === "off") expect(system).not.toContain("Caveman mode active")
      else expect(system).toContain(`Caveman mode active: ${level.toUpperCase()}`)
    }
    await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: "" })
    await fixture.host.sessions.wait({ sessionID: session.id })
    expect(await lastConfirmation()).toBe("Caveman level: off")
    expect(fixture.requests.filter((request) => request.kind === "primary")).toHaveLength(6)
  } finally {
    await fixture.close()
  }
}, 60_000)

test("real V2 generate dispatch lowers system rules; off removes them on next call", async () => {
  const fixture = await providerFixture([plugin])
  try {
    const session = await fixture.host.sessions.create({ location: { directory: fixture.root } })
    expect(await fixture.host.sessions.generate({ sessionID: session.id, prompt: "Generate brief reply" })).toEqual({ text: "Fixture reply." })
    const first = JSON.stringify(fixture.requests[0]?.messages)
    expect(first).toContain("Caveman mode active: FULL")
    expect(first).toContain("REMINDER")
    await fixture.host.plugin(plugin)
    await fixture.host.sessions.generate({ sessionID: session.id, prompt: "Reply after plugin reload" })
    expect(JSON.stringify(fixture.requests.at(-1)?.messages).match(/Caveman mode active: FULL/g)).toHaveLength(1)
    await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: "off" })
    await fixture.host.sessions.wait({ sessionID: session.id })
    const primary = fixture.requests.filter((request) => request.kind === "primary")
    expect(primary).toHaveLength(1)
    expect(JSON.stringify(primary[0]?.messages.filter((message) => message.role === "system"))).not.toContain("Caveman mode active")
    await fixture.host.sessions.generate({ sessionID: session.id, prompt: "Generate normal reply" })
    expect(JSON.stringify(fixture.requests.at(-1)?.messages)).not.toContain("Caveman mode active")
  } finally {
    await fixture.close()
  }
}, 30_000)

test("real tool continuation reads changed mode; titles neutral; off survives local compaction", async () => {
  const fixture = await providerFixture([plugin])
  try {
    const session = await fixture.host.sessions.create({ location: { directory: fixture.root } })
    fixture.useTool()
    await fixture.host.sessions.prompt({ sessionID: session.id, text: "Set lite mode through tool, then reply." })
    await fixture.host.sessions.wait({ sessionID: session.id })
    const primary = fixture.requests.filter((request) => request.kind === "primary")
    expect(primary).toHaveLength(2)
    expect(JSON.stringify(primary[0]?.messages)).toContain("Caveman mode active: FULL")
    expect(JSON.stringify(primary[1]?.messages)).toContain("Caveman mode active: LITE")
    expect(primary[1]?.messages.some((message) => message.role === "tool" && message.tool_call_id === "fixture-call")).toBe(true)
    expect(JSON.stringify(primary[1]?.messages.filter((message) => message.role === "tool"))).not.toContain("REMINDER")
    const titles = fixture.requests.filter((request) => request.kind === "title")
    expect(titles.length).toBeGreaterThan(0)
    expect(JSON.stringify(titles)).not.toContain("Caveman mode active")
    expect(JSON.stringify(await fixture.host.sessions.context({ sessionID: session.id }))).not.toContain("## Output contract")

    await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: "off" })
    await fixture.host.sessions.wait({ sessionID: session.id })
    await fixture.host.sessions.compact({ sessionID: session.id })
    await fixture.host.sessions.wait({ sessionID: session.id })
    const compactions = fixture.requests.filter((request) => request.kind === "compaction")
    expect(compactions.length).toBeGreaterThan(0)
    expect(JSON.stringify(compactions.at(-1)?.messages)).toContain("Current caveman mode: off")
    await fixture.host.sessions.prompt({ sessionID: session.id, text: "Reply after compaction." })
    await fixture.host.sessions.wait({ sessionID: session.id })
    const final = fixture.requests.filter((request) => request.kind === "primary").at(-1)
    expect(JSON.stringify(final?.messages.filter((message) => message.role === "system"))).not.toContain("Caveman mode active")
  } finally {
    await fixture.close()
  }
}, 30_000)

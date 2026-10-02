import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import plugin from "../index.ts"
import { providerFixture } from "./provider-fixture.ts"

test("installed V2 host executes command arguments and shares mode across projects and restart", async () => {
  const fixture = await providerFixture([plugin])
  const a = join(fixture.root, "project-a")
  const b = join(fixture.root, "project-b")
  try {
    await Promise.all([mkdir(a), mkdir(b)])
    const sessionA = await fixture.host.sessions.create({ location: { directory: a } })
    const sessionB = await fixture.host.sessions.create({ location: { directory: b } })
    await fixture.host.sessions.command({ sessionID: sessionA.id, name: "caveman", text: "off" })
    await fixture.host.sessions.wait({ sessionID: sessionA.id })
    await fixture.host.sessions.command({ sessionID: sessionB.id, name: "caveman", text: "" })
    await fixture.host.sessions.wait({ sessionID: sessionB.id })
    const active = await fixture.host.plugin.list({ location: { directory: a } })
    expect(JSON.stringify(active)).toContain("mumme-it.caveman")
    expect(JSON.stringify(await fixture.host.sessions.context({ sessionID: sessionB.id }))).toContain("Caveman level: off")
    await fixture.restart()
    await fixture.host.sessions.command({ sessionID: sessionA.id, name: "caveman", text: "" })
    await fixture.host.sessions.wait({ sessionID: sessionA.id })
    expect(JSON.stringify(await fixture.host.sessions.context({ sessionID: sessionA.id }))).toContain("Caveman level: off")
    await Promise.all([
      fixture.host.sessions.command({ sessionID: sessionA.id, name: "caveman", text: "lite" }),
      fixture.host.sessions.command({ sessionID: sessionB.id, name: "caveman", text: "ultra" }),
    ])
    await Promise.all([
      fixture.host.sessions.wait({ sessionID: sessionA.id }),
      fixture.host.sessions.wait({ sessionID: sessionB.id }),
    ])
    for (const session of [sessionA, sessionB]) {
      await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: "" })
      await fixture.host.sessions.wait({ sessionID: session.id })
    }
    const lastStatus = async (sessionID: string) => {
      const messages = await fixture.host.sessions.context({ sessionID })
      return messages.filter((message) => message.type === "synthetic").at(-1)?.text
    }
    const statusA = await lastStatus(sessionA.id)
    if (statusA === undefined) throw new Error("Missing status acknowledgement")
    expect(["Caveman level: lite", "Caveman level: ultra"]).toContain(statusA)
    expect(await lastStatus(sessionB.id)).toBe(statusA)
  } finally {
    await fixture.close()
  }
}, 60_000)

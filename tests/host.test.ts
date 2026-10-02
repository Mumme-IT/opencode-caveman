import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { OpenCode } from "@opencode/sdk"
import plugin from "../index.ts"

test("installed V2 host executes command arguments and shares mode across projects and restart", async () => {
  const root = await mkdtemp("/tmp/opencode/caveman-host-")
  const a = join(root, "project-a")
  const b = join(root, "project-b")
  await Promise.all([mkdir(a), mkdir(b)])
  const options: OpenCode.CreateOptions = {
    database: { path: join(root, "state.sqlite") },
    config: { directory: join(root, "config"), project: false, content: "{}" },
    models: { fetch: false, snapshot: false },
    fs: { filewatcher: false, fff: false },
    log: { level: "error", emit: () => {} },
    plugins: [plugin],
  }
  let host: OpenCode.Interface | undefined
  try {
    host = await OpenCode.create(options)
    const sessionA = await host.sessions.create({ location: { directory: a } })
    const sessionB = await host.sessions.create({ location: { directory: b } })
    await host.sessions.command({ sessionID: sessionA.id, name: "caveman", text: "off" })
    await host.sessions.command({ sessionID: sessionB.id, name: "caveman", text: "" })
    const active = await host.plugin.list({ location: { directory: a } })
    expect(JSON.stringify(active)).toContain("mumme-it.caveman")
    const inbox = await host.sessions.inbox.list({ sessionID: sessionB.id })
    expect(JSON.stringify(inbox)).toContain("Caveman: off.")
    expect(await host.sessions.context({ sessionID: sessionB.id })).toEqual([])
    await host.close()
    host = await OpenCode.create(options)
    await host.sessions.command({ sessionID: sessionA.id, name: "caveman", text: "" })
    expect(JSON.stringify(await host.sessions.inbox.list({ sessionID: sessionA.id }))).toContain("Caveman: off.")
    await Promise.all([
      host.sessions.command({ sessionID: sessionA.id, name: "caveman", text: "lite" }),
      host.sessions.command({ sessionID: sessionB.id, name: "caveman", text: "ultra" }),
    ])
    for (const session of [sessionA, sessionB]) {
      await host.sessions.command({ sessionID: session.id, name: "caveman", text: "" })
    }
    const lastStatus = async (sessionID: string) => {
      const inbox = await host!.sessions.inbox.list({ sessionID })
      const last = inbox.at(-1)
      return last?.type === "synthetic" ? last.payload.text : undefined
    }
    const statusA = await lastStatus(sessionA.id)
    if (statusA === undefined) throw new Error("Missing status acknowledgement")
    expect(["Caveman: lite.", "Caveman: ultra."]).toContain(statusA)
    expect(await lastStatus(sessionB.id)).toBe(statusA)
  } finally {
    await host?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

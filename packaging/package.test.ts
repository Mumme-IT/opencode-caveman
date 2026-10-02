import { expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { temporaryDirectory } from "../tests/temporary.ts"

const repository = dirname(dirname(fileURLToPath(import.meta.url)))

async function run(command: string[], cwd: string) {
  const process = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe", timeout: 90_000 })
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited,
  ])
  if (code !== 0) throw new Error(`${command.join(" ")} failed (${code})\n${stdout}\n${stderr}`)
  return stdout
}

test("packed V2-only package installs in clean consumer and runs on real V2 host", async () => {
  const root = await temporaryDirectory("caveman-package-")
  try {
    const result = JSON.parse(await run(["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", root], repository))
    const pack = result[0] as { filename: string; files: { path: string }[] }
    const paths = pack.files.map((file) => file.path).sort()
    expect(paths).toEqual(["LICENSE", "README.md", "dist/index.js", "package.json"])
    const consumer = join(root, "consumer")
    await mkdir(consumer)
    await writeFile(join(consumer, "package.json"), JSON.stringify({
      private: true, type: "module",
      dependencies: { "@mumme-it/opencode-caveman": `file:${join(root, pack.filename)}` },
    }))
    await run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--omit=optional"], consumer)
    const installed = join(consumer, "node_modules/@mumme-it/opencode-caveman")
    const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"))
    expect(manifest.dependencies).toEqual({ "@opencode/plugin": "2.0.21" })
    expect(manifest.repository).toEqual({ type: "git", url: "git+https://github.com/Mumme-IT/opencode-caveman.git" })
    expect(await readFile(join(installed, "dist/index.js"), "utf8")).not.toContain("@opencode-ai/")
    const script = join(consumer, "verify.ts")
    await writeFile(script, `
import assert from "node:assert/strict"
import plugin from "@mumme-it/opencode-caveman"
import { providerFixture } from ${JSON.stringify(join(repository, "tests/provider-fixture.ts"))}
assert.equal(plugin.id, "mumme-it.caveman")
assert.equal(typeof plugin.setup, "function")
assert.equal(plugin.server, undefined)
const fixture = await providerFixture([plugin])
try {
  const session = await fixture.host.sessions.create({ location: { directory: fixture.root } })
  await fixture.host.sessions.generate({ sessionID: session.id, prompt: "Installed package reply" })
  assert.match(JSON.stringify(fixture.requests[0].messages), /Caveman mode active: FULL/)
  await fixture.host.sessions.command({ sessionID: session.id, name: "caveman", text: "off" })
  await fixture.host.sessions.wait({ sessionID: session.id })
  const messages = await fixture.host.sessions.context({ sessionID: session.id })
  assert.equal(messages.filter((message) => message.type === "synthetic").at(-1)?.text, "Caveman level set to off")
  assert.ok(fixture.requests.some((request) => request.kind === "primary"))
  await fixture.host.sessions.generate({ sessionID: session.id, prompt: "Installed package off" })
  assert.doesNotMatch(JSON.stringify(fixture.requests.at(-1).messages), /Caveman mode active/)
} finally { await fixture.close() }
`)
    await run([process.execPath, script], consumer)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 180_000)

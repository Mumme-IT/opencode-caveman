import type { StorageDomain } from "@opencode/plugin/promise/storage"

export type CavemanLevel = "lite" | "full" | "ultra" | "off"

export function isValidLevel(value: unknown): value is CavemanLevel {
  return value === "lite" || value === "full" || value === "ultra" || value === "off"
}

export function createMode(storage: Pick<StorageDomain, "get" | "set">) {
  return {
    async get(): Promise<CavemanLevel> {
      const state: unknown = await storage.get("settings")
      if (state === undefined) return "full"
      if (state !== null && typeof state === "object" && !Array.isArray(state)
        && "version" in state && state.version === 1
        && "level" in state && isValidLevel(state.level)) return state.level
      throw new Error("Invalid caveman settings. Repair with /caveman lite|full|ultra|off.")
    },
    async set(level: CavemanLevel) {
      await storage.set("settings", { version: 1, level })
    },
  }
}

export type Mode = ReturnType<typeof createMode>

export function confirmation(level: CavemanLevel): string {
  return level === "off"
    ? "Caveman: off. Plugin rules disabled."
    : `Caveman: ${level}. Applied across server database.`
}

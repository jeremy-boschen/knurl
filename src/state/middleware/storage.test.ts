import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"

const bindingMocks = vi.hoisted(() => ({
  loadAppData: vi.fn(),
  saveAppData: vi.fn(),
  deleteAppData: vi.fn(),
  isAppError: vi.fn((e: any, codes?: string | string[]) => {
    const code = e?.appError?.code
    if (!codes) return Boolean(code)
    return Array.isArray(codes) ? codes.includes(code) : codes === code
  }),
}))

vi.mock("@/bindings/knurl", () => bindingMocks)

import { createStorage } from "./storage"

const { loadAppData, saveAppData, deleteAppData, isAppError } = bindingMocks

const schema = z.object({ foo: z.string() })

describe("createStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when load errors with FileNotFound/IoError", async () => {
    const storage = createStorage({ version: 1, schema })
    loadAppData.mockRejectedValueOnce({ appError: { code: "FileNotFound" } })

    const result = await storage.load("settings.json")
    expect(result).toBeNull()
    expect(isAppError).toHaveBeenCalledWith(expect.anything(), ["FileNotFound", "IoError"])
  })

  it("returns null when file header cannot be parsed", async () => {
    const storage = createStorage({ version: 1, schema })
    loadAppData.mockResolvedValueOnce({ corrupt: true })

    const result = await storage.load("bad.json")
    expect(result).toBeNull()
  })

  it("migrates old versions and persists migrated content", async () => {
    const storage = createStorage({
      version: 2,
      schema,
      migrate: vi.fn(async ({ content }) => ({ ...(content as any), foo: "migrated" })),
    })

    loadAppData.mockResolvedValueOnce({
      header: { version: 1, updated: new Date().toISOString() },
      content: { foo: "old" },
    })

    const result = await storage.load("migrate.json")
    expect(result).toEqual({ foo: "migrated" })
    expect(saveAppData).toHaveBeenCalledWith("migrate.json", expect.objectContaining({ header: { version: 2, updated: expect.any(String) }, content: { foo: "migrated" } }))
  })

  it("skips save/delete when storage is not writeable", async () => {
    const storage = createStorage({ version: 1, schema, writeable: false })
    await storage.save("readonly.json", { foo: "bar" })
    await storage.delete("readonly.json")
    expect(saveAppData).not.toHaveBeenCalled()
    expect(deleteAppData).not.toHaveBeenCalled()
  })
})

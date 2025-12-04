import { describe, expect, it } from "vitest"

import { computeShowableIds } from "./collection-tree-filter"
import type { Collection } from "@/types"

const buildCollection = (): Collection =>
  ({
    id: "col1",
    name: "My Collection",
    description: "",
    updated: new Date().toISOString(),
    encryption: { version: 1, keyId: "k", algorithm: "aes-gcm" } as any,
    activeEnvironmentId: undefined,
    environments: {},
    authentication: { type: "none" } as any,
    folders: {
      root: { id: "root", name: "Root", parentId: null, requestIds: ["r1"], folderIds: ["f1"] },
      f1: { id: "f1", name: "SubFolder", parentId: "root", requestIds: ["r2"], folderIds: [] },
    },
    requests: {
      r1: { id: "r1", name: "Get Users", method: "GET", url: "https://api/users", folderId: "root" } as any,
      r2: { id: "r2", name: "Create User", method: "POST", url: "https://api/users", folderId: "f1" } as any,
    },
  } as unknown as Collection)

describe("computeShowableIds", () => {
  it("returns empty set when no query", () => {
    const result = computeShowableIds(buildCollection(), "   ")
    expect(result.size).toBe(0)
  })

  it("includes matching request and its ancestors", () => {
    const result = computeShowableIds(buildCollection(), "create")
    expect(result.has("r2")).toBe(true)
    expect(result.has("f1")).toBe(true)
    expect(result.has("root")).toBe(true)
  })

  it("includes matching folder and its ancestors", () => {
    const result = computeShowableIds(buildCollection(), "subfolder")
    expect(result.has("f1")).toBe(true)
    expect(result.has("root")).toBe(true)
  })
})

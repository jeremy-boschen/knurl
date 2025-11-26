import { describe, expect, it } from "vitest"

import { RootCollectionFolderId } from "@/types"
import type { CollectionCache } from "@/types"
import { buildFolderOptions } from "./folder-options"

const baseCollection = (overrides: Partial<CollectionCache>): CollectionCache => {
  return {
    id: "col-1",
    name: "Test Collection",
    description: "",
    updated: new Date().toISOString(),
    encryption: { algorithm: "aes-gcm" },
    authentication: { type: "none" },
    activeEnvironmentId: undefined,
    environments: {},
    requests: {},
    folders: {
      [RootCollectionFolderId]: {
        id: RootCollectionFolderId,
        name: "Root",
        parentId: null,
        order: 0,
        childFolderIds: [],
        requestIds: [],
      },
    },
    requestIndex: {},
    ...overrides,
  }
}

describe("buildFolderOptions", () => {
  it("includes the root folder when no children exist", () => {
    const collection = baseCollection({})
    const options = buildFolderOptions(collection)
    expect(options).toHaveLength(1)
    expect(options[0]).toEqual({ id: RootCollectionFolderId, path: "Root", depth: 0 })
  })

  it("builds nested folder paths with correct depth", () => {
    const collection = baseCollection({
      folders: {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: ["folder-a", "folder-b"],
          requestIds: [],
        },
        "folder-a": {
          id: "folder-a",
          name: "Folder A",
          parentId: RootCollectionFolderId,
          order: 0,
          childFolderIds: ["folder-a-child"],
          requestIds: [],
        },
        "folder-a-child": {
          id: "folder-a-child",
          name: "Child",
          parentId: "folder-a",
          order: 0,
          childFolderIds: [],
          requestIds: [],
        },
        "folder-b": {
          id: "folder-b",
          name: "Folder B",
          parentId: RootCollectionFolderId,
          order: 1,
          childFolderIds: [],
          requestIds: [],
        },
      },
    })

    const options = buildFolderOptions(collection)
    expect(options).toEqual([
      { id: RootCollectionFolderId, path: "Root", depth: 0 },
      { id: "folder-a", path: "Root / Folder A", depth: 1 },
      { id: "folder-a-child", path: "Root / Folder A / Child", depth: 2 },
      { id: "folder-b", path: "Root / Folder B", depth: 1 },
    ])
  })

  it("skips missing folder references gracefully", () => {
    const collection = baseCollection({
      folders: {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: ["ghost"],
          requestIds: [],
        },
      },
    })

    const options = buildFolderOptions(collection)
    expect(options).toEqual([{ id: RootCollectionFolderId, path: "Root", depth: 0 }])
  })
})

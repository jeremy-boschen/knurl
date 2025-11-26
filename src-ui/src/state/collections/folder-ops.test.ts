import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { createFolderOps } from "./folder-ops"
import { markCollectionLoaded, removeCollectionFromLoadTracking } from "./core"
import { RootCollectionFolderId } from "@/types/collections/collection"
import type { Application, CollectionCache, RequestTabState } from "@/types"
import { createRequestFixture } from "@test/fixtures/collections"
import * as utils from "@/lib/utils"

const COLLECTION_ID = "col-1"

const uniqueIdSpy = vi.spyOn(utils, "generateUniqueId")

const createAppState = (): Application => {
  const collection: CollectionCache = {
    id: COLLECTION_ID,
    name: "Demo",
    description: undefined,
    updated: new Date().toISOString(),
    encryption: { algorithm: "aes-gcm" },
    authentication: { type: "none" },
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
  }

  return {
    collectionsState: {
      cache: { [COLLECTION_ID]: collection },
      index: [{ id: COLLECTION_ID, name: "Demo", count: 0 }],
    },
    requestTabsState: {
      openTabs: {},
      orderedTabs: [],
      activeTab: null,
    },
    requestTabsApi: {
      removeTab: vi.fn(),
    },
  } as unknown as Application
}

describe("createFolderOps", () => {
  let app: Application
  let folderOps: ReturnType<typeof createFolderOps>

  const runWithStore = () => {
    const set = (updater: (draft: Application) => void) => updater(app)
    const get = () => app
    folderOps = createFolderOps(set as any, get)
  }

  beforeEach(() => {
    app = createAppState()
    markCollectionLoaded(COLLECTION_ID)
    uniqueIdSpy.mockReturnValue("folder-generated")
    runWithStore()
  })

  afterEach(() => {
    removeCollectionFromLoadTracking(COLLECTION_ID)
    vi.clearAllMocks()
  })

  it("creates folders beneath the provided parent", () => {
    const folder = folderOps.createFolder(COLLECTION_ID, RootCollectionFolderId, "Child")
    const collection = app.collectionsState.cache[COLLECTION_ID]

    expect(folder.id).toBe("folder-generated")
    expect(collection.folders[folder.id]?.name).toBe("Child")
    expect(collection.folders[RootCollectionFolderId].childFolderIds).toContain(folder.id)
  })

  it("renames an existing folder", () => {
    app.collectionsState.cache[COLLECTION_ID].folders["child"] = {
      id: "child",
      name: "Old",
      parentId: RootCollectionFolderId,
      order: 0,
      childFolderIds: [],
      requestIds: [],
    }

    folderOps.renameFolder(COLLECTION_ID, "child", "Updated")

    expect(app.collectionsState.cache[COLLECTION_ID].folders["child"].name).toBe("Updated")
  })

  it("deletes folders, removes child requests, and closes open tabs", () => {
    const collection = app.collectionsState.cache[COLLECTION_ID]
    collection.folders["child"] = {
      id: "child",
      name: "Child",
      parentId: RootCollectionFolderId,
      order: 0,
      childFolderIds: [],
      requestIds: ["req-1"],
    }
    collection.folders[RootCollectionFolderId].childFolderIds.push("child")
    const request = createRequestFixture({ id: "req-1", folderId: "child", collectionId: COLLECTION_ID })
    collection.requests[request.id] = request
    collection.requestIndex[request.id] = { folderId: "child", ancestry: [] }
    app.collectionsState.index[0].count = 1
    const tab: RequestTabState = {
      tabId: "tab-1",
      order: 0,
      collectionId: COLLECTION_ID,
      requestId: "req-1",
      activeTab: "params",
      sending: false,
      response: {},
    }
    app.requestTabsState.openTabs[tab.tabId] = tab

    folderOps.deleteFolder(COLLECTION_ID, "child")

    expect(collection.folders.child).toBeUndefined()
    expect(collection.requests[request.id]).toBeUndefined()
    expect(app.collectionsState.index[0].count).toBe(0)
    expect(app.requestTabsApi.removeTab).toHaveBeenCalledWith("tab-1")
  })

  it("moves folders to a new parent", () => {
    const collection = app.collectionsState.cache[COLLECTION_ID]
    collection.folders["a"] = {
      id: "a",
      name: "A",
      parentId: RootCollectionFolderId,
      order: 0,
      childFolderIds: [],
      requestIds: [],
    }
    collection.folders["b"] = {
      id: "b",
      name: "B",
      parentId: RootCollectionFolderId,
      order: 1,
      childFolderIds: [],
      requestIds: [],
    }
    collection.folders[RootCollectionFolderId].childFolderIds.push("a", "b")

    folderOps.moveFolder(COLLECTION_ID, "a", "b")

    expect(collection.folders["b"].childFolderIds).toContain("a")
  })

  it("reorders folders under a parent", () => {
    const collection = app.collectionsState.cache[COLLECTION_ID]
    collection.folders["a"] = {
      id: "a",
      name: "A",
      parentId: RootCollectionFolderId,
      order: 0,
      childFolderIds: [],
      requestIds: [],
    }
    collection.folders["b"] = {
      id: "b",
      name: "B",
      parentId: RootCollectionFolderId,
      order: 1,
      childFolderIds: [],
      requestIds: [],
    }
    collection.folders[RootCollectionFolderId].childFolderIds = ["a", "b"]

    folderOps.reorderFolders(COLLECTION_ID, RootCollectionFolderId, ["b", "a"])

    expect(collection.folders[RootCollectionFolderId].childFolderIds).toEqual(["b", "a"])
  })
})

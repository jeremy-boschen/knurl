import { beforeEach, describe, expect, it, vi } from "vitest"

import { createCollectionOps } from "./collection-ops"
import { CollectionFileName, CollectionStorage, ScratchCollectionId, markCollectionLoaded } from "./core"
import type { Application, CollectionCache } from "@/types"
import { RootCollectionFolderId } from "@/types/collections/collection"
import { invalidateCollectionPromise } from "@/state/application"

vi.mock("@/state/application", () => ({
  invalidateCollectionPromise: vi.fn(),
}))

type TestApp = Application & {
  collectionsState: Application["collectionsState"]
  collectionsApi: Application["collectionsApi"]
  requestTabsApi: Application["requestTabsApi"]
}

const createScratch = (): CollectionCache => ({
  id: ScratchCollectionId,
  name: "Scratches",
  description: "",
  updated: new Date().toISOString(),
  encryption: { algorithm: "aes-gcm" },
  authentication: { type: "none" },
  environments: {},
  requests: {
    req1: { id: "req1", name: "Req", method: "GET", url: "https://api", patch: {}, folderId: RootCollectionFolderId } as any,
  },
  folders: {
    [RootCollectionFolderId]: {
      id: RootCollectionFolderId,
      name: "Root",
      parentId: null,
      order: 0,
      childFolderIds: [],
      requestIds: ["req1"],
    },
  },
  requestIndex: { req1: { id: "req1" } } as any,
})

const createApp = (): TestApp => {
  const scratch = createScratch()
  const cache = {
    [ScratchCollectionId]: scratch,
    "col-2": {
      ...scratch,
      id: "col-2",
      name: "Secondary",
      requests: {},
      folders: { [RootCollectionFolderId]: { ...scratch.folders[RootCollectionFolderId], requestIds: [] } },
      requestIndex: {},
    },
  }
  const index = [
    { id: ScratchCollectionId, name: "Scratches", order: 0, count: 1 },
    { id: "col-2", name: "Secondary", order: 1, count: 0 },
  ]

  const app = {
    collectionsState: { cache, index },
    collectionsApi: { getCollection: (id: string) => cache[id] },
    requestTabsState: {
      openTabs: {
        t1: { tabId: "t1", collectionId: ScratchCollectionId },
      },
    },
    requestTabsApi: { removeTab: vi.fn() },
  } as TestApp
  return app
}

const setWrapper = (app: Application) => (updater: (draft: Application) => void) => updater(app)
const getWrapper = (app: Application) => () => app

describe("collection-ops", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("saves a collection by id", async () => {
    const app = createApp()
    const ops = createCollectionOps(setWrapper(app), getWrapper(app))
    const saveSpy = vi.spyOn(CollectionStorage, "save").mockResolvedValue()
    markCollectionLoaded(ScratchCollectionId)

    await ops.saveCollection(ScratchCollectionId)

    expect(saveSpy).toHaveBeenCalledWith(CollectionFileName(ScratchCollectionId), expect.any(Object))
  })

  it("clears scratch collection requests and closes tabs", () => {
    const app = createApp()
    const ops = createCollectionOps(setWrapper(app), getWrapper(app))

    ops.clearScratchCollection()

    expect(app.collectionsState.cache[ScratchCollectionId].requests).toEqual({})
    expect(app.collectionsState.cache[ScratchCollectionId].folders[RootCollectionFolderId].requestIds).toEqual([])
    expect(app.collectionsState.index.find((entry) => entry.id === ScratchCollectionId)?.count).toBe(0)
    expect(app.requestTabsApi.removeTab).toHaveBeenCalledWith("t1")
    expect(invalidateCollectionPromise).toHaveBeenCalledWith(ScratchCollectionId)
  })

  it("removes non-scratch collections and deletes stored file", async () => {
    const app = createApp()
    const ops = createCollectionOps(setWrapper(app), getWrapper(app))
    const deleteSpy = vi.spyOn(CollectionStorage, "delete").mockResolvedValue()

    await ops.removeCollection("col-2")

    expect(app.collectionsState.cache["col-2"]).toBeUndefined()
    expect(app.collectionsState.index.find((entry) => entry.id === "col-2")).toBeUndefined()
    expect(deleteSpy).toHaveBeenCalledWith(CollectionFileName("col-2"))
    expect(invalidateCollectionPromise).toHaveBeenCalledWith("col-2")
  })
})

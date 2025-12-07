import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

vi.mock("@/state/collections-lib", async () => {
  const actual = await vi.importActual<typeof import("@/state/collections-lib")>("@/state/collections-lib")
  return {
    ...actual,
    sanitizeCollection: vi.fn((collection) => ({ ...collection, sanitized: true })),
  }
})

import * as CoreModule from "./core"
const {
  CollectionIndexStorage,
  CollectionStorage,
  ScratchCollectionId,
  clearLoadedCollectionsForTesting,
  existsInIndex,
  internalAddCollection,
  loadScratchCollection,
  createEnvironment,
  markCollectionLoaded,
  getLoadedCollection,
  touch,
  setupCollectionStorage,
} = CoreModule
import { loadAppData, saveAppData } from "@/bindings/knurl"
import { RootCollectionFolderId } from "@/types/collections/collection"
import type { Application, Collection, CollectionCache } from "@/types"
import { sanitizeCollection } from "@/state/collections-lib"
const sanitizeCollectionMock = sanitizeCollection as unknown as vi.Mock

vi.mock("@/bindings/knurl", () => {
  const loadAppData = vi.fn()
  const saveAppData = vi.fn()
  const deleteAppData = vi.fn()
  const isAppError = (error: { code?: string } | undefined, codes: string[]) =>
    !!error && typeof error.code === "string" && codes.includes(error.code)
  return { isAppError, loadAppData, saveAppData, deleteAppData }
})

const createAppState = (): Application => ({
  collectionsState: {
    cache: {},
    index: [{ id: ScratchCollectionId, name: "Scratch", count: 0, order: 0 }],
  },
} as unknown as Application)

describe("collections/core", () => {
  const set = (app: Application) => (updater: (draft: Application) => void) => updater(app)
  const get = (app: Application) => () => app

  beforeEach(() => {
    clearLoadedCollectionsForTesting()
    vi.mocked(loadAppData).mockReset()
    vi.mocked(saveAppData).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("adds new collections and assigns index order", () => {
    const app = createAppState()
    const collection: Collection = {
      id: "col-1",
      name: "Demo",
      description: undefined,
      updated: new Date().toISOString(),
      encryption: { algorithm: "aes-gcm" },
      authentication: { type: "none" },
      environments: {},
      requests: {},
      folders: { [RootCollectionFolderId]: { id: RootCollectionFolderId, name: "Root", parentId: null, order: 0, childFolderIds: [], requestIds: [] } },
    }
    const setSpy = set(app)
    const added = internalAddCollection(collection, setSpy)

    expect(added.id).toBe("col-1")
    expect(app.collectionsState.cache["col-1"]).toBeDefined()
    expect(app.collectionsState.index.some((entry) => entry.id === "col-1" && entry.order && entry.order > 0)).toBe(true)
  })

  it("loads scratch collection from storage when available", async () => {
    const app = createAppState()
    const stored: Collection = {
      id: ScratchCollectionId,
      name: "Scratches",
      description: "",
      updated: new Date().toISOString(),
      encryption: { algorithm: "aes-gcm" },
      authentication: { type: "none" },
      environments: {},
      requests: {},
      folders: { [RootCollectionFolderId]: { id: RootCollectionFolderId, name: "Root", parentId: null, order: 0, childFolderIds: [], requestIds: [] } },
    }
    vi.spyOn(CollectionStorage, "load").mockResolvedValueOnce(stored)

    const result = await loadScratchCollection(set(app), get(app))

    expect(result.id).toBe(ScratchCollectionId)
    expect(app.collectionsState.cache[ScratchCollectionId]).toBeDefined()
  })

  it("creates scratch collection when storage missing", async () => {
    const app = createAppState()
    vi.spyOn(CollectionStorage, "load").mockRejectedValueOnce({ code: "FileNotFound" })

    const result = await loadScratchCollection(set(app), get(app))

    expect(result.id).toBe(ScratchCollectionId)
    expect(app.collectionsState.cache[ScratchCollectionId]).toBeDefined()
  })

  it("checks existence in index and generates environments", () => {
    const app = createAppState()
    ;(app.collectionsState.index as any).push({ id: "col-2", name: "Secondary", count: 0 })

    expect(existsInIndex(get(app), ScratchCollectionId)).toBe(true)
    expect(existsInIndex(get(app), "col-2")).toBe(true)
    expect(existsInIndex(get(app), "missing")).toBe(false)

    const env = createEnvironment({ name: "Prod" })
    expect(env.id).toBeDefined()
    expect(env.name).toBe("Prod")
  })

  it("requires collections to be marked as loaded before retrieval", () => {
    const app = createAppState()
    const collection = {
      id: "col-loaded",
      name: "Loaded",
      description: "",
      updated: new Date(Date.now() - 1000).toISOString(),
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
    } as unknown as CollectionCache

    ;(app.collectionsState.cache as any)[collection.id] = collection

    expect(() => getLoadedCollection(get(app), collection.id)).toThrow(/must be loaded/)
    markCollectionLoaded(collection.id)
    expect(getLoadedCollection(get(app), collection.id)).toBe(collection)

    const previousTimestamp = collection.updated
    const touched = touch(collection as unknown as Collection)
    expect(touched.updated).not.toBe(previousTimestamp)
  })

  it("registers storage provider and loads index data", async () => {
    const app = createAppState()
    const registerStorageProvider = vi.fn()
    const provider = setupCollectionStorage(set(app), get(app), { registerStorageProvider })

    expect(registerStorageProvider).toHaveBeenCalledWith(provider)

    const loadedIndex = [
      { id: ScratchCollectionId, name: "Scratch", order: 0, count: 0 },
      { id: "col-next", name: "Next", order: 1, count: 2 },
    ]
    vi.spyOn(CollectionIndexStorage, "load").mockResolvedValueOnce(loadedIndex as any)

    await provider.load?.()
    expect(app.collectionsState.index).toEqual(loadedIndex)
  })

  it("saves index and only dirty collections unless force=true", async () => {
    const app = createAppState()
    const collectionA: CollectionCache = {
      id: "col-a",
      name: "Alpha",
      description: "",
      updated: "2025-11-19T00:00:00.000Z",
      encryption: { algorithm: "aes-gcm" },
      authentication: { type: "none" },
      environments: {},
      folders: { [RootCollectionFolderId]: { id: RootCollectionFolderId, name: "Root", parentId: null, order: 0, childFolderIds: [], requestIds: [] } },
      requests: {},
      requestIndex: {},
    }
    const collectionB: CollectionCache = {
      ...collectionA,
      id: "col-b",
      name: "Beta",
    }
    ;(app.collectionsState.cache as any)[collectionA.id] = collectionA
    ;(app.collectionsState.cache as any)[collectionB.id] = collectionB
    const saveIndex = vi.spyOn(CollectionIndexStorage, "save").mockResolvedValue(undefined)
    const saveCollection = vi.spyOn(CollectionStorage, "save").mockResolvedValue(undefined)
    const provider = setupCollectionStorage(set(app), get(app), { registerStorageProvider: vi.fn() })

    await provider.save?.(false)
    expect(saveIndex).toHaveBeenCalledTimes(1)
    expect(saveCollection).toHaveBeenCalledTimes(2)
    expect(sanitizeCollectionMock).toHaveBeenCalledTimes(2)

    saveCollection.mockClear()
    sanitizeCollectionMock.mockClear()
    collectionB.updated = "2025-11-19T01:00:00.000Z"

    await provider.save?.(false)
    expect(saveCollection).toHaveBeenCalledTimes(1)

    saveCollection.mockClear()
    sanitizeCollectionMock.mockClear()
    await provider.save?.(true)
    expect(saveCollection).toHaveBeenCalledTimes(2)
    expect(sanitizeCollectionMock).toHaveBeenCalledTimes(2)
  })

  it("migrates index ordering for legacy versions", async () => {
    const entries = [
      { id: "c2", name: "Two" },
      { id: ScratchCollectionId, name: "Scratch" },
      { id: "c1", name: "One" },
    ] as any
    vi.mocked(loadAppData).mockResolvedValueOnce({
      header: { version: 1, updated: new Date().toISOString() },
      content: entries,
    })
    const migrated = await CollectionIndexStorage.load("index.json")
    expect(migrated[0].id).toBe(ScratchCollectionId)
    expect(migrated.find((e) => e.id === "c1")?.order).toBe(2)
    expect(migrated.find((e) => e.id === "c2")?.order).toBe(1)
    expect(saveAppData).toHaveBeenCalled()
  })

  it("migrates request order for legacy collections", async () => {
    const baseRequest = {
      collectionId: "legacy",
      folderId: RootCollectionFolderId,
      order: 0,
      pathParams: {},
      queryParams: {},
      headers: {},
      cookieParams: {},
      body: { type: "none" },
      authentication: { type: "none" },
      method: "GET",
      url: "https://example.com",
    }
    const collection = {
      id: "legacy",
      name: "Legacy",
      description: "",
      updated: "2020-01-01T00:00:00.000Z",
      encryption: { algorithm: "aes-gcm" },
      authentication: { type: "none" },
      environments: {},
      folders: {
        [RootCollectionFolderId]: {
          id: RootCollectionFolderId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: [],
          requestIds: ["b", "a"],
        },
      },
      requests: {
        a: { ...baseRequest, id: "a", name: "Alpha", order: 0 },
        b: { ...baseRequest, id: "b", name: "beta", order: 0 },
      },
      requestIndex: {},
    } as any

    vi.mocked(loadAppData).mockResolvedValueOnce({
      header: { version: 1, updated: new Date().toISOString() },
      content: collection,
    })
    const migrated = await CollectionStorage.load("collection.json")
    const root = migrated.folders[RootCollectionFolderId]
    expect(root.requestIds).toEqual(["a", "b"])
    expect(migrated.requests.a.order).toBe(1)
    expect(migrated.requests.b.order).toBe(2)
    expect(saveAppData).toHaveBeenCalled()
  })
})

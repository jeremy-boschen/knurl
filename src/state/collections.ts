import { merge, mergeWith, toMerged } from "es-toolkit"
import { current } from "immer"
import type { StateCreator } from "zustand"

import { isAppError } from "@/bindings/knurl"
import { assert, generateUniqueId, isNotEmpty, nonNull } from "@/lib/utils"
import { invalidateCollectionPromise } from "@/state/application"
import type { MergeSummary } from "@/state/collections-lib"
import {
  applyBodyPatchUpdates,
  applyMergePlan,
  buildEnvironmentState,
  countCollectionRequests,
  createFolderNode,
  deleteFolderCascade,
  ensureObjectPatch,
  ensureParamPatch,
  ensureRequestPatch,
  findRequestInCollection,
  getFolderOrThrow,
  insertChildFolder,
  insertRequestIntoFolder,
  moveFolderNode,
  moveRequestWithinCollection,
  normalizeCollection,
  normalizeImportedCollection,
  prepareMergePlan,
  pruneObjectPatchIfEqual,
  pruneParamPatchIfEqual,
  removeRequestFromFolder,
  reorderChildFolders,
  reorderFolderRequests,
  sanitizeCollection,
  validateRequestIndex,
} from "@/state/collections-lib"
import { createStorage, type MigrateContext } from "@/state/middleware/storage"
import { zParse } from "@/state/utils"
import {
  type Application,
  type ClientOptionsData,
  type Collection,
  type CollectionCache,
  type CollectionFolderNode,
  type CollectionsApi,
  type CollectionsIndex,
  type CollectionsIndexEntry,
  type CollectionsSlice,
  type CollectionsState,
  type Environment,
  type EnvironmentVariable,
  type ExportedCollection,
  type FormField,
  type RequestBodyData,
  type RequestCookieParam,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  RootCollectionFolderId,
  zCollection,
  zCollectionsIndex,
  zEnvironmentVariable,
  zRequestCookieParam,
  zRequestHeader,
  zRequestPathParam,
  zRequestQueryParam,
  zRequestState,
} from "@/types"
import type { Some } from "@/types/common"
import type { StorageProvider } from "@/types/middleware/storage-manager"
import type { AuthConfig } from "@/types/request"

export { sanitizeCollection } from "@/state/collections-lib"

const loadedCollections = new Set<string>()
const shouldTraceCollectionDiagnostics = import.meta.env?.DEV === true

type CollectionLoadTrace = {
  capturedAt: number
  stack?: string
}

const collectionLoadTraces = shouldTraceCollectionDiagnostics ? new Map<string, CollectionLoadTrace>() : undefined

const captureCollectionLoadTrace = (collectionId: string) => {
  if (!collectionLoadTraces) {
    return
  }
  const stack = new Error().stack
  const trimmed = stack ? stack.split("\n").slice(2).join("\n") : undefined
  collectionLoadTraces.set(collectionId, {
    capturedAt: Date.now(),
    stack: trimmed,
  })
}

const logMissingCollectionLoad = (collectionId: string) => {
  if (!collectionLoadTraces) {
    return
  }
  const loaded = Array.from(loadedCollections)
  const trace = collectionLoadTraces.get(collectionId)
  console.error("[collections] Collection accessed before load", {
    requestedId: collectionId,
    loadedIds: loaded.slice(0, 8),
    totalLoaded: loaded.length,
    lastLoadTrace: trace?.stack,
    lastLoadAt: trace?.capturedAt,
  })
}

const markCollectionLoaded = (collectionId: string) => {
  loadedCollections.add(collectionId)
  captureCollectionLoadTrace(collectionId)
}

const assertCollectionLoaded = (collectionId: string) => {
  if (!loadedCollections.has(collectionId)) {
    logMissingCollectionLoad(collectionId)
  }
  assert(loadedCollections.has(collectionId), `Collection ${collectionId} must be loaded via loadCollection before use`)
}

const CollectionIndexStorage = createStorage<CollectionsIndex["index"]>({
  version: 2,
  schema: zCollectionsIndex.shape.index,
  migrate: async (context: MigrateContext) => {
    const content = (context.content as Partial<CollectionsIndex["index"]>) ?? []

    // v2: introduce optional `order` field; preserve existing order, keep scratch first
    if (context.version < 2) {
      const entries: CollectionsIndexEntry[] = Array.isArray(content)
        ? (content.slice() as CollectionsIndexEntry[])
        : []
      // Ensure scratch first
      entries.sort((a, b) => (a?.id === ScratchCollectionId ? -1 : b?.id === ScratchCollectionId ? 1 : 0))
      let seq = 0
      for (const e of entries) {
        if (!e) {
          continue
        }
        // Keep scratch at the top; assign lowest order
        if (e.id === ScratchCollectionId) {
          e.order = 0
          continue
        }
        seq += 1
        e.order = e.order ?? seq
      }
      return entries as CollectionsIndex["index"]
    }

    return content as CollectionsIndex["index"]
  },
})
const CollectionIndexFileName = () => "collections/.index.json"

const CollectionStorage = createStorage<Collection>({
  version: 1,
  schema: zCollection,
  migrate: async (context: MigrateContext) => {
    const content = context.content as Partial<Collection>
    // Add migration logic here
    //
    // Example:
    // if (context.version < 2) {
    //   // Migrate from version 1 to 2
    // }
    // if (context.version < 3) {
    //   // Migrate from version 2 to 3
    // }

    return content as Collection
  },
})

const CollectionFileName = (id: string) => `collections/${id}.json`

export const ScratchCollectionId = "scratch"
export const isScratchCollection = (collection: Collection | string) =>
  (typeof collection === "string" ? collection : collection.id) === ScratchCollectionId

export const createCollectionsSlice: StateCreator<
  Application,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CollectionsSlice
> = (set, get, storeApi) => {
  // Hookup load/save
  const storageProvider: StorageProvider<CollectionsState> = (() => {
    const timestamps: Record<string, string> = {}

    // Helpers now provided at module scope; no closure exposure required

    return {
      key: "collections",
      selector: (app) => app.collectionsState,
      throttleWait: 2000,
      shouldSave: (prev, current) => prev !== current,
      load: async () => {
        const index = await CollectionIndexStorage.load(CollectionIndexFileName())
        if (index) {
          set((app) => {
            app.collectionsState.index = index
          })
        }
      },
      save: async (force: boolean | undefined) => {
        const state = get().collectionsState

        const promises: Promise<void>[] = []

        // Always save the index
        promises.push(CollectionIndexStorage.save(CollectionIndexFileName(), state.index))

        for (const collection of Object.values(state.cache)) {
          if (force || timestamps[collection.id] !== collection.updated) {
            promises.push(CollectionStorage.save(CollectionFileName(collection.id), sanitizeCollection(collection)))
            timestamps[collection.id] = collection.updated
          }
        }
        await Promise.all(promises)
      },
    }
  })()
  storeApi.registerStorageProvider(storageProvider)

  const touch = (collection: Collection): Collection => {
    collection.updated = new Date().toISOString()
    return collection
  }

  function getLoadedCollection(collectionId: string): CollectionCache {
    assertCollectionLoaded(collectionId)
    const collection = get().collectionsState.cache[collectionId]
    assert(collection, `Collection ${collectionId} must be loaded before invoking collectionsApi mutator`)
    return collection
  }

  function internalAddCollection(
    collection: Collection | CollectionCache,
    setter: (recipe: (draft: Application) => void) => void = set,
  ): CollectionCache {
    const normalized = (collection as CollectionCache).requestIndex
      ? (collection as CollectionCache)
      : normalizeCollection(collection as Collection)

    setter((app) => {
      const now = new Date().toISOString()

      app.collectionsState.cache[normalized.id] = normalized
      // Only add to the index once
      if (!app.collectionsState.index.some((m) => m.id === normalized.id)) {
        // Compute next order (scratch stays 0)
        const nonScratch = app.collectionsState.index.filter((e) => e.id !== ScratchCollectionId)
        const maxOrder = Math.max(0, ...nonScratch.map((e) => e.order ?? 0))
        const nextOrder = normalized.id === ScratchCollectionId ? 0 : maxOrder + 1

        app.collectionsState.index.push({
          id: normalized.id,
          order: nextOrder,
          name: normalized.name,
          count: countCollectionRequests(normalized),
          created: now,
          updated: now,
        })

        // Keep array sorted by order with scratch first
        app.collectionsState.index.sort((a, b) => {
          if (a.id === ScratchCollectionId) {
            return -1
          }
          if (b.id === ScratchCollectionId) {
            return 1
          }
          return (a.order ?? 0) - (b.order ?? 0)
        })
      }
    })
    markCollectionLoaded(normalized.id)
    return normalized
  }

  async function loadScratchCollection() {
    let collection: Collection | null = null
    try {
      collection = await CollectionStorage.load(CollectionFileName(ScratchCollectionId))
    } catch (e) {
      if (!isAppError(e, ["FileNotFound", "IoError"])) {
        throw e
      }
    }

    if (collection) {
      return internalAddCollection(collection, set)
    }

    // First time creating the scratch collection
    const now = new Date().toISOString()
    collection = {
      id: ScratchCollectionId,
      name: "Scratches",
      description: "A collection that holds scratch requests",
      updated: now,
      encryption: {
        algorithm: "aes-gcm",
        key: undefined,
      },
      environments: {},
      requests: {},
      folders: {
        [RootCollectionFolderId]: createFolderNode(RootCollectionFolderId, "Scratch", null),
      },
      authentication: {
        type: "none",
      },
    }

    return internalAddCollection(collection, set)
  }

  function existsInIndex(id: string): boolean {
    return id === ScratchCollectionId || get().collectionsState.index.some((m) => m.id === id)
  }

  function createEnvironment(environment: Partial<Environment>) {
    return buildEnvironmentState({
      ...environment,
      id: generateUniqueId(),
    })
  }

  ///
  /// CollectionsApi
  ///
  const collectionsApi: CollectionsApi = {
    getCollectionsIndex(): CollectionsIndexEntry[] {
      return get().collectionsState.index
    },

    reorderCollections(orderIds: string[]) {
      set((app) => {
        const current = app.collectionsState.index.slice()
        const reord = orderIds
          .map((id) => current.find((e) => e.id === id))
          .filter((e): e is CollectionsIndexEntry => !!e)
        // Append any not present in orderIds to the end to be safe
        for (const e of current) {
          if (!reord.some((x) => x.id === e.id)) {
            reord.push(e)
          }
        }

        // Assign sequential order starting at 0
        let seq = 0
        for (const e of reord) {
          e.order = seq
          seq += 1
        }
        app.collectionsState.index = reord
      })

      void CollectionIndexStorage.save(CollectionIndexFileName(), get().collectionsState.index).catch((error) => {
        console.error("Failed to persist collections index", error)
      })
    },

    //
    // CollectionsApi
    //

    saveCollection(collection: CollectionCache | string) {
      const cached = typeof collection === "string" ? getLoadedCollection(collection) : collection

      assert(existsInIndex(cached.id), `saveCollection called with an unknown collection.id: ${cached.id}`)

      // Redact runtime-only secrets before persisting
      void CollectionStorage.save(CollectionFileName(cached.id), sanitizeCollection(cached)).catch((error) => {
        console.error(`Failed to save collection ${cached.id}`, error)
      })
    },

    async loadCollection(id: string) {
      assert(existsInIndex(id), `loadCollection called with an unknown collection.id: ${id}`)

      const cached = get().collectionsState.cache[id]
      if (cached) {
        markCollectionLoaded(id)
        return cached
      }

      if (ScratchCollectionId === id) {
        // Special logic for loading the scratch collection
        return loadScratchCollection()
      }

      const collection = nonNull(
        await CollectionStorage.load(CollectionFileName(id)),
        `Collection file ${CollectionFileName(id)} could not be loaded`,
      )

      return internalAddCollection(collection)
    },

    getCollection(id: string) {
      assert(existsInIndex(id), `getCollection called with an unknown collection.id: ${id}`)

      return getLoadedCollection(id)
    },

    ///
    addCollection(name: string, description?: string) {
      const now = new Date().toISOString()
      const newCollection: Collection = {
        id: generateUniqueId(),
        name,
        description,
        updated: now,
        encryption: {
          algorithm: "aes-gcm",
          key: undefined,
        },
        environments: {},
        requests: {},
        folders: {
          [RootCollectionFolderId]: createFolderNode(RootCollectionFolderId, "Root", null),
        },
        authentication: {
          type: "none",
        },
      }

      return internalAddCollection(newCollection)
    },

    exportCollection: (collectionId: string): ExportedCollection => {
      const collection = collectionsApi.getCollection(collectionId)

      // Redact runtime-only secrets before exporting
      const sanitized = sanitizeCollection(collection)
      return {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: sanitized,
      }
    },

    importCollection: (exported: ExportedCollection, overrideName?: string): CollectionCache => {
      const normalized = normalizeImportedCollection(exported, overrideName)
      return internalAddCollection(normalized, set)
    },

    mergeCollection: (collectionId: string, exported: ExportedCollection) => {
      assertCollectionLoaded(collectionId)
      assert(existsInIndex(collectionId), `mergeCollection called with an unknown collection.id: ${collectionId}`)

      const currentCollection = get().collectionsState.cache[collectionId]
      assert(currentCollection, `mergeCollection called with unloaded collection.id: ${collectionId}`)

      const plan = prepareMergePlan(currentCollection, exported)
      let mergeSummary: MergeSummary | null = null

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `mergeCollection called with unloaded collection.id: ${collectionId}`,
          ),
        )

        mergeSummary = applyMergePlan(collection, plan)
        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `mergeCollection called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
        index.updated = collection.updated
      })

      return mergeSummary ?? plan.summary
    },

    ///
    updateCollection(collectionId: string, update: Partial<Collection>) {
      // Ensure that update cannot change collectionId
      assert(
        update.id === undefined || update.id === collectionId,
        `updateCollection called with mismatched id:${collectionId} !== update.id:${update.id}`,
      )

      assertCollectionLoaded(collectionId)
      getLoadedCollection(collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during collection update`)
        const draft = touch(draftCollection)
        merge(draft, update)

        if (update.name) {
          const index = nonNull(
            app.collectionsState.index.find((e) => e.id === collectionId),
            `updateCollection called with non-indexed collection.id: ${collectionId}`,
          )
          index.name = update.name
          index.updated = new Date().toISOString()
        }
      })

      return getLoadedCollection(collectionId)
    },

    clearScratchCollection() {
      const scratch = collectionsApi.getCollection(ScratchCollectionId)
      const requestIds = Object.keys(scratch.requests)

      if (requestIds.length === 0) {
        return
      }

      const { requestTabsApi } = get()

      // Close all open tabs for requests in the scratch collection
      const openTabs = Object.values(get().requestTabsState.openTabs)
      for (const tab of openTabs) {
        if (tab.collectionId === ScratchCollectionId) {
          // Do not wait for the tab to be removed
          void requestTabsApi.removeTab(tab.tabId)
        }
      }

      set((app) => {
        const scratchCollection = touch(
          nonNull(
            app.collectionsState.cache[ScratchCollectionId],
            "clearScratchCollection called but scratch collection not loaded",
          ),
        )
        scratchCollection.requests = {}
        for (const folder of Object.values(scratchCollection.folders)) {
          folder.requestIds = []
        }
        scratchCollection.requestIndex = {}

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === ScratchCollectionId),
          "clearScratchCollection called with non-indexed scratch collection",
        )
        index.count = 0
      })

      invalidateCollectionPromise(ScratchCollectionId)
    },

    ///
    removeCollection(id: string) {
      assert(existsInIndex(id), `updateCollection called with an unknown collection.id: ${id}`)

      if (ScratchCollectionId === id) {
        throw new Error("Cannot remove the unsaved collection")
      }

      set((app) => {
        // An unloaded collection can be removed, so we can't assume it exists in the cache
        delete app.collectionsState.cache[id]
        loadedCollections.delete(id)
        app.collectionsState.index = app.collectionsState.index.filter((e) => e.id !== id)
      })

      invalidateCollectionPromise(id)

      // We need to manually delete the collection file since the save logic will only pick up the index change
      // Fire & Forget
      void CollectionStorage.delete(CollectionFileName(id)).catch((error) => {
        console.error(`Failed to delete collection ${id}`, error)
      })
    },

    ///
    createEnvironment(collectionId: string, name: string, description?: string) {
      assert(existsInIndex(collectionId), `updateCollection called with an unknown collection.id: ${collectionId}`)

      getLoadedCollection(collectionId)

      const newEnvironment = createEnvironment({ name, description })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment creation`)
        const environments = touch(draftCollection).environments
        assert(environments, `Collection ${collectionId} missing environments map during creation`)
        environments[newEnvironment.id] = newEnvironment
      })

      return newEnvironment
    },

    ///
    updateEnvironment(collectionId: string, id: string, update: Partial<Environment>) {
      assert(existsInIndex(collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === id,
        `updateEnvironment expected update.id to be absent or equal to id:${id}. Found ${update.id}`,
      )

      const collection = getLoadedCollection(collectionId)

      assert(
        collection.environments?.[id],
        `updateEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment update`)
        const environment = touch(draftCollection).environments?.[id]
        assert(environment, `Environment ${id} missing from collection ${collectionId} during update`)
        merge(environment, update)
      })
    },

    ///
    deleteEnvironment(collectionId: string, id: string) {
      assert(existsInIndex(collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      const collection = getLoadedCollection(collectionId)
      assert(
        collection.environments?.[id],
        `deleteEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment delete`)
        const environments = touch(draftCollection).environments
        if (environments?.[id]) {
          delete environments[id]
        }
      })
    },

    ///
    setActiveEnvironment(collectionId: string, environmentId: string | undefined) {
      assert(existsInIndex(collectionId), `setActiveEnvironment called with an unknown collection.id: ${collectionId}`)
      const collection = getLoadedCollection(collectionId)
      if (environmentId !== undefined) {
        assert(
          collection.environments?.[environmentId],
          `setActiveEnvironment called with unknown environment.id:${environmentId} on collection ${collectionId}:${collection.name}`,
        )
      }

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment activation`)
        touch(draftCollection).activeEnvironmentId = environmentId
      })
    },

    ///
    addEnvironmentVariable(collectionId: string, environmentId: string, variable: Partial<EnvironmentVariable>) {
      assert(
        existsInIndex(collectionId),
        `addEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(collectionId)

      assert(
        collection.environments?.[environmentId],
        `addEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )

      const newVariable = zParse(zEnvironmentVariable, {
        name: "",
        value: "",
        secure: false,
        ...variable,
        id: generateUniqueId(8),
      })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable creation`)
        const environment = touch(draftCollection).environments?.[environmentId]
        assert(
          environment,
          `Environment ${environmentId} missing from collection ${collectionId} during variable create`,
        )
        environment.variables[newVariable.id] = newVariable
      })
    },

    ///
    updateEnvironmentVariable(
      collectionId: string,
      environmentId: string,
      variableId: string,
      update: Partial<EnvironmentVariable>,
    ) {
      assert(
        existsInIndex(collectionId),
        `updateEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(collectionId)

      assert(
        collection.environments?.[environmentId],
        `updateEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )
      assert(
        collection.environments[environmentId].variables?.[variableId],
        `updateEnvironmentVariable called with an unknown collection:${collectionId} environment:${environmentId} variable.id:${variableId}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment update`)
        const draft = touch(draftCollection)
        const environment = draft.environments?.[environmentId]
        assert(environment, `Environment ${environmentId} missing from collection ${collectionId} during update`)
        const variable = environment.variables?.[variableId]
        assert(
          variable,
          `Variable ${variableId} missing from collection ${collectionId} environment ${environmentId} during update`,
        )
        merge(variable, update)
      })
    },

    ///
    deleteEnvironmentVariable(collectionId: string, environmentId: string, variableId: string) {
      assert(
        existsInIndex(collectionId),
        `deleteEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(collectionId)

      assert(
        collection.environments?.[environmentId],
        `updateEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )

      assert(
        collection.environments[environmentId].variables?.[variableId],
        `updateEnvironmentVariable called with an unknown collection:${collectionId} environment:${environmentId} variable.id:${variableId}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment delete`)
        const draft = touch(draftCollection)
        const environment = draft.environments?.[environmentId]
        assert(environment, `Environment ${environmentId} missing from collection ${collectionId} during delete`)
        if (environment.variables) {
          delete environment.variables[variableId]
        }
      })
    },

    ///
    getRequest(collectionId: string, requestId: string) {
      assert(existsInIndex(collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)

      const collection = collectionsApi.getCollection(collectionId)

      return findRequestInCollection(collection, requestId).request
    },

    ///
    createRequest(collectionId: string, request: Some<RequestState, "name">) {
      assert(request.id === undefined, `createRequest expected request.id to be absent. Found ${request.id}`)
      assert(
        request.collectionId === undefined,
        `createRequest expected request.collectionId to be absent. Found ${request.collectionId}`,
      )

      const newRequest = zParse(zRequestState, {
        method: "GET",
        autoSave: false,
        url: "",
        pathParams: {},
        queryParams: {},
        headers: {},
        body: {
          type: "none",
        },
        authentication: {
          type: "none",
        },
        options: {},
        ...request,
        collectionId,
        id: request.id ?? generateUniqueId(),
        patch: {
          autoSave: true,
        },
        updated: 0,
      })

      getLoadedCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `createRequest called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const targetFolderId = newRequest.folderId ?? RootCollectionFolderId
        insertRequestIntoFolder(collection, targetFolderId, newRequest)

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === collectionId),
          `createRequest called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })

      // biome-ignore lint/style/noNonNullAssertion: Known safe
      return findRequestInCollection(get().collectionsState.cache[collectionId]!, newRequest.id).request
    },

    ///
    deleteRequest(collectionId: string, requestId: string) {
      assert(existsInIndex(collectionId), `createRequest called with an unknown collection.id: ${collectionId}`)

      getLoadedCollection(collectionId)

      set((app) => {
        // It should not be possible to delete a request before its collection is loaded
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `deleteRequest called with unloaded collection.id: ${collectionId}`,
          ),
        )

        removeRequestFromFolder(collection, requestId)
        delete collection.requests[requestId]
        validateRequestIndex(collection)
        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === collectionId),
          `deleteRequest called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })
    },

    reorderRequestsInFolder(collectionId: string, folderId: string, orderedIds: string[]) {
      collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(nonNull(app.collectionsState.cache[collectionId], `Collection missing during reorder`))
        reorderFolderRequests(collection, folderId, orderedIds)
      })
    },

    moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string, position?: number) {
      assert(existsInIndex(collectionId), `moveRequestToFolder called with unknown collectionId: ${collectionId}`)
      collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `moveRequestToFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        moveRequestWithinCollection(collection, requestId, targetFolderId, position)
        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `moveRequestToFolder called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })
    },

    createFolder(collectionId: string, parentId: string | null, name: string) {
      assert(name.trim().length > 0, "Folder name cannot be empty")
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support additional folders")
      collectionsApi.getCollection(collectionId)

      let created: CollectionFolderNode | null = null
      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `createFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const actualParentId = parentId ?? RootCollectionFolderId
        getFolderOrThrow(collection, actualParentId)

        const folderId = generateUniqueId()
        const folderNode = createFolderNode(folderId, name.trim(), actualParentId)
        collection.folders[folderId] = folderNode
        insertChildFolder(collection, actualParentId, folderId)
        created = folderNode
      })

      return nonNull(created, "Folder creation failed")
    },

    renameFolder(collectionId: string, folderId: string, name: string) {
      assert(name.trim().length > 0, "Folder name cannot be empty")
      assert(folderId !== RootCollectionFolderId, "Cannot rename root folder")
      collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `renameFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )
        if (collection.id === ScratchCollectionId) {
          throw new Error("Scratch collection does not support folder renames")
        }
        const folder = getFolderOrThrow(collection, folderId)
        folder.name = name.trim()
      })
    },

    deleteFolder(collectionId: string, folderId: string) {
      assert(folderId !== RootCollectionFolderId, "Cannot delete root folder")
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support folder deletion")
      collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `deleteFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        deleteFolderCascade(collection, folderId)

        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `deleteFolder called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })
    },

    moveFolder(collectionId: string, folderId: string, targetParentId: string | null, position?: number) {
      assert(folderId !== RootCollectionFolderId, "Cannot move root folder")
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support folder moves")
      collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `moveFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const destinationParentId = targetParentId ?? RootCollectionFolderId
        assert(folderId !== destinationParentId, "Cannot move folder into itself")
        moveFolderNode(collection, folderId, destinationParentId, position)
      })
    },

    reorderFolders(collectionId: string, parentId: string | null, orderedIds: string[]) {
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support folder reordering")
      collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `reorderFolders called with unloaded collection.id: ${collectionId}`,
          ),
        )

        reorderChildFolders(collection, parentId, orderedIds)
      })
    },

    duplicateRequest(collectionId: string, requestId: string) {
      const { id: _id, collectionId: _cid, ...sourceRequest } = collectionsApi.getRequest(collectionId, requestId)
      const newName = `Copy of ${sourceRequest.name}`
      collectionsApi.createRequest(collectionId, {
        ...sourceRequest,
        name: newName,
      })
    },

    ///
    updateRequest(collectionId: string, requestId: string, update: Partial<RequestState>) {
      assert(existsInIndex(collectionId), `updateRequest called with an unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === requestId,
        `updateRequest expected update.id to be absent or equal to requestId:${requestId}. Found ${update.id}`,
      )
      assert(
        update.collectionId === undefined || update.collectionId === collectionId,
        `updateRequest expected update.collectionId to be absent or equal to collectionId:${collectionId}. Found ${update.collectionId}`,
      )

      getLoadedCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `updateRequest called with unloaded collection.id: ${collectionId}`,
          ),
        )

        let { request } = findRequestInCollection(collection, requestId)

        if (update.folderId && update.folderId !== request.folderId) {
          const { request: removed } = removeRequestFromFolder(collection, requestId)
          insertRequestIntoFolder(collection, update.folderId, removed)
          request = removed
        }

        merge(request, {
          ...update,
          updated: request.updated + 1,
        })
      })
    },

    updateRequestPatchQueryParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestQueryParam> | null,
    ) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestPatchQueryParam called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)

        request.patch ??= {}
        const queryParams = ensureParamPatch(request, request.patch, "queryParams")
        const baseQueryParams = request.queryParams ?? {}
        if (update === null) {
          delete queryParams[id]
        } else {
          const next = {
            ...(queryParams[id] ?? baseQueryParams[id] ?? {}),
            ...update,
            id,
          }
          queryParams[id] = zRequestQueryParam.parse(next)
        }

        pruneParamPatchIfEqual(request, request.patch, "queryParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestPatchPathParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestPathParam> | null,
    ) {
      getLoadedCollection(collectionId)

      set((app) => {
        const request = app.collectionsState.cache[collectionId]?.requests[requestId]
        assert(request, `updateRequestPatchPathParam called with unrecognized request: ${collectionId}:${requestId}`)

        request.patch ??= {}
        const pathParams = ensureParamPatch(request, request.patch, "pathParams")
        const basePathParams = request.pathParams ?? {}
        if (update === null) {
          delete pathParams[id]
        } else {
          const next = {
            ...(pathParams[id] ?? basePathParams[id] ?? {}),
            ...update,
            id,
          }
          pathParams[id] = zRequestPathParam.parse(next)
        }

        pruneParamPatchIfEqual(request, request.patch, "pathParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestPatchHeader(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestHeader> | null,
    ) {
      getLoadedCollection(collectionId)

      set((app) => {
        const request = app.collectionsState.cache[collectionId]?.requests[requestId]
        assert(request, `updateRequestPatchHeader called with unrecognized request: ${collectionId}:${requestId}`)

        let patch: RequestState["patch"] = request.patch
        if (!patch) {
          patch = {}
          request.patch = patch
        }
        const headers = ensureParamPatch(request, patch, "headers")
        const baseHeaders = request.headers ?? {}
        if (update === null) {
          delete headers[id]
        } else {
          const next = {
            ...(headers[id] ?? baseHeaders[id] ?? {}),
            ...update,
            id,
          }
          headers[id] = zRequestHeader.parse(next)
        }

        pruneParamPatchIfEqual(request, patch, "headers")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestPatchCookieParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestCookieParam> | null,
    ) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestPatchCookieParam called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)

        request.patch ??= {}
        const cookieParams = ensureParamPatch(request, request.patch, "cookieParams")
        const baseCookieParams = request.cookieParams ?? {}
        if (update === null) {
          delete cookieParams[id]
        } else {
          const next = {
            ...(cookieParams[id] ?? baseCookieParams[id] ?? {}),
            ...update,
            id,
          }
          cookieParams[id] = zRequestCookieParam.parse(next)
        }

        pruneParamPatchIfEqual(request, request.patch, "cookieParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    setRequestBodyFormField(collectionId: string, requestId: string, id: string, update: Partial<FormField> | null) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `setRequestBodyFormField called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)

        const patch = ensureRequestPatch(request)
        const formDataUpdate: Record<string, Partial<FormField> | undefined> = {
          [id]: update === null ? undefined : update,
        }
        applyBodyPatchUpdates(request, patch, {
          formData: formDataUpdate as Record<string, Partial<FormField> | undefined>,
        })
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestBody(collectionId: string, requestId: string, update: Partial<RequestBodyData>) {
      assert(isNotEmpty(update), "updateRequestBody called with empty update")
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestBody called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        applyBodyPatchUpdates(request, patch, update)
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestAuthentication(collectionId: string, requestId: string, authentication: AuthConfig) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `setRequestAuthentication called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        patch.authentication = toMerged({}, authentication)
        pruneObjectPatchIfEqual(request, patch, "authentication")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestName(collectionId: string, requestId: string, name: string) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `setRequestName called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        if (request.name === name) {
          delete patch.name
        } else {
          patch.name = name
        }
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestMethod(collectionId: string, requestId: string, method: RequestState["method"]) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `setRequestMethod called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        if (request.method === method) {
          delete patch.method
        } else {
          patch.method = method
        }
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestUrl(collectionId: string, requestId: string, url: string) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `setRequestUrl called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        if (request.url === url) {
          delete patch.url
        } else {
          patch.url = url
        }
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    updateRequestOptions(collectionId: string, requestId: string, updates: Partial<ClientOptionsData>) {
      assert(isNotEmpty(updates), "updateRequestOptions called with empty updates")
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestOptions called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        const optionsPatch = ensureObjectPatch(request, patch, "options")
        Object.assign(optionsPatch, updates)
        pruneObjectPatchIfEqual(request, patch, "options")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestAutoSave(collectionId: string, requestId: string, value: boolean) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `setRequestAutoSave called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)
        const patch = ensureRequestPatch(request)
        if (request.autoSave === value) {
          delete patch.autoSave
        } else {
          patch.autoSave = value
        }
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    ///
    discardRequestPatch(collectionId: string, requestId: string) {
      getLoadedCollection(collectionId)

      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `discardRequestPatch called with unknown collectionId:${collectionId}`)

        const { request } = findRequestInCollection(collection, requestId)
        request.patch = {}
        request.updated += 1
      })
    },

    ///
    commitRequestPatch(collectionId: string, requestId: string) {
      getLoadedCollection(collectionId)

      const collection = get().collectionsState.cache[collectionId]
      assert(collection, `commitRequestPatch called with unknown collectionId:${collectionId}`)

      set((app) => {
        const cachedCollection = app.collectionsState.cache[collectionId]
        assert(cachedCollection, `commitRequestPatch called with unknown collectionId:${collectionId}`)
        const draftCollection = touch(cachedCollection)
        const { request } = findRequestInCollection(draftCollection, requestId)
        if (isNotEmpty(request?.patch)) {
          // Capture auth before merge to detect type changes
          const preAuth = current(request.authentication)
          mergeWith(request, request.patch, (_target, source, key) => {
            if (
              key === "headers" ||
              key === "queryParams" ||
              key === "pathParams" ||
              key === "formData" ||
              key === "cookieParams"
            ) {
              return source
            }
            return undefined
          })
          // If patch changed auth type, remove stale data from the previous type
          const patchAuthType = request.patch?.authentication?.type
          if (patchAuthType && preAuth?.type && patchAuthType !== preAuth.type) {
            const oldType = preAuth.type
            if (oldType !== "none" && oldType !== "inherit") {
              // biome-ignore lint/suspicious/noExplicitAny: OK
              delete (request.authentication as any)[oldType]
            }
          }
          request.patch = {}
          request.updated += 1
        }
      })

      const latestCollection = get().collectionsState.cache[collectionId]
      assert(latestCollection, `commitRequestPatch called with unknown collectionId:${collectionId}`)
      return findRequestInCollection(latestCollection, requestId).request
    },
  }

  return {
    collectionsState: {
      index: [],
      cache: {},
    },
    collectionsApi,
  }
}

/**
 * Moves a request from the scratch collection to a persistent one. WARNING: This method can only be called within
 * a set operation. It's used by the RequestsTabSlice to ensure a single atomic move WRT application state.
 *
 * @param slice CollectionsSlice to target
 * @param update RequestState to update. id and collectionId are required and should refer to a target collection
 */
export const saveScratchRequest = (
  slice: CollectionsSlice,
  update: Some<RequestState, "id" | "collectionId">,
): void => {
  const scratch = nonNull(slice.collectionsState.cache[ScratchCollectionId], `Unexpected error`)
  const target = nonNull(slice.collectionsState.cache[update.collectionId], `Unexpected error`)

  assert(!!scratch.requests[update.id], `saveScratchRequest called with unknown scratch request:${update.id}`)

  const { request: scratchRequest } = findRequestInCollection(scratch, update.id)
  const request = toMerged(scratchRequest, update)
  if (isNotEmpty(request.patch)) {
    merge(request, request.patch)
    request.patch = {}
  }

  removeRequestFromFolder(scratch, request.id)
  delete scratch.requests[request.id]
  nonNull(
    slice.collectionsState.index.find((m) => m.id === ScratchCollectionId),
    `saveScratchRequest called with non-indexed collection.id: ${ScratchCollectionId}`,
  ).count -= 1
  validateRequestIndex(scratch)

  insertRequestIntoFolder(target, request.folderId ?? RootCollectionFolderId, request)
  nonNull(
    slice.collectionsState.index.find((m) => m.id === update.collectionId),
    `saveScratchRequest called with non-indexed target collection.id: ${update.collectionId}`,
  ).count = countCollectionRequests(target)
  validateRequestIndex(target)
}

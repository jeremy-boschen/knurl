/**
 * Collections state management slice (modularized)
 *
 * Composes domain-specific operation modules:
 * - index-ops.ts: Collection index management
 * - collection-ops.ts: Collection CRUD operations
 * - request-ops.ts: Request CRUD and patch management
 * - folder-ops.ts: Folder hierarchy operations
 * - environment-ops.ts: Environment management
 * - core.ts: Shared infrastructure
 */

import type { StateCreator } from "zustand"

import type { StorageProvider } from "@/types/middleware/storage-manager"
import type { Application, CollectionsApi, CollectionsSlice, CollectionsState } from "@/types"
import {
  CollectionFileName,
  CollectionIndexFileName,
  CollectionIndexStorage,
  CollectionStorage,
  setupCollectionStorage,
} from "./core"
import { createIndexOps } from "./index-ops"
import { createCollectionOps } from "./collection-ops"
import { createRequestOps } from "./request-ops"
import { createFolderOps } from "./folder-ops"
import { createEnvironmentOps } from "./environment-ops"

export { sanitizeCollection } from "@/state/collections-lib"
export { ScratchCollectionId, isScratchCollection } from "./core"

export const createCollectionsSlice: StateCreator<
  Application,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CollectionsSlice
> = (set, get, storeApi) => {
  // Setup storage provider
  const storageProvider: StorageProvider<CollectionsState> = (() => {
    const timestamps: Record<string, string> = {}

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

        // Import sanitizeCollection here to avoid circular dependency
        const { sanitizeCollection } = await import("@/state/collections-lib")
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

  ///
  /// CollectionsApi Implementation (Composed from domain modules)
  ///
  const collectionsApi: CollectionsApi = {
    // Index operations
    ...createIndexOps(set, get),
    // Collection CRUD operations
    ...createCollectionOps(set, get),
    // Request CRUD and patch operations
    ...createRequestOps(set, get),
    // Folder hierarchy operations
    ...createFolderOps(set, get),
    // Environment management operations
    ...createEnvironmentOps(set, get),
  }

  return {
    collectionsState: {
      index: [],
      cache: {},
    },
    collectionsApi,
  }
}

export const saveScratchRequest = (
  app: Application,
  options: {
    id: string
    collectionId: string
    name: string
  },
) => {
  const { id: requestId, collectionId: targetCollectionId, name } = options

  // Find the current collection of this request by searching all loaded collections
  let sourceCollectionId: string | undefined

  // First check open tabs
  const openTab = Object.values(app.requestTabsState.openTabs).find((tab) => tab.requestId === requestId)
  if (openTab) {
    sourceCollectionId = openTab.collectionId
  } else {
    // Search loaded collections' requestIndex
    for (const collectionId in app.collectionsState.cache) {
      const collection = app.collectionsState.cache[collectionId]
      if (collection.requestIndex[requestId]) {
        sourceCollectionId = collectionId
        break
      }
    }
  }

  if (!sourceCollectionId) {
    return requestId
  }

  if (sourceCollectionId === targetCollectionId) {
    // Save in-place; no moving
    app.collectionsApi.commitRequestPatch(targetCollectionId, requestId)
    return requestId
  }

  // Move from source to target collection
  const request = app.collectionsApi.getRequest(sourceCollectionId, requestId)

  // Remove from source collection first
  app.collectionsApi.deleteRequest(sourceCollectionId, requestId)

  // Create duplicate in destination collection
  const newRequest = app.collectionsApi.createRequest(targetCollectionId, {
    ...request,
    collectionId: targetCollectionId,
    patch: {},
    name,
  })

  return newRequest.id
}

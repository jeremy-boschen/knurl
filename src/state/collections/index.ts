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
  tabId: string,
  collectionId: string,
  requestId: string,
  moveToCollection: string | undefined,
) => {
  if (!moveToCollection) {
    // Save in-place; no moving
    app.collectionsApi.commitRequestPatch(collectionId, requestId)
    return requestId
  }

  // Move from scratch to destination collection
  const request = app.collectionsApi.getRequest(collectionId, requestId)

  // Create duplicate in destination collection
  const newRequest = app.collectionsApi.createRequest(moveToCollection, {
    ...request,
    collectionId: moveToCollection,
    patch: {},
  })

  // Remove from scratch collection
  app.collectionsApi.deleteRequest(collectionId, requestId)

  // Update the tab to point to the new request
  app.requestTabsApi.updateTab(tabId, {
    collectionId: moveToCollection,
    requestId: newRequest.id,
  })

  return newRequest.id
}

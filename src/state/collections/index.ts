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

import {
  buildRequestIndexEntry,
  countCollectionRequests,
  findRequestInCollection,
  insertRequestIntoFolder,
} from "@/state/collections-lib"
import type { Application, CollectionsApi, CollectionsSlice, CollectionsState, RequestState } from "@/types"
import type { StorageProvider } from "@/types/middleware/storage-manager"
import { createCollectionOps } from "./collection-ops"
import { CollectionFileName, CollectionIndexFileName, CollectionIndexStorage, CollectionStorage } from "./core"
import { createEnvironmentOps } from "./environment-ops"
import { createFolderOps } from "./folder-ops"
import { createIndexOps } from "./index-ops"
import { createRequestOps } from "./request-ops"

export { sanitizeCollection } from "@/state/collections-lib"
export { isScratchCollection, ScratchCollectionId } from "./core"

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
  const sourceCollection = app.collectionsState.cache[sourceCollectionId]
  const targetCollection = app.collectionsState.cache[targetCollectionId]

  if (!sourceCollection || !targetCollection) {
    return requestId
  }

  const request = sourceCollection.requests[requestId]
  if (!request) {
    return requestId
  }

  // Remove from source collection directly (in-state)
  const { folder: sourceFolder } = findRequestInCollection(sourceCollection, requestId)
  if (sourceFolder) {
    sourceFolder.requestIds = sourceFolder.requestIds.filter((id) => id !== requestId)
  }
  delete sourceCollection.requests[requestId]
  delete sourceCollection.requestIndex[requestId]

  // Update source collection index count
  const sourceIndex = app.collectionsState.index.find((e) => e.id === sourceCollectionId)
  if (sourceIndex) {
    sourceIndex.count = countCollectionRequests(sourceCollection)
  }

  // Create duplicate in destination collection (keeping the same ID)
  const newRequest = {
    ...request,
    id: requestId,
    collectionId: targetCollectionId,
    patch: {},
    name,
  } as RequestState

  targetCollection.requests[newRequest.id] = newRequest
  insertRequestIntoFolder(targetCollection, newRequest.folderId, newRequest)
  buildRequestIndexEntry(targetCollection, newRequest.id)

  // Update target collection index count
  const targetIndex = app.collectionsState.index.find((e) => e.id === targetCollectionId)
  if (targetIndex) {
    targetIndex.count = countCollectionRequests(targetCollection)
  }

  return newRequest.id
}

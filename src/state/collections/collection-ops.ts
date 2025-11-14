/**
 * Collection CRUD operations
 *
 * Handles all collection-level operations:
 * - Loading, creating, updating, deleting collections
 * - Importing and exporting collections
 * - Merging collections
 */

import { merge } from "es-toolkit"
import type { StateCreator } from "zustand"

import { assert, generateUniqueId, nonNull } from "@/lib/utils"
import { invalidateCollectionPromise } from "@/state/application"
import type { MergeSummary } from "@/state/collections-lib"
import {
  applyMergePlan,
  countCollectionRequests,
  createFolderNode,
  normalizeImportedCollection,
  prepareMergePlan,
  sanitizeCollection,
} from "@/state/collections-lib"
import type {
  Application,
  Collection,
  CollectionCache,
  ExportedCollection,
} from "@/types"
import { RootCollectionFolderId } from "@/types"
import {
  CollectionFileName,
  CollectionStorage,
  ScratchCollectionId,
  touch,
  getLoadedCollection,
  internalAddCollection,
  loadScratchCollection,
  existsInIndex,
  assertCollectionLoaded,
  removeCollectionFromLoadTracking,
  markCollectionLoaded,
} from "./core"

/**
 * Creates collection CRUD operations handlers
 */
export function createCollectionOps(set: ReturnType<StateCreator<Application>>, get: () => Application) {
  return {
    saveCollection(collection: CollectionCache | string) {
      const cached = typeof collection === "string" ? getLoadedCollection(get, collection) : collection

      assert(existsInIndex(get, cached.id), `saveCollection called with an unknown collection.id: ${cached.id}`)

      void CollectionStorage.save(CollectionFileName(cached.id), sanitizeCollection(cached)).catch((error) => {
        console.error(`Failed to save collection ${cached.id}`, error)
      })
    },

    async loadCollection(id: string) {
      assert(existsInIndex(get, id), `loadCollection called with an unknown collection.id: ${id}`)

      const cached = get().collectionsState.cache[id]
      if (cached) {
        markCollectionLoaded(id)
        return cached
      }

      if (ScratchCollectionId === id) {
        return loadScratchCollection(set, get)
      }

      const collection = nonNull(
        await CollectionStorage.load(CollectionFileName(id)),
        `Collection file ${CollectionFileName(id)} could not be loaded`,
      )

      return internalAddCollection(collection, set)
    },

    getCollection(id: string) {
      assert(existsInIndex(get, id), `getCollection called with an unknown collection.id: ${id}`)
      return getLoadedCollection(get, id)
    },

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

      return internalAddCollection(newCollection, set)
    },

    exportCollection: (collectionId: string): ExportedCollection => {
      const collectionsApi = get().collectionsApi
      const collection = collectionsApi.getCollection(collectionId)
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
      assert(existsInIndex(get, collectionId), `mergeCollection called with an unknown collection.id: ${collectionId}`)

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

    updateCollection(collectionId: string, update: Partial<Collection>) {
      assert(
        update.id === undefined || update.id === collectionId,
        `updateCollection called with mismatched id:${collectionId} !== update.id:${update.id}`,
      )

      assertCollectionLoaded(collectionId)
      getLoadedCollection(get, collectionId)

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

      return getLoadedCollection(get, collectionId)
    },

    clearScratchCollection() {
      const collectionsApi = get().collectionsApi
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

    removeCollection(id: string) {
      assert(existsInIndex(get, id), `updateCollection called with an unknown collection.id: ${id}`)

      if (ScratchCollectionId === id) {
        throw new Error("Cannot remove the unsaved collection")
      }

      set((app) => {
        delete app.collectionsState.cache[id]
        removeCollectionFromLoadTracking(id)
        app.collectionsState.index = app.collectionsState.index.filter((e) => e.id !== id)
      })

      invalidateCollectionPromise(id)

      void CollectionStorage.delete(CollectionFileName(id)).catch((error) => {
        console.error(`Failed to delete collection ${id}`, error)
      })
    },
  }
}

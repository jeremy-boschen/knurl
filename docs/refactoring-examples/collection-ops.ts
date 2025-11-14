/**
 * Collection-level operations module.
 * Handles CRUD operations for collections (not requests/folders/environments).
 *
 * This module demonstrates:
 * - Importing shared utilities from core.ts
 * - Operating on the same cache object (bundled on disk, modular in code)
 * - Returning a typed API subset
 * - Clean separation of concerns
 */

import { assert, nonNull } from "@/lib/utils"
import { generateUniqueId } from "@/lib/id"
import {
  normalizeImportedCollection,
  prepareMergePlan,
  applyMergePlan,
  countCollectionRequests,
  sanitizeCollection,
  createFolderNode,
} from "@/state/collections-lib"
import { merge } from "@/lib/merge"
import {
  type Application,
  type Collection,
  type CollectionCache,
  type CollectionsIndexEntry,
  type ExportedCollection,
  type MergeSummary,
  RootCollectionFolderId,
} from "@/types"

// Import shared utilities from core module
import {
  ScratchCollectionId,
  markCollectionLoaded,
  getLoadedCollection,
  loadCollectionFromDisk,
  loadScratchCollection,
  touchCollection,
  existsInIndex,
  internalAddCollection,
} from "./collections-core"

// Storage functions (imported from core or created here)
import {
  createStorage,
} from "@/state/middleware/storage"
import { zCollection, zCollectionsIndex } from "@/types"

const CollectionStorage = createStorage<Collection>(zCollection)
const CollectionIndexStorage = createStorage<CollectionsIndexEntry[]>(zCollectionsIndex)
const CollectionFileName = (id: string) => `collections/${id}.json`
const CollectionIndexFileName = () => "collections/index.json"

// ============================================================================
// Collection Operations API
// ============================================================================

/**
 * Creates collection-level operation functions.
 * These handle collection CRUD but NOT request/folder/environment operations.
 */
export function createCollectionOps(
  get: () => Application,
  set: (recipe: (draft: Application) => void) => void,
) {
  // Helper to touch a collection (updates timestamp)
  const touch = (collection: Collection): Collection => {
    return touchCollection(collection)
  }

  // Collection promise tracking for invalidation
  const collectionPromises = new Map<string, Promise<CollectionCache>>()

  const invalidateCollectionPromise = (id: string) => {
    collectionPromises.delete(id)
  }

  return {
    /**
     * Get the full collections index (metadata for all collections)
     */
    getCollectionsIndex(): CollectionsIndexEntry[] {
      return get().collectionsState.index
    },

    /**
     * Reorder collections in the sidebar
     */
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

      void CollectionIndexStorage.save(
        CollectionIndexFileName(),
        get().collectionsState.index
      ).catch((error) => {
        console.error("Failed to persist collections index", error)
      })
    },

    /**
     * Save a collection to disk.
     * Collection remains bundled in the JSON file (all data together).
     */
    saveCollection(collection: CollectionCache | string) {
      const cached = typeof collection === "string"
        ? getLoadedCollection(get, collection)
        : collection

      assert(
        existsInIndex(get, cached.id),
        `saveCollection called with an unknown collection.id: ${cached.id}`
      )

      // Redact runtime-only secrets before persisting
      void CollectionStorage.save(
        CollectionFileName(cached.id),
        sanitizeCollection(cached)
      ).catch((error) => {
        console.error(`Failed to save collection ${cached.id}`, error)
      })
    },

    /**
     * Load a collection from disk into memory.
     * Collection file is bundled (requests + folders + environments together).
     */
    async loadCollection(id: string): Promise<CollectionCache> {
      assert(
        existsInIndex(get, id),
        `loadCollection called with an unknown collection.id: ${id}`
      )

      const cached = get().collectionsState.cache[id]
      if (cached) {
        markCollectionLoaded(id)
        return cached
      }

      if (ScratchCollectionId === id) {
        // Special logic for loading the scratch collection
        return loadScratchCollection(set, (collection) =>
          internalAddCollection(collection, set, get)
        )
      }

      const collection = nonNull(
        await loadCollectionFromDisk(id),
        `Collection file ${CollectionFileName(id)} could not be loaded`
      )

      return internalAddCollection(collection, set, get)
    },

    /**
     * Get a loaded collection from cache. Throws if not loaded.
     */
    getCollection(id: string): CollectionCache {
      assert(
        existsInIndex(get, id),
        `getCollection called with an unknown collection.id: ${id}`
      )

      return getLoadedCollection(get, id)
    },

    /**
     * Create a new collection.
     */
    addCollection(name: string, description?: string): CollectionCache {
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
          [RootCollectionFolderId]: createFolderNode(
            RootCollectionFolderId,
            "Root",
            null
          ),
        },
        authentication: {
          type: "none",
        },
      }

      return internalAddCollection(newCollection, set, get)
    },

    /**
     * Export a collection to JSON.
     * The exported file is bundled (all data together).
     */
    exportCollection(collectionId: string): ExportedCollection {
      const collection = getLoadedCollection(get, collectionId)

      // Redact runtime-only secrets before exporting
      const sanitized = sanitizeCollection(collection)
      return {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: sanitized,
      }
    },

    /**
     * Import a collection from exported JSON.
     * The imported file is bundled (all data together).
     */
    importCollection(
      exported: ExportedCollection,
      overrideName?: string
    ): CollectionCache {
      const normalized = normalizeImportedCollection(exported, overrideName)
      return internalAddCollection(normalized, set, get)
    },

    /**
     * Merge an imported collection into an existing one.
     */
    mergeCollection(
      collectionId: string,
      exported: ExportedCollection
    ): MergeSummary {
      assert(
        existsInIndex(get, collectionId),
        `mergeCollection called with an unknown collection.id: ${collectionId}`
      )

      const currentCollection = get().collectionsState.cache[collectionId]
      assert(
        currentCollection,
        `mergeCollection called with unloaded collection.id: ${collectionId}`
      )

      const plan = prepareMergePlan(currentCollection, exported)
      let mergeSummary: MergeSummary | null = null

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `mergeCollection called with unloaded collection.id: ${collectionId}`
          )
        )

        mergeSummary = applyMergePlan(collection, plan)
        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `mergeCollection called with non-indexed collection.id: ${collectionId}`
        )
        index.count = countCollectionRequests(collection)
        index.updated = collection.updated
      })

      return mergeSummary ?? plan.summary
    },

    /**
     * Update collection metadata.
     */
    updateCollection(
      collectionId: string,
      update: Partial<Collection>
    ): CollectionCache {
      // Ensure that update cannot change collectionId
      assert(
        update.id === undefined || update.id === collectionId,
        `updateCollection called with mismatched id:${collectionId} !== update.id:${update.id}`
      )

      getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(
          draftCollection,
          `Collection ${collectionId} missing from cache during collection update`
        )
        const draft = touch(draftCollection)
        merge(draft, update)

        if (update.name) {
          const index = nonNull(
            app.collectionsState.index.find((e) => e.id === collectionId),
            `updateCollection called with non-indexed collection.id: ${collectionId}`
          )
          index.name = update.name
          index.updated = new Date().toISOString()
        }
      })

      return getLoadedCollection(get, collectionId)
    },

    /**
     * Clear all requests from the scratch collection.
     */
    clearScratchCollection() {
      const scratch = getLoadedCollection(get, ScratchCollectionId)
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
            "clearScratchCollection called but scratch collection not loaded"
          )
        )
        scratchCollection.requests = {}
        for (const folder of Object.values(scratchCollection.folders)) {
          folder.requestIds = []
        }
        scratchCollection.requestIndex = {}

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === ScratchCollectionId),
          "clearScratchCollection called with non-indexed scratch collection"
        )
        index.count = 0
      })

      invalidateCollectionPromise(ScratchCollectionId)
    },

    /**
     * Remove a collection from the system.
     */
    removeCollection(id: string) {
      assert(
        existsInIndex(get, id),
        `removeCollection called with an unknown collection.id: ${id}`
      )

      if (ScratchCollectionId === id) {
        throw new Error("Cannot remove the scratch collection")
      }

      set((app) => {
        // An unloaded collection can be removed, so we can't assume it exists in the cache
        delete app.collectionsState.cache[id]
        app.collectionsState.index = app.collectionsState.index.filter(
          (e) => e.id !== id
        )
      })

      invalidateCollectionPromise(id)

      // Manually delete the collection file
      void CollectionStorage.delete(CollectionFileName(id)).catch((error) => {
        console.error(`Failed to delete collection ${id}`, error)
      })
    },
  }
}

// ============================================================================
// Type for the collection operations API
// ============================================================================

export type CollectionOpsApi = ReturnType<typeof createCollectionOps>

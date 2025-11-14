/**
 * Core infrastructure for collections state management.
 * Shared by all collection operation modules.
 *
 * This module handles:
 * - Collection cache and loading state
 * - Persistence (save/load from disk)
 * - Storage provider setup
 * - Common utilities
 */

import { assert, nonNull } from "@/lib/utils"
import { isAppError } from "@/bindings/knurl"
import {
  createStorage,
  type StorageProvider,
} from "@/state/middleware/storage"
import {
  normalizeCollection,
  createFolderNode,
  countCollectionRequests,
  sanitizeCollection,
} from "@/state/collections-lib"
import { zParse } from "@/state/utils"
import {
  type Application,
  type Collection,
  type CollectionCache,
  type CollectionsIndexEntry,
  RootCollectionFolderId,
  zCollection,
  zCollectionsIndex,
} from "@/types"

// ============================================================================
// Constants
// ============================================================================

export const ScratchCollectionId = "scratch"

// Track which collections are loaded in memory
const loadedCollections = new Set<string>()

// Track last save timestamp per collection (for throttling)
const saveTimestamps: Record<string, string> = {}

// ============================================================================
// Storage Setup
// ============================================================================

const CollectionIndexStorage = createStorage<CollectionsIndexEntry[]>(zCollectionsIndex)
const CollectionStorage = createStorage<Collection>(zCollection)

const CollectionIndexFileName = () => "collections/index.json"
const CollectionFileName = (id: string) => `collections/${id}.json`

/**
 * Creates and registers the storage provider for collections.
 * Handles saving the index and all modified collections.
 */
export function createCollectionsStorageProvider(
  get: () => Application,
  set: (recipe: (draft: Application) => void) => void,
  storeApi: any,
): StorageProvider {
  const storageProvider: StorageProvider = {
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
      promises.push(
        CollectionIndexStorage.save(CollectionIndexFileName(), state.index)
      )

      // Save each modified collection
      for (const collection of Object.values(state.cache)) {
        if (force || saveTimestamps[collection.id] !== collection.updated) {
          promises.push(
            CollectionStorage.save(
              CollectionFileName(collection.id),
              sanitizeCollection(collection)
            )
          )
          saveTimestamps[collection.id] = collection.updated
        }
      }

      await Promise.all(promises)
    },
  }

  storeApi.registerStorageProvider(storageProvider)
  return storageProvider
}

// ============================================================================
// Collection Loading & Cache Management
// ============================================================================

/**
 * Marks a collection as loaded in memory.
 */
export function markCollectionLoaded(collectionId: string): void {
  loadedCollections.add(collectionId)
}

/**
 * Checks if a collection is loaded in memory.
 */
export function isCollectionLoaded(collectionId: string): boolean {
  return loadedCollections.has(collectionId)
}

/**
 * Asserts that a collection is loaded, throws if not.
 */
export function assertCollectionLoaded(collectionId: string): void {
  assert(
    loadedCollections.has(collectionId),
    `Collection ${collectionId} must be loaded before access`
  )
}

/**
 * Gets a loaded collection from cache. Throws if not loaded.
 */
export function getLoadedCollection(
  get: () => Application,
  collectionId: string
): CollectionCache {
  assertCollectionLoaded(collectionId)
  const collection = get().collectionsState.cache[collectionId]
  assert(
    collection,
    `Collection ${collectionId} must be in cache after loading`
  )
  return collection
}

/**
 * Loads a collection from disk.
 */
export async function loadCollectionFromDisk(
  collectionId: string
): Promise<Collection | null> {
  try {
    return await CollectionStorage.load(CollectionFileName(collectionId))
  } catch (e) {
    if (!isAppError(e, ["FileNotFound", "IoError"])) {
      throw e
    }
    return null
  }
}

/**
 * Loads the special scratch collection.
 * Creates it if it doesn't exist.
 */
export async function loadScratchCollection(
  set: (recipe: (draft: Application) => void) => void,
  internalAddCollection: (collection: Collection) => CollectionCache
): Promise<CollectionCache> {
  let collection = await loadCollectionFromDisk(ScratchCollectionId)

  if (collection) {
    return internalAddCollection(collection)
  }

  // First time - create scratch collection
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
      [RootCollectionFolderId]: createFolderNode(
        RootCollectionFolderId,
        "Scratch",
        null
      ),
    },
    authentication: {
      type: "none",
    },
  }

  return internalAddCollection(collection)
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Updates a collection's timestamp.
 */
export function touchCollection(collection: Collection): Collection {
  collection.updated = new Date().toISOString()
  return collection
}

/**
 * Checks if a collection exists in the index.
 */
export function existsInIndex(
  get: () => Application,
  collectionId: string
): boolean {
  return (
    collectionId === ScratchCollectionId ||
    get().collectionsState.index.some((m) => m.id === collectionId)
  )
}

/**
 * Adds a collection to the cache and index.
 * This is the single internal function for adding collections.
 */
export function internalAddCollection(
  collection: Collection | CollectionCache,
  set: (recipe: (draft: Application) => void) => void,
  get: () => Application
): CollectionCache {
  const normalized =
    (collection as CollectionCache).requestIndex
      ? (collection as CollectionCache)
      : normalizeCollection(collection as Collection)

  set((app) => {
    const now = new Date().toISOString()

    // Add to cache
    app.collectionsState.cache[normalized.id] = normalized

    // Add to index (if not already present)
    if (!app.collectionsState.index.some((m) => m.id === normalized.id)) {
      // Compute next order (scratch stays at 0)
      const nonScratch = app.collectionsState.index.filter(
        (e) => e.id !== ScratchCollectionId
      )
      const maxOrder = Math.max(0, ...nonScratch.map((e) => e.order ?? 0))
      const nextOrder =
        normalized.id === ScratchCollectionId ? 0 : maxOrder + 1

      app.collectionsState.index.push({
        id: normalized.id,
        order: nextOrder,
        name: normalized.name,
        count: countCollectionRequests(normalized),
        created: now,
        updated: now,
      })

      // Keep array sorted by order (scratch first)
      app.collectionsState.index.sort((a, b) => {
        if (a.id === ScratchCollectionId) return -1
        if (b.id === ScratchCollectionId) return 1
        return (a.order ?? 0) - (b.order ?? 0)
      })
    }
  })

  markCollectionLoaded(normalized.id)
  return normalized
}

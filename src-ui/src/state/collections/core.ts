/**
 * Core infrastructure for collections state management
 *
 * Provides shared utilities used by all collection operation modules:
 * - Collection cache management
 * - Loading/persistence functions
 * - Storage provider setup
 * - Shared helpers
 */

import type { StateCreator } from "zustand"

import { isAppError } from "@/bindings/knurl"
import { assert, generateUniqueId } from "@/lib/utils"
import {
  buildEnvironmentState,
  countCollectionRequests,
  createFolderNode,
  normalizeCollection,
  sanitizeCollection,
} from "@/state/collections-lib"
import { createStorage, type MigrateContext } from "@/state/middleware/storage"
import type {
  Application,
  Collection,
  CollectionCache,
  CollectionsIndex,
  CollectionsIndexEntry,
  CollectionsState,
  Environment,
} from "@/types"
import { zCollection, zCollectionsIndex } from "@/types"
import { RootCollectionFolderId } from "@/types/collections/collection"
import type { StorageProvider } from "@/types/middleware/storage-manager"

// Constants
export const ScratchCollectionId = "scratch"
export const isScratchCollection = (collection: Collection | string) =>
  (typeof collection === "string" ? collection : collection.id) === ScratchCollectionId

// Collection load tracking (for diagnostics)
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

export const clearLoadedCollectionsForTesting = () => {
  loadedCollections.clear()
  collectionLoadTraces?.clear()
}

export const removeCollectionFromLoadTracking = (collectionId: string) => {
  loadedCollections.delete(collectionId)
}

export const markCollectionLoaded = (collectionId: string) => {
  loadedCollections.add(collectionId)
  captureCollectionLoadTrace(collectionId)
}

export const assertCollectionLoaded = (collectionId: string) => {
  if (!loadedCollections.has(collectionId)) {
    logMissingCollectionLoad(collectionId)
  }
  assert(loadedCollections.has(collectionId), `Collection ${collectionId} must be loaded via loadCollection before use`)
}

// Storage configuration
export const CollectionIndexStorage = createStorage<CollectionsIndex["index"]>({
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

export const CollectionStorage = createStorage<Collection>({
  version: 5,
  schema: zCollection,
  migrate: async (context: MigrateContext) => {
    const content = context.content as Partial<Collection>

    // v2: sort requests alphabetically within each folder
    if (context.version < 2) {
      const collection = content as Collection
      if (collection.folders) {
        for (const folder of Object.values(collection.folders)) {
          if (folder.requestIds && folder.requestIds.length > 0) {
            // Sort request IDs by their corresponding request names (case-insensitive)
            folder.requestIds.sort((a, b) => {
              const requestA = collection.requests?.[a]
              const requestB = collection.requests?.[b]
              if (!requestA || !requestB) {
                return 0
              }
              return requestA.name.localeCompare(requestB.name, undefined, { sensitivity: "base" })
            })
            // Update order field on requests to match sorted position
            folder.requestIds.forEach((requestId, index) => {
              if (collection.requests?.[requestId]) {
                collection.requests[requestId].order = index + 1
              }
            })
          }
        }
      }
    }

    // v3: re-sort requests with case-insensitive comparison (fix for requests sorted case-sensitively)
    if (context.version < 3) {
      const collection = content as Collection
      if (collection.folders) {
        for (const folder of Object.values(collection.folders)) {
          if (folder.requestIds && folder.requestIds.length > 0) {
            // Re-sort request IDs by their corresponding request names (case-insensitive)
            folder.requestIds.sort((a, b) => {
              const requestA = collection.requests?.[a]
              const requestB = collection.requests?.[b]
              if (!requestA || !requestB) {
                return 0
              }
              return requestA.name.localeCompare(requestB.name, undefined, { sensitivity: "base" })
            })
            // Update order field on requests to match sorted position
            folder.requestIds.forEach((requestId, index) => {
              if (collection.requests?.[requestId]) {
                collection.requests[requestId].order = index + 1
              }
            })
          }
        }
      }
    }

    // v4: ensure all collections have requests properly sorted (handles collections that bypassed v3 migration)
    if (context.version < 4) {
      const collection = content as Collection
      if (collection.folders) {
        for (const folder of Object.values(collection.folders)) {
          if (folder.requestIds && folder.requestIds.length > 0) {
            // Re-sort request IDs by their corresponding request names (case-insensitive)
            folder.requestIds.sort((a, b) => {
              const requestA = collection.requests?.[a]
              const requestB = collection.requests?.[b]
              if (!requestA || !requestB) {
                return 0
              }
              return requestA.name.localeCompare(requestB.name, undefined, { sensitivity: "base" })
            })
            // Update order field on requests to match sorted position
            folder.requestIds.forEach((requestId, index) => {
              if (collection.requests?.[requestId]) {
                collection.requests[requestId].order = index + 1
              }
            })
          }
        }
      }
    }

    // v5: sort all requests alphabetically by name (now that normalizeCollection doesn't sort, we need to sort here)
    if (context.version < 5) {
      const collection = content as Collection
      if (collection.folders) {
        for (const folder of Object.values(collection.folders)) {
          if (folder.requestIds && folder.requestIds.length > 0) {
            // Sort request IDs by their corresponding request names (case-insensitive)
            folder.requestIds.sort((a, b) => {
              const requestA = collection.requests?.[a]
              const requestB = collection.requests?.[b]
              if (!requestA || !requestB) {
                return 0
              }
              return requestA.name.localeCompare(requestB.name, undefined, { sensitivity: "base" })
            })
            // Update order field on requests to match sorted position
            folder.requestIds.forEach((requestId, index) => {
              if (collection.requests?.[requestId]) {
                collection.requests[requestId].order = index + 1
              }
            })
          }
        }
      }
    }

    return content as Collection
  },
})

export const CollectionIndexFileName = () => "collections/.index.json"
export const CollectionFileName = (id: string) => `collections/${id}.json`

// Shared infrastructure functions
export function setupCollectionStorage(
  set: ReturnType<StateCreator<Application>>,
  get: () => Application,
  storeApi: Record<string, unknown>,
): StorageProvider<CollectionsState> {
  const timestamps: Record<string, string> = {}

  const provider: StorageProvider<CollectionsState> = {
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

  storeApi.registerStorageProvider(provider)
  return provider
}

export function touch(collection: Collection): Collection {
  collection.updated = new Date().toISOString()
  return collection
}

export function getLoadedCollection(get: () => Application, collectionId: string): CollectionCache {
  assertCollectionLoaded(collectionId)
  const collection = get().collectionsState.cache[collectionId]
  assert(collection, `Collection ${collectionId} must be loaded before invoking collectionsApi mutator`)
  return collection
}

export function internalAddCollection(
  collection: Collection | CollectionCache,
  set: ReturnType<StateCreator<Application>>,
): CollectionCache {
  const normalized = (collection as CollectionCache).requestIndex
    ? (collection as CollectionCache)
    : normalizeCollection(collection as Collection)

  set((app) => {
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

export async function loadScratchCollection(
  set: ReturnType<StateCreator<Application>>,
  get: () => Application,
): Promise<CollectionCache> {
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

  return internalAddCollection(collection, set, get)
}

export function existsInIndex(get: () => Application, id: string): boolean {
  return id === ScratchCollectionId || get().collectionsState.index.some((m) => m.id === id)
}

export function createEnvironment(environment: Partial<Environment>): Environment {
  return buildEnvironmentState({
    ...environment,
    id: generateUniqueId(),
  })
}

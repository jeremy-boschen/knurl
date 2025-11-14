/**
 * Request operations module.
 * Handles CRUD operations for requests within collections.
 *
 * This module demonstrates:
 * - Importing shared utilities from core.ts
 * - Operating on the same bundled cache object
 * - Clean separation of request-specific concerns
 * - All operations mutate the collection in cache (bundled on disk)
 */

import { assert, nonNull } from "@/lib/utils"
import { generateUniqueId } from "@/lib/id"
import {
  countCollectionRequests,
  insertRequestIntoFolder,
  removeRequestFromFolder,
  findRequestInCollection,
  moveRequestWithinCollection,
  reorderFolderRequests,
  validateRequestIndex,
} from "@/state/collections-lib"
import { zParse } from "@/state/utils"
import {
  type Application,
  type RequestState,
  type Some,
  RootCollectionFolderId,
  zRequestState,
} from "@/types"

// Import shared utilities from core module
import {
  getLoadedCollection,
  touchCollection,
  existsInIndex,
} from "./collections-core"

// ============================================================================
// Request Operations API
// ============================================================================

/**
 * Creates request operation functions.
 * Handles request CRUD within collections.
 *
 * Key insight: All request operations mutate the collection object in cache.
 * When saved to disk, the entire collection (with all requests) is written
 * as a bundled JSON file. This modular code structure doesn't change that.
 */
export function createRequestOps(
  get: () => Application,
  set: (recipe: (draft: Application) => void) => void,
) {
  // Helper to touch a collection (updates timestamp)
  const touch = (collection: any) => touchCollection(collection)

  return {
    /**
     * Get a request from a collection.
     */
    getRequest(collectionId: string, requestId: string): RequestState {
      assert(
        existsInIndex(get, collectionId),
        `getRequest called with an unknown collection.id: ${collectionId}`
      )

      const collection = getLoadedCollection(get, collectionId)
      return findRequestInCollection(collection, requestId).request
    },

    /**
     * Create a new request in a collection.
     * The request is added to the in-memory collection cache.
     * When saved, the entire collection (bundled) is written to disk.
     */
    createRequest(
      collectionId: string,
      request: Some<RequestState, "name">
    ): RequestState {
      assert(
        request.id === undefined,
        `createRequest expected request.id to be absent. Found ${request.id}`
      )
      assert(
        request.collectionId === undefined,
        `createRequest expected request.collectionId to be absent. Found ${request.collectionId}`
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

      getLoadedCollection(get, collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `createRequest called with unloaded collection.id: ${collectionId}`
          )
        )

        const targetFolderId = newRequest.folderId ?? RootCollectionFolderId
        insertRequestIntoFolder(collection, targetFolderId, newRequest)

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === collectionId),
          `createRequest called with non-indexed collection.id: ${collectionId}`
        )
        index.count = countCollectionRequests(collection)
      })

      // Return the newly created request
      return findRequestInCollection(
        get().collectionsState.cache[collectionId]!,
        newRequest.id
      ).request
    },

    /**
     * Delete a request from a collection.
     * Removes from the in-memory collection cache.
     * When saved, the entire collection (bundled, without this request) is written.
     */
    deleteRequest(collectionId: string, requestId: string): void {
      assert(
        existsInIndex(get, collectionId),
        `deleteRequest called with an unknown collection.id: ${collectionId}`
      )

      getLoadedCollection(get, collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `deleteRequest called with unloaded collection.id: ${collectionId}`
          )
        )

        removeRequestFromFolder(collection, requestId)
        delete collection.requests[requestId]
        validateRequestIndex(collection)

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === collectionId),
          `deleteRequest called with non-indexed collection.id: ${collectionId}`
        )
        index.count = countCollectionRequests(collection)
      })
    },

    /**
     * Reorder requests within a folder.
     * Updates the in-memory collection cache.
     */
    reorderRequestsInFolder(
      collectionId: string,
      folderId: string,
      orderedIds: string[]
    ): void {
      getLoadedCollection(get, collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `Collection missing during reorder`
          )
        )
        reorderFolderRequests(collection, folderId, orderedIds)
      })
    },

    /**
     * Move a request to a different folder.
     * Updates the in-memory collection cache.
     * When saved, the collection with updated folder structure is written.
     */
    moveRequestToFolder(
      collectionId: string,
      requestId: string,
      targetFolderId: string,
      position?: number
    ): void {
      assert(
        existsInIndex(get, collectionId),
        `moveRequestToFolder called with unknown collectionId: ${collectionId}`
      )
      getLoadedCollection(get, collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `moveRequestToFolder called with unloaded collection.id: ${collectionId}`
          )
        )

        moveRequestWithinCollection(
          collection,
          requestId,
          targetFolderId,
          position
        )

        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `moveRequestToFolder called with non-indexed collection.id: ${collectionId}`
        )
        index.count = countCollectionRequests(collection)
      })
    },

    /**
     * Update a request within a collection.
     * This would include methods like:
     * - updateRequest (general updates)
     * - updateRequestBody
     * - updateRequestHeaders
     * - setRequestAuthentication
     * - etc.
     *
     * All operate on the same in-memory collection cache.
     * When saved, the entire collection is written as a bundled JSON file.
     */
    // Additional methods would follow the same pattern...
  }
}

// ============================================================================
// Type for the request operations API
// ============================================================================

export type RequestOpsApi = ReturnType<typeof createRequestOps>

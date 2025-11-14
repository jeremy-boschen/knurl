import type { Some } from "@/types/common"
import type { EnvironmentsApi } from "@/types/environments"
import type { AuthConfig, ClientOptionsData, FormField, RequestBodyData, RequestCookieParam, RequestHeader, RequestPathParam, RequestQueryParam, RequestState } from "@/types/request"
import type { Collection, CollectionCache, CollectionFolderNode, CollectionsIndexEntry, ExportedCollection } from "./collection"

export interface CollectionsIndexApi {
  /**
   * Get all collections index
   * @returns A collection array
   */
  getCollectionsIndex(): CollectionsIndexEntry[]
}

/**
 * Interface for collection management
 */
export interface CollectionsApi extends CollectionsIndexApi, EnvironmentsApi {
  /**
   * Forces saving a collection and the index to disk
   */
  saveCollection(collection: CollectionCache | string): void

  /**
   * Loads a collection into the cache if necessary.
   */
  loadCollection(id: string): Promise<CollectionCache>

  /**
   * Retrieves a specific collection by ID. Requires the collection to be loaded.
   * @param id - The collection ID to retrieve
   * @returns The collection data from cache
   */
  getCollection(id: string): CollectionCache

  /**
   * Adds a new collection to storage
   * @param name
   * @param description
   * @returns The newly created collection
   */
  addCollection(name: string, description?: string): CollectionCache

  /**
   * Imports a new collection
   *
   * @param collection A previously exported collection
   * @param overrideName
   */
  importCollection(collection: ExportedCollection, overrideName?: string): CollectionCache

  /**
   * Merge the provided collection data into an existing collection without replacing it entirely.
   * Matching requests are identified by ID, then by the pair of HTTP method and URL.
   */
  mergeCollection(
    collectionId: string,
    collection: ExportedCollection,
  ): {
    addedRequests: number
    updatedRequests: number
    addedEnvironments: number
    updatedEnvironments: number
  }

  /**
   * Creates an exported collection for saving to disk
   *
   * @param collectionId The collection to export
   */
  exportCollection(collectionId: string): ExportedCollection

  /**
   * Updates an existing collection
   * @param id - The collection ID to update
   * @param patch - The partial data to apply
   * @returns The updated collection from the cache
   */
  updateCollection(id: string, patch: Partial<Collection>): CollectionCache

  /**
   * Removes all requests from the scratch collection
   */
  clearScratchCollection(): void

  /**
   * Removes a collection from storage
   * @param id - The collection ID to remove
   */
  removeCollection(id: string): void

  /**
   * Get a request with any draft changes applied from a collection
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @returns The request with draft changes applied or null if not found
   */
  getRequest(collectionId: string, requestId: string): RequestState

  /**
   * Create a new RequestState with default values
   *
   * @param collectionId - Collection ID
   * @param request Partial RequestState. name is required
   */
  createRequest(collectionId: string, request: Some<RequestState, "name">): RequestState

  /**
   * Create a duplicate of an existing request
   *
   * @param collectionId
   * @param requestId
   */
  duplicateRequest(collectionId: string, requestId: string): void

  /**
   * Remove a request from a collection
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   */
  deleteRequest(collectionId: string, requestId: string): void

  /**
   * Update the draft of a request without saving to the persistent store
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @param update - Partial request data to update
   */
  updateRequest(collectionId: string, requestId: string, update: Partial<RequestState>): void

  updateRequestPatchQueryParam(
    collectionId: string,
    requestId: string,
    id: string,
    update: Partial<RequestQueryParam> | null,
  ): void

  updateRequestPatchPathParam(
    collectionId: string,
    requestId: string,
    id: string,
    update: Partial<RequestPathParam> | null,
  ): void

  updateRequestPatchHeader(
    collectionId: string,
    requestId: string,
    id: string,
    update: Partial<RequestHeader> | null,
  ): void

  updateRequestPatchCookieParam(
    collectionId: string,
    requestId: string,
    id: string,
    update: Partial<RequestCookieParam> | null,
  ): void

  /**
   * Update a single form-data field within the request body patch.
   * Passing `null` removes the field from the patch.
   */
  setRequestBodyFormField(collectionId: string, requestId: string, id: string, update: Partial<FormField> | null): void

  /**
   * Merge request body updates into the draft patch, pruning equal values.
   */
  updateRequestBody(collectionId: string, requestId: string, update: Partial<RequestBodyData>): void

  /**
   * Replace the request authentication draft with the provided configuration, pruning when equal to base.
   */
  setRequestAuthentication(collectionId: string, requestId: string, authentication: AuthConfig): void

  /**
   * Merge request client options into the draft patch, pruning when unchanged.
   */
  updateRequestOptions(collectionId: string, requestId: string, updates: Partial<ClientOptionsData>): void

  /**
   * Toggle request auto-save behavior while cleaning the patch when equal to base.
   */
  setRequestAutoSave(collectionId: string, requestId: string, value: boolean): void

  /**
   * Update the request name while maintaining patch equality semantics.
   */
  setRequestName(collectionId: string, requestId: string, name: string): void

  /**
   * Update the request HTTP method.
   */
  setRequestMethod(collectionId: string, requestId: string, method: RequestState["method"]): void

  /**
   * Update the request URL.
   */
  setRequestUrl(collectionId: string, requestId: string, url: string): void

  /**
   * Discard the draft changes and revert to the original request
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   */
  discardRequestPatch(collectionId: string, requestId: string): void

  /**
   * Update an existing request in a collection by committing its draft changes
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   */
  commitRequestPatch(collectionId: string, requestId: string): RequestState

  /**
   * Reorder the collections index by assigning sequential order values.
   * Scratch collection remains first regardless of input order.
   */
  reorderCollections(orderIds: string[]): void

  /**
   * Create a new folder inside a collection.
   */
  createFolder(collectionId: string, parentId: string | null, name: string): CollectionFolderNode

  /**
   * Rename an existing folder.
   */
  renameFolder(collectionId: string, folderId: string, name: string): void

  /**
   * Delete a folder and optionally cascade its contents.
   */
  deleteFolder(collectionId: string, folderId: string): void

  /**
   * Move a folder under a new parent (position optional for ordering among siblings).
   */
  moveFolder(collectionId: string, folderId: string, targetParentId: string | null, position?: number): void

  /**
   * Reorder folders within the same parent.
   */
  reorderFolders(collectionId: string, parentId: string | null, orderedIds: string[]): void

  /**
   * Move a request to a different folder (position optional for ordering in target folder).
   */
  moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string, position?: number): void

  /**
   * Reorder requests within a specific folder.
   */
  reorderRequestsInFolder(collectionId: string, folderId: string, orderedIds: string[]): void
}

import { z } from "zod"

import { type EnvironmentsApi, zEnvironment } from "@/types/environments"
import type { Some } from "./common"
import type { AuthConfig } from "./request"
import {
  type ClientOptionsData,
  DefaultCollectionFolderId,
  type FormField,
  type RequestBodyData,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  zAuthConfig,
  zRequestState,
} from "./request"

/*
  [data-dir]\collections\.index.json            -> CollectionsIndexFileSchema
            \collections\.k[collectionId].json  -> CollectionFileSchema
 */

/**
 * State schema for an entry in the collection index file
 */
export const zCollectionIndexEntry = z.object({
  /**
   * Unique identifier for the collection
   */
  id: z.string(),
  /**
   * Sort order for the collection in the tree
   */
  order: z.number().int().optional(),
  /**
   * Name of the collection
   */
  name: z.string(),
  /**
   * Description of the collection
   */
  description: z.string().optional(),
  /**
   * Folder path(s) associated with the collection (optional)
   */
  folder: z.string().array().optional(),
  /**
   * Tags associated with the collection (optional)
   */
  tags: z.string().array().optional(),
  /**
   * Whether the collection is open/selected in the sidebar
   */
  open: z.boolean().optional(),
  /**
   * List of requestIds opened in tabs for this collection (UI state)
   */
  opened: z.array(z.string()).optional(),
  /**
   * Number of requests in the collection
   */
  count: z.number().default(0),
  /**
   * Creation timestamp (optional)
   */
  created: z.iso.datetime().optional(),
  /**
   * Last update timestamp (optional)
   */
  updated: z.iso.datetime().optional(),
})
export type CollectionsIndexEntry = z.infer<typeof zCollectionIndexEntry>

/**
 * Schema for collection index
 */
export const zCollectionsIndex = z.object({
  /**
   * Array of collection metadata entries
   */
  index: z.array(zCollectionIndexEntry),
})
export type CollectionsIndex = z.infer<typeof zCollectionsIndex>

export const zEncryptionAlgorithm = z.enum(["aes-gcm"])

export const zEncryption = z.object({
  algorithm: zEncryptionAlgorithm,
  key: z.string().optional(),
})

export const RootCollectionFolderId = DefaultCollectionFolderId

export const zCollectionFolderNode = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  order: z.number().int().default(0),
  childFolderIds: z.array(z.string()).default([]),
  requestIds: z.array(z.string()).default([]),
})
export type CollectionFolderNode = z.infer<typeof zCollectionFolderNode>

/**
 * CollectionDataSchema - Data stored for a collection
 */
export const zCollection = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  updated: z.iso.datetime().prefault(new Date().toISOString()),
  encryption: zEncryption,
  activeEnvironmentId: z.string().optional(),
  environments: z.record(z.string(), zEnvironment).default({}),
  requests: z.record(zRequestState.shape.id, zRequestState).default({}),
  folders: z.record(z.string(), zCollectionFolderNode).default({}),
  authentication: zAuthConfig,
})
export type Collection = z.infer<typeof zCollection>

export const zCollectionRequestLocation = z.object({
  folderId: z.string(),
  ancestry: z.array(z.string()),
})
export type CollectionRequestLocation = z.infer<typeof zCollectionRequestLocation>

export type CollectionCache = Collection & {
  requestIndex: Record<string, CollectionRequestLocation>
}

/**
 * Schema for a collection exported in native format
 */
export const zExportedCollection = z.object({
  format: z.literal("native"),
  version: z.string(),
  exportedAt: z.iso.datetime(),
  collection: zCollection.partial(),
})
export type ExportedCollection = z.infer<typeof zExportedCollection>

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
    update: Partial<import("@/types").RequestCookieParam> | null,
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

export type CollectionsState = {
  index: CollectionsIndex["index"]
  cache: Record<Collection["id"], CollectionCache>
}

export interface CollectionsSlice {
  collectionsState: CollectionsState
  collectionsApi: CollectionsApi
}

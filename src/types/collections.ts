import { z } from "zod"

import { type EnvironmentsApi, zEnvironment } from "@/types/environments"
import type { Patch, Some } from "./common"
import {
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
export const zCollectionIndexStateEntry = z.object({
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
export type CollectionsIndexEntryState = z.infer<typeof zCollectionIndexStateEntry>

/**
 * Schema for collection index
 */
export const zCollectionsIndexState = z.object({
  /**
   * Array of collection metadata entries
   */
  index: z.array(zCollectionIndexStateEntry),
})
export type CollectionsIndexState = z.infer<typeof zCollectionsIndexState>

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
export const zCollectionState = z.object({
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
export type CollectionState = z.infer<typeof zCollectionState>

export const zCollectionRequestLocation = z.object({
  folderId: z.string(),
  ancestry: z.array(z.string()),
})
export type CollectionRequestLocation = z.infer<typeof zCollectionRequestLocation>

export type CollectionCacheState = CollectionState & {
  requestIndex: Record<string, CollectionRequestLocation>
}

/**
 * Schema for a collection exported in native format
 */
export const zExportedCollection = z.object({
  format: z.literal("native"),
  version: z.string(),
  exportedAt: z.iso.datetime(),
  collection: zCollectionState.partial(),
})
export type ExportedCollection = z.infer<typeof zExportedCollection>

export interface Collection extends CollectionState {}

export interface CollectionsIndexStateApi {
  /**
   * Get all collections index
   * @returns Promise resolving to a collection array
   */
  getCollectionsIndex(): CollectionsIndexEntryState[]

  setCollectionsIndex(index: CollectionsIndexEntryState[]): Promise<void>
}

/**
 * Interface for collection management
 */
export interface CollectionsStateApi extends CollectionsIndexStateApi, EnvironmentsApi {
  /**
   * Forces saving a collection and the index to disk
   */
  saveCollection(collection: CollectionCacheState | string): void

  /**
   * Retrieves a specific collection by ID
   * @param id - The collection ID to retrieve
   * @returns The collection data or null if not found
   */
  getCollection(id: string): Promise<CollectionCacheState>

  /**
   * Adds a new collection to storage
   * @param name
   * @param description
   * @returns A Promise that resolves when the collection is saved
   */
  addCollection(name: string, description?: string): Promise<CollectionCacheState>

  /**
   * Imports a new collection
   *
   * @param collection A previously exported collection
   * @param overrideName
   */
  importCollection(collection: ExportedCollection, overrideName?: string): Promise<CollectionCacheState>

  /**
   * Merge the provided collection data into an existing collection without replacing it entirely.
   * Matching requests are identified by ID, then by the pair of HTTP method and URL.
   */
  mergeCollection(
    collectionId: string,
    collection: ExportedCollection,
  ): Promise<{
    addedRequests: number
    updatedRequests: number
    addedEnvironments: number
    updatedEnvironments: number
  }>

  /**
   * Creates an exported collection for saving to disk
   *
   * @param collectionId The collection to export
   */
  exportCollection(collectionId: string): Promise<ExportedCollection>

  /**
   * Updates an existing collection
   * @param id - The collection ID to update
   * @param patch - The partial data to apply
   * @returns A Promise that resolves when the collection is saved
   */
  updateCollection(id: string, patch: Partial<CollectionState>): Promise<CollectionCacheState>

  /**
   * Removes all requests from the scratch collection
   * @returns A Promise that resolves when the collection is saved
   */
  clearScratchCollection(): Promise<void>

  /**
   * Removes a collection from storage
   * @param id - The collection ID to remove
   * @returns A Promise that resolves when the collection is deleted
   */
  removeCollection(id: string): Promise<void>

  /**
   * Get a request with any draft changes applied from a collection
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @returns The request with draft changes applied or null if not found
   */
  getRequest(collectionId: string, requestId: string): Promise<RequestState>

  /**
   * Create a new RequestState with default values
   *
   * @param collectionId - Collection ID
   * @param request Partial RequestState. name is required
   */
  createRequest(collectionId: string, request: Some<RequestState, "name">): Promise<RequestState>

  /**
   * Create a duplicate of an existing request
   *
   * @param collectionId
   * @param requestId
   */
  duplicateRequest(collectionId: string, requestId: string): Promise<void>

  /**
   * Remove a request from a collection
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @returns Promise resolving when removed
   */
  deleteRequest(collectionId: string, requestId: string): Promise<void>

  /**
   * Update the draft of a request without saving to the persistent store
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @param update - Partial request data to update
   */
  updateRequest(collectionId: string, requestId: string, update: Partial<RequestState>): Promise<void>

  /**
   * Update the draft of a request without saving to the persistent store
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @param patch - Partial request data to update in draft
   */
  updateRequestPatch(collectionId: string, requestId: string, patch: Patch<RequestState["patch"]>): Promise<void>

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

  updateRequestPatchFormData(
    collectionId: string,
    requestId: string,
    id: string,
    update: Partial<FormField> | null,
  ): void

  updateRequestPatchBody(collectionId: string, requestId: string, update: Partial<RequestBodyData>): void

  /**
   * Discard the draft changes and revert to the original request
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   */
  discardRequestPatch(collectionId: string, requestId: string): Promise<void>

  /**
   * Update an existing request in a collection by committing its draft changes
   * @param collectionId - Collection ID
   * @param requestId - Request ID
   * @returns Promise resolving when updated
   */
  commitRequestPatch(collectionId: string, requestId: string): Promise<RequestState>

  /**
   * Reorder the collections index by assigning sequential order values.
   * Scratch collection remains first regardless of input order.
   */
  reorderCollections(orderIds: string[]): Promise<void>

  /**
   * Create a new folder inside a collection.
   */
  createFolder(collectionId: string, parentId: string | null, name: string): Promise<CollectionFolderNode>

  /**
   * Rename an existing folder.
   */
  renameFolder(collectionId: string, folderId: string, name: string): Promise<void>

  /**
   * Delete a folder and optionally cascade its contents.
   */
  deleteFolder(collectionId: string, folderId: string): Promise<void>

  /**
   * Move a folder under a new parent (position optional for ordering among siblings).
   */
  moveFolder(collectionId: string, folderId: string, targetParentId: string | null, position?: number): Promise<void>

  /**
   * Reorder folders within the same parent.
   */
  reorderFolders(collectionId: string, parentId: string | null, orderedIds: string[]): Promise<void>

  /**
   * Move a request to a different folder (position optional for ordering in target folder).
   */
  moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string, position?: number): Promise<void>

  /**
   * Reorder requests within a specific folder.
   */
  reorderRequestsInFolder(collectionId: string, folderId: string, orderedIds: string[]): Promise<void>
}

export type CollectionsState = {
  index: CollectionsIndexState["index"]
  cache: Record<CollectionState["id"], CollectionCacheState>
}

export interface CollectionsStateSlice {
  collectionsState: CollectionsState
  collectionsApi: CollectionsStateApi
}

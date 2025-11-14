import { z } from "zod"
import { zEnvironment } from "@/types/environments"
import { zAuthConfig, zRequestState } from "@/types/request"
import { DefaultCollectionFolderId } from "@/types/request"

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
  created: z.string().datetime().optional(),
  /**
   * Last update timestamp (optional)
   */
  updated: z.string().datetime().optional(),
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
  updated: z.string().datetime().default(new Date().toISOString()),
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
  exportedAt: z.string().datetime(),
  collection: zCollection.partial(),
})
export type ExportedCollection = z.infer<typeof zExportedCollection>

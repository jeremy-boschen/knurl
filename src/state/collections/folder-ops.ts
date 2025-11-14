/**
 * Folder hierarchy operations
 *
 * Handles all folder-level operations:
 * - Creating, renaming, deleting folders
 * - Moving folders within the hierarchy
 * - Reordering folders
 */

import type { StateCreator } from "zustand"

import { assert, generateUniqueId } from "@/lib/utils"
import {
  countCollectionRequests,
  createFolderNode,
  deleteFolderCascade,
  getFolderOrThrow,
  insertChildFolder,
  moveFolderNode,
  reorderChildFolders,
} from "@/state/collections-lib"
import type { Application, CollectionFolderNode } from "@/types"
import { touch, getLoadedCollection, assertCollectionLoaded } from "./core"

/**
 * Creates folder operation handlers
 */
export function createFolderOps(set: ReturnType<StateCreator<Application>>, get: () => Application) {
  return {
    createFolder(collectionId: string, parentId: string | null, name: string): CollectionFolderNode {
      assertCollectionLoaded(collectionId)
      const collection = getLoadedCollection(get, collectionId)
      if (parentId) {
        getFolderOrThrow(collection, parentId)
      }

      const folder = createFolderNode(generateUniqueId(), name, parentId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during folder creation`)
        const coll = touch(draftCollection)
        coll.folders[folder.id] = folder
        insertChildFolder(coll, parentId, folder.id)
      })

      return folder
    },

    renameFolder(collectionId: string, folderId: string, name: string): void {
      assertCollectionLoaded(collectionId)
      const collection = getLoadedCollection(get, collectionId)
      getFolderOrThrow(collection, folderId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during folder rename`)
        const coll = touch(draftCollection)
        const draftFolder = coll.folders[folderId]
        assert(draftFolder, `Folder ${folderId} missing from collection during rename`)
        draftFolder.name = name
      })
    },

    deleteFolder(collectionId: string, folderId: string): void {
      assertCollectionLoaded(collectionId)
      const collection = getLoadedCollection(get, collectionId)
      getFolderOrThrow(collection, folderId)

      let requestIds: string[] = []
      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during folder delete`)
        const coll = touch(draftCollection)

        // Get requests to delete from the draft collection (must be inside Immer context)
        const cascadeResult = deleteFolderCascade(coll, folderId)
        requestIds = cascadeResult.removedRequestIds

        // Remove folder and all nested folders
        const toRemove = [folderId]
        while (toRemove.length > 0) {
          const current = toRemove.pop()
          if (!current) {
            break
          }
          const f = coll.folders[current]
          if (f) {
            toRemove.push(...f.childFolderIds)
            delete coll.folders[current]
          }
        }

        // Remove from parent's children
        const draftFolder = coll.folders[folderId]
        if (draftFolder?.parentId) {
          const parent = coll.folders[draftFolder.parentId]
          if (parent) {
            parent.childFolderIds = parent.childFolderIds.filter((id) => id !== folderId)
          }
        }

        // Remove all requests in the folder (recursively handled by deleteFolderCascade)
        for (const requestId of requestIds) {
          delete coll.requests[requestId]
          delete coll.requestIndex[requestId]
        }

        const index = app.collectionsState.index.find((e) => e.id === collectionId)
        if (index) {
          index.count = countCollectionRequests(coll)
        }
      })

      // Close any open tabs for deleted requests
      const { requestTabsApi } = get()
      const openTabs = Object.values(get().requestTabsState.openTabs)
      for (const tab of openTabs) {
        if (tab.collectionId === collectionId && requestIds.includes(tab.requestId)) {
          void requestTabsApi.removeTab(tab.tabId)
        }
      }
    },

    moveFolder(collectionId: string, folderId: string, targetParentId: string | null, position?: number): void {
      assertCollectionLoaded(collectionId)
      const collection = getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during folder move`)
        const coll = touch(draftCollection)
        moveFolderNode(coll, folderId, targetParentId, position)
      })
    },

    reorderFolders(collectionId: string, parentId: string | null, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during folder reorder`)
        const coll = touch(draftCollection)
        reorderChildFolders(coll, parentId, orderedIds)
      })
    },
  }
}

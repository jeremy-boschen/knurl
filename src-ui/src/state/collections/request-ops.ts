/**
 * Request CRUD and patch management operations
 *
 * Handles all request-level operations:
 * - Creating, reading, updating, deleting requests
 * - Request duplication and movement
 * - Request patch accumulation and commit/discard
 * - Request field mutation (URL, method, auth, body, options)
 */

import { mergeWith } from "es-toolkit"
import { current } from "immer"
import type { StateCreator } from "zustand"

import { assert, generateUniqueId, isNotEmpty } from "@/lib/utils"
import {
  applyBodyPatchUpdates,
  countCollectionRequests,
  ensureObjectPatch,
  ensureParamPatch,
  ensureRequestPatch,
  findRequestInCollection,
  insertRequestIntoFolder,
  moveRequestWithinCollection,
  pruneObjectPatchIfEqual,
  pruneParamPatchIfEqual,
  removeRequestFromFolder,
  reorderFolderRequests,
} from "@/state/collections-lib"
import { naturalSort } from "@/state/collections/sort-utils"
import { zParse } from "@/state/utils"
import {
  type Application,
  type ClientOptionsData,
  type FormField,
  type RequestCookieParam,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  RootCollectionFolderId,
  zRequestState,
} from "@/types"
import type { Some } from "@/types/common"
import type { AuthConfig } from "@/types/request"
import { assertCollectionLoaded, getLoadedCollection, touch } from "./core"

/**
 * Creates request CRUD and patch management operation handlers
 */
export function createRequestOps(set: ReturnType<StateCreator<Application>>, get: () => Application) {
  return {
    // ===== Request CRUD =====
    getRequest(collectionId: string, requestId: string): RequestState {
      assertCollectionLoaded(collectionId)
      const collection = get().collectionsState.cache[collectionId]
      assert(collection, `getRequest called with unloaded collectionId:${collectionId}`)
      const { request } = findRequestInCollection(collection, requestId)
      return request
    },

    createRequest(collectionId: string, request: Some<RequestState, "name">): RequestState {
      const collectionsApi = get().collectionsApi
      assert(collectionsApi, "collectionsApi must be initialized")

      getLoadedCollection(get, collectionId)
      const folderId = request.folderId ?? RootCollectionFolderId

      const newRequest = zParse(zRequestState, {
        id: generateUniqueId(),
        collectionId,
        name: request.name,
        folderId,
        method: request.method ?? "GET",
        url: request.url ?? "",
        pathParams: request.pathParams ?? {},
        queryParams: request.queryParams ?? {},
        headers: request.headers ?? {},
        cookieParams: request.cookieParams ?? {},
        body: {
          type: "none",
          ...request.body,
        },
        authentication: request.authentication ?? { type: "none" },
        ...request,
      })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request creation`)
        const coll = touch(draftCollection)
        coll.requests[newRequest.id] = newRequest
        insertRequestIntoFolder(coll, newRequest.folderId, newRequest)

        const index = app.collectionsState.index.find((e) => e.id === collectionId)
        if (index) {
          index.count = countCollectionRequests(coll)
        }
      })

      return newRequest
    },

    deleteRequest(collectionId: string, requestId: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request delete`)

        const coll = touch(draftCollection)
        const { request, folder } = findRequestInCollection(coll, requestId)
        assert(request, `deleteRequest called with unknown requestId:${requestId}`)
        assert(folder, `deleteRequest: folder not found for requestId:${requestId}`)

        // Find and remove from folder's requestIds
        const currentFolder = coll.folders[request.folderId]
        if (currentFolder) {
          currentFolder.requestIds = currentFolder.requestIds.filter((id) => id !== requestId)
        }

        // Remove from collections
        delete coll.requests[requestId]
        delete coll.requestIndex[requestId]

        const index = app.collectionsState.index.find((e) => e.id === collectionId)
        if (index) {
          index.count = countCollectionRequests(coll)
        }
      })

      // Close any open tabs for this request
      const { requestTabsApi } = get()
      const openTabs = Object.values(get().requestTabsState.openTabs)
      for (const tab of openTabs) {
        if (tab.requestId === requestId && tab.collectionId === collectionId) {
          void requestTabsApi.removeTab(tab.tabId)
        }
      }
    },

    updateRequest(collectionId: string, requestId: string, update: Partial<RequestState>): void {
      assertCollectionLoaded(collectionId)
      getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request update`)
        const coll = touch(draftCollection)
        const { request, folder } = findRequestInCollection(coll, requestId)

        // Handle folder movement
        const oldFolderId = request.folderId
        const newFolderId = update.folderId

        if (newFolderId && newFolderId !== oldFolderId) {
          // Remove from old folder
          removeRequestFromFolder(coll, requestId)
          // Insert into new folder (which handles sorting)
          insertRequestIntoFolder(coll, newFolderId, request)
        }

        const oldName = request.name
        Object.assign(request, update)
        request.updated += 1

        // Block name from being in patch - name changes should never be patchable
        // Use setRequestName instead for name changes
        if (request.patch.name !== undefined) {
          delete request.patch.name
        }

        // If name changed (and folder didn't move, since that's handled above), re-sort the folder
        if (update.name && oldName !== update.name && !newFolderId) {
          folder.requestIds.sort((a, b) => {
            const nameA = coll.requests[a]?.name ?? ""
            const nameB = coll.requests[b]?.name ?? ""
            return naturalSort(nameA, nameB)
          })
          // Update order fields to match new positions
          folder.requestIds.forEach((id, index) => {
            if (coll.requests[id]) {
              coll.requests[id].order = index + 1
            }
          })
        }
      })
    },

    duplicateRequest(collectionId: string, requestId: string): void {
      assertCollectionLoaded(collectionId)
      const { request: original } = findRequestInCollection(getLoadedCollection(get, collectionId), requestId)

      const duplicate = zParse(zRequestState, {
        ...current(original),
        id: generateUniqueId(),
        name: `${original.name} (copy)`,
        patch: {},
      })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request duplication`)
        const coll = touch(draftCollection)
        coll.requests[duplicate.id] = duplicate
        insertRequestIntoFolder(coll, duplicate.folderId, duplicate)

        const index = app.collectionsState.index.find((e) => e.id === collectionId)
        if (index) {
          index.count = countCollectionRequests(coll)
        }
      })
    },

    moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string, position?: number): void {
      assertCollectionLoaded(collectionId)
      getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request move`)
        const coll = touch(draftCollection)
        moveRequestWithinCollection(coll, requestId, targetFolderId, position)
        const { request } = findRequestInCollection(coll, requestId)
        request.updated += 1
      })
    },

    // ===== Request Patch Management =====
    updateRequestPatchQueryParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestQueryParam> | null,
    ): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        ensureParamPatch(request, patch, "queryParams")
        if (update) {
          // Merge against existing patch first (to preserve prior edits), then fall back to base
          const baseParam = patch.queryParams?.[id] ?? request.queryParams?.[id] ?? {}
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees queryParams exists
          patch.queryParams![id] = { ...baseParam, ...update, id }
        } else {
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees queryParams exists
          delete patch.queryParams![id]
        }
        pruneParamPatchIfEqual(request, patch, "queryParams")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    updateRequestPatchPathParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestPathParam> | null,
    ): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        ensureParamPatch(request, patch, "pathParams")
        if (update) {
          // Merge against existing patch first (to preserve prior edits), then fall back to base
          const baseParam = patch.pathParams?.[id] ?? request.pathParams?.[id] ?? {}
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees pathParams exists
          patch.pathParams![id] = { ...baseParam, ...update, id }
        } else {
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees pathParams exists
          delete patch.pathParams![id]
        }
        pruneParamPatchIfEqual(request, patch, "pathParams")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    updateRequestPatchHeader(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestHeader> | null,
    ): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        ensureParamPatch(request, patch, "headers")
        if (update) {
          // Merge against existing patch first (to preserve prior edits), then fall back to base
          const baseHeader = patch.headers?.[id] ?? request.headers?.[id] ?? {}
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees headers exists
          patch.headers![id] = { ...baseHeader, ...update, id }
        } else {
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees headers exists
          delete patch.headers![id]
        }
        pruneParamPatchIfEqual(request, patch, "headers")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    updateRequestPatchCookieParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestCookieParam> | null,
    ): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        ensureParamPatch(request, patch, "cookieParams")
        if (update) {
          // Merge against existing patch first to avoid losing prior fields, then fall back to base
          const baseParam = patch.cookieParams?.[id] ?? request.cookieParams?.[id] ?? {}
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees cookieParams exists
          patch.cookieParams![id] = { ...baseParam, ...update, id }
        } else {
          // biome-ignore lint/style/noNonNullAssertion: ensureParamPatch guarantees cookieParams exists
          delete patch.cookieParams![id]
        }
        pruneParamPatchIfEqual(request, patch, "cookieParams")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestBodyFormField(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<FormField> | null,
    ): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        const formDataUpdate: Record<string, Partial<FormField> | undefined> = {
          [id]: update === null ? undefined : update,
        }
        applyBodyPatchUpdates(request, patch, {
          formData: formDataUpdate as Record<string, Partial<FormField> | undefined>,
        })
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    updateRequestBody(collectionId: string, requestId: string, update: Partial<RequestBodyData>): void {
      assert(isNotEmpty(update), "updateRequestBody called with empty update")
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        applyBodyPatchUpdates(request, patch, update)
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestAuthentication(collectionId: string, requestId: string, authentication: AuthConfig): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        patch.authentication = authentication
        pruneObjectPatchIfEqual(request, patch, "authentication")
        request.updated += 1
      })
    },

    updateRequestOptions(collectionId: string, requestId: string, updates: Partial<ClientOptionsData>): void {
      assert(isNotEmpty(updates), "updateRequestOptions called with empty updates")
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        const optionsPatch = ensureObjectPatch(request, patch, "options")
        Object.assign(optionsPatch, updates)
        pruneObjectPatchIfEqual(request, patch, "options")
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }
        request.updated += 1
      })
    },

    setRequestAutoSave(collectionId: string, requestId: string, value: boolean): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        patch.autoSave = value
        if (request.autoSave === value) {
          delete patch.autoSave
        }
        request.updated += 1
      })
    },

    setRequestName(collectionId: string, requestId: string, name: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const coll = app.collectionsState.cache[collectionId]
        const { request, folder } = findRequestInCollection(coll, requestId)
        const oldName = request.name

        // Update the request name directly - NEVER through patch
        // Name changes trigger folder re-sort and should not be undoable/discardable
        request.name = name
        request.updated += 1

        // Ensure patch.name is never set (blocking any patch-based name modifications)
        if (request.patch.name !== undefined) {
          delete request.patch.name
        }

        // If name changed, re-sort the folder to maintain alphabetical order
        if (oldName !== name) {
          folder.requestIds.sort((a, b) => {
            const nameA = coll.requests[a]?.name ?? ""
            const nameB = coll.requests[b]?.name ?? ""
            return naturalSort(nameA, nameB)
          })
          // Update order fields to match new positions
          folder.requestIds.forEach((id, index) => {
            if (coll.requests[id]) {
              coll.requests[id].order = index + 1
            }
          })
        }
      })
    },

    setRequestMethod(collectionId: string, requestId: string, method: RequestState["method"]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        patch.method = method
        if (request.method === method) {
          delete patch.method
        }
        request.updated += 1
      })
    },

    setRequestUrl(collectionId: string, requestId: string, url: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        patch.url = url
        if (request.url === url) {
          delete patch.url
        }
        request.updated += 1
      })
    },

    discardRequestPatch(collectionId: string, requestId: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        request.patch = {}
        request.updated += 1
      })
    },

    commitRequestPatch(collectionId: string, requestId: string) {
      getLoadedCollection(get, collectionId)

      const collection = get().collectionsState.cache[collectionId]
      assert(collection, `commitRequestPatch called with unknown collectionId:${collectionId}`)

      set((app) => {
        const cachedCollection = app.collectionsState.cache[collectionId]
        assert(cachedCollection, `commitRequestPatch called with unknown collectionId:${collectionId}`)
        const draftCollection = touch(cachedCollection)
        const { request } = findRequestInCollection(draftCollection, requestId)
        if (isNotEmpty(request?.patch)) {
          const preAuth = current(request.authentication)
          mergeWith(request, request.patch, (_target, source, key) => {
            if (
              key === "headers" ||
              key === "queryParams" ||
              key === "pathParams" ||
              key === "formData" ||
              key === "cookieParams"
            ) {
              return source
            }
            return undefined
          })
          const patchAuthType = request.patch?.authentication?.type
          if (patchAuthType && preAuth?.type && patchAuthType !== preAuth.type) {
            const oldType = preAuth.type
            if (oldType !== "none" && oldType !== "inherit") {
              // biome-ignore lint/suspicious/noExplicitAny: OK
              delete (request.authentication as any)[oldType]
            }
          }
          request.patch = {}
          request.updated += 1
        }
      })

      const latestCollection = get().collectionsState.cache[collectionId]
      assert(latestCollection, `commitRequestPatch called with unknown collectionId:${collectionId}`)
      return findRequestInCollection(latestCollection, requestId).request
    },

    reorderRequestsInFolder(collectionId: string, folderId: string, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request reorder`)
        const coll = touch(draftCollection)
        reorderFolderRequests(coll, folderId, orderedIds)
        for (const requestId of orderedIds) {
          const { request } = findRequestInCollection(coll, requestId)
          request.updated += 1
        }
      })
    },

    reorderPathParams(collectionId: string, requestId: string, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureParamPatch(request, "pathParams")
        const reorderedPathParams: Record<string, RequestPathParam> = {}
        for (const id of orderedIds) {
          const param = patch[id] ?? request.pathParams[id]
          assert(param, `Path parameter ${id} not found during reorder`)
          reorderedPathParams[id] = param
        }
        request.patch.pathParams = reorderedPathParams
        request.updated += 1
      })
    },

    reorderQueryParams(collectionId: string, requestId: string, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureParamPatch(request, "queryParams")
        const reorderedQueryParams: Record<string, RequestQueryParam> = {}
        for (const id of orderedIds) {
          const param = patch[id] ?? request.queryParams[id]
          assert(param, `Query parameter ${id} not found during reorder`)
          reorderedQueryParams[id] = param
        }
        request.patch.queryParams = reorderedQueryParams
        request.updated += 1
      })
    },

    reorderHeaders(collectionId: string, requestId: string, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureParamPatch(request, "headers")
        const reorderedHeaders: Record<string, RequestHeader> = {}
        for (const id of orderedIds) {
          const header = patch[id] ?? request.headers[id]
          assert(header, `Header ${id} not found during reorder`)
          reorderedHeaders[id] = header
        }
        request.patch.headers = reorderedHeaders
        request.updated += 1
      })
    },

    reorderCookieParams(collectionId: string, requestId: string, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureParamPatch(request, "cookieParams")
        const reorderedCookieParams: Record<string, RequestCookieParam> = {}
        for (const id of orderedIds) {
          const param = patch[id] ?? request.cookieParams[id]
          assert(param, `Cookie parameter ${id} not found during reorder`)
          reorderedCookieParams[id] = param
        }
        request.patch.cookieParams = reorderedCookieParams
        request.updated += 1
      })
    },

    reorderFormItems(collectionId: string, requestId: string, orderedIds: string[]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        const bodyPatch = ensureObjectPatch(request, patch, "body")
        const formDataPatch = ensureObjectPatch(request, bodyPatch, "formData")
        const reorderedFormItems: Record<string, FormField> = {}
        for (const id of orderedIds) {
          const item = formDataPatch[id] ?? request.body.formData?.[id]
          assert(item, `Form item ${id} not found during reorder`)
          reorderedFormItems[id] = item
        }
        bodyPatch.formData = reorderedFormItems
        request.updated += 1
      })
    },
  }
}

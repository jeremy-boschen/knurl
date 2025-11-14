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

import { assert, generateUniqueId, isNotEmpty, nonNull } from "@/lib/utils"
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
import { touch, getLoadedCollection, assertCollectionLoaded } from "./core"

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

      const collection = getLoadedCollection(get, collectionId)
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

        const { request, parentFolder } = findRequestInCollection(draftCollection, requestId)
        assert(request, `deleteRequest called with unknown requestId:${requestId}`)
        assert(parentFolder, `deleteRequest: parentFolder not found for requestId:${requestId}`)

        const coll = touch(draftCollection)
        delete coll.requests[requestId]
        removeRequestFromFolder(coll, request.folderId, requestId)

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
      const collection = getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request update`)
        const { request } = findRequestInCollection(touch(draftCollection), requestId)
        Object.assign(request, update)
        request.updated += 1
      })
    },

    duplicateRequest(collectionId: string, requestId: string): void {
      assertCollectionLoaded(collectionId)
      const collection = getLoadedCollection(get, collectionId)
      const { request: original } = findRequestInCollection(collection, requestId)

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
      const collection = getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request move`)
        const coll = touch(draftCollection)
        moveRequestWithinCollection(coll, requestId, targetFolderId, position)
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
        ensureParamPatch(request, request.patch!, "queryParams")
        if (update) {
          const baseParam = request.queryParams?.[id] ?? {}
          request.patch!.queryParams![id] = { ...baseParam, ...request.patch!.queryParams![id], ...update, id }
        } else {
          delete request.patch!.queryParams![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "queryParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }
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
        ensureParamPatch(request, request.patch!, "pathParams")
        if (update) {
          const baseParam = request.pathParams?.[id] ?? {}
          request.patch!.pathParams![id] = { ...baseParam, ...request.patch!.pathParams![id], ...update, id }
        } else {
          delete request.patch!.pathParams![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "pathParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }
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
        ensureParamPatch(request, request.patch!, "headers")
        if (update) {
          const baseHeader = request.headers?.[id] ?? {}
          request.patch!.headers![id] = { ...baseHeader, ...request.patch!.headers![id], ...update, id }
        } else {
          delete request.patch!.headers![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "headers")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }
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
        ensureParamPatch(request, request.patch!, "cookieParams")
        if (update) {
          const baseParam = request.cookieParams?.[id] ?? {}
          request.patch!.cookieParams![id] = { ...baseParam, ...request.patch!.cookieParams![id], ...update, id }
        } else {
          delete request.patch!.cookieParams![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "cookieParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }
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
        ensureRequestPatch(request)
        request.patch!.authentication = authentication
        pruneObjectPatchIfEqual(request, request.patch!, "authentication")
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
      })
    },

    setRequestName(collectionId: string, requestId: string, name: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        const patch = ensureRequestPatch(request)
        patch.name = name
        if (request.name === name) {
          delete patch.name
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
      })
    },
  }
}

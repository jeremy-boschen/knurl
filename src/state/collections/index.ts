/**
 * Collections state management slice
 *
 * Organized for future modularization into domain-specific modules:
 * - collection-ops.ts: Collection CRUD and management
 * - request-ops.ts: Request CRUD and patch management
 * - folder-ops.ts: Folder hierarchy operations
 * - environment-ops.ts: Environment management
 * - core.ts: Shared infrastructure (already extracted)
 */

import { merge, mergeWith } from "es-toolkit"
import { current } from "immer"
import type { StateCreator } from "zustand"

import { isAppError } from "@/bindings/knurl"
import { assert, generateUniqueId, isNotEmpty, nonNull } from "@/lib/utils"
import { invalidateCollectionPromise } from "@/state/application"
import type { MergeSummary } from "@/state/collections-lib"
import {
  applyBodyPatchUpdates,
  applyMergePlan,
  buildEnvironmentState,
  countCollectionRequests,
  createFolderNode,
  deleteFolderCascade,
  ensureObjectPatch,
  ensureParamPatch,
  ensureRequestPatch,
  findRequestInCollection,
  getFolderOrThrow,
  insertChildFolder,
  insertRequestIntoFolder,
  moveFolderNode,
  moveRequestWithinCollection,
  normalizeCollection,
  normalizeImportedCollection,
  prepareMergePlan,
  pruneObjectPatchIfEqual,
  pruneParamPatchIfEqual,
  removeRequestFromFolder,
  reorderChildFolders,
  reorderFolderRequests,
  sanitizeCollection,
  validateRequestIndex,
} from "@/state/collections-lib"
import { zParse } from "@/state/utils"
import {
  type Application,
  type ClientOptionsData,
  type Collection,
  type CollectionCache,
  type CollectionFolderNode,
  type CollectionsApi,
  type CollectionsIndex,
  type CollectionsIndexEntry,
  type CollectionsSlice,
  type CollectionsState,
  type Environment,
  type EnvironmentVariable,
  type ExportedCollection,
  type FormField,
  type RequestBodyData,
  type RequestCookieParam,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  RootCollectionFolderId,
  zCollection,
  zCollectionsIndex,
  zEnvironmentVariable,
  zRequestCookieParam,
  zRequestHeader,
  zRequestPathParam,
  zRequestQueryParam,
  zRequestState,
} from "@/types"
import type { Some } from "@/types/common"
import type { StorageProvider } from "@/types/middleware/storage-manager"
import type { AuthConfig } from "@/types/request"
import {
  CollectionFileName,
  CollectionIndexFileName,
  CollectionIndexStorage,
  CollectionStorage,
  ScratchCollectionId,
  setupCollectionStorage,
  touch,
  getLoadedCollection,
  internalAddCollection,
  loadScratchCollection,
  existsInIndex,
  createEnvironment,
  assertCollectionLoaded,
} from "./core"

export { sanitizeCollection } from "@/state/collections-lib"
export { ScratchCollectionId, isScratchCollection } from "./core"

export const createCollectionsSlice: StateCreator<
  Application,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CollectionsSlice
> = (set, get, storeApi) => {
  // Setup storage provider
  const storageProvider: StorageProvider<CollectionsState> = (() => {
    const timestamps: Record<string, string> = {}

    return {
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
  })()
  storeApi.registerStorageProvider(storageProvider)

  ///
  /// CollectionsApi Implementation
  ///
  const collectionsApi: CollectionsApi = {
    // ===== Collection Index Operations =====
    getCollectionsIndex(): CollectionsIndexEntry[] {
      return get().collectionsState.index
    },

    reorderCollections(orderIds: string[]) {
      set((app) => {
        const current = app.collectionsState.index.slice()
        const reord = orderIds
          .map((id) => current.find((e) => e.id === id))
          .filter((e): e is CollectionsIndexEntry => !!e)
        // Append any not present in orderIds to the end to be safe
        for (const e of current) {
          if (!reord.some((x) => x.id === e.id)) {
            reord.push(e)
          }
        }

        // Assign sequential order starting at 0
        let seq = 0
        for (const e of reord) {
          e.order = seq
          seq += 1
        }
        app.collectionsState.index = reord
      })

      void CollectionIndexStorage.save(CollectionIndexFileName(), get().collectionsState.index).catch((error) => {
        console.error("Failed to persist collections index", error)
      })
    },

    // ===== Collection CRUD =====
    saveCollection(collection: CollectionCache | string) {
      const cached = typeof collection === "string" ? getLoadedCollection(get, collection) : collection

      assert(existsInIndex(get, cached.id), `saveCollection called with an unknown collection.id: ${cached.id}`)

      void CollectionStorage.save(CollectionFileName(cached.id), sanitizeCollection(cached)).catch((error) => {
        console.error(`Failed to save collection ${cached.id}`, error)
      })
    },

    async loadCollection(id: string) {
      assert(existsInIndex(get, id), `loadCollection called with an unknown collection.id: ${id}`)

      const cached = get().collectionsState.cache[id]
      if (cached) {
        markCollectionLoaded(id)
        return cached
      }

      if (ScratchCollectionId === id) {
        return loadScratchCollection(set, get)
      }

      const collection = nonNull(
        await CollectionStorage.load(CollectionFileName(id)),
        `Collection file ${CollectionFileName(id)} could not be loaded`,
      )

      return internalAddCollection(collection, set)
    },

    getCollection(id: string) {
      assert(existsInIndex(get, id), `getCollection called with an unknown collection.id: ${id}`)
      return getLoadedCollection(get, id)
    },

    addCollection(name: string, description?: string) {
      const now = new Date().toISOString()
      const newCollection: Collection = {
        id: generateUniqueId(),
        name,
        description,
        updated: now,
        encryption: {
          algorithm: "aes-gcm",
          key: undefined,
        },
        environments: {},
        requests: {},
        folders: {
          [RootCollectionFolderId]: createFolderNode(RootCollectionFolderId, "Root", null),
        },
        authentication: {
          type: "none",
        },
      }

      return internalAddCollection(newCollection, set)
    },

    exportCollection: (collectionId: string): ExportedCollection => {
      const collection = collectionsApi.getCollection(collectionId)
      const sanitized = sanitizeCollection(collection)
      return {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: sanitized,
      }
    },

    importCollection: (exported: ExportedCollection, overrideName?: string): CollectionCache => {
      const normalized = normalizeImportedCollection(exported, overrideName)
      return internalAddCollection(normalized, set)
    },

    mergeCollection: (collectionId: string, exported: ExportedCollection) => {
      assertCollectionLoaded(collectionId)
      assert(existsInIndex(get, collectionId), `mergeCollection called with an unknown collection.id: ${collectionId}`)

      const currentCollection = get().collectionsState.cache[collectionId]
      assert(currentCollection, `mergeCollection called with unloaded collection.id: ${collectionId}`)

      const plan = prepareMergePlan(currentCollection, exported)
      let mergeSummary: MergeSummary | null = null

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `mergeCollection called with unloaded collection.id: ${collectionId}`,
          ),
        )

        mergeSummary = applyMergePlan(collection, plan)
        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `mergeCollection called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
        index.updated = collection.updated
      })

      return mergeSummary ?? plan.summary
    },

    updateCollection(collectionId: string, update: Partial<Collection>) {
      assert(
        update.id === undefined || update.id === collectionId,
        `updateCollection called with mismatched id:${collectionId} !== update.id:${update.id}`,
      )

      assertCollectionLoaded(collectionId)
      getLoadedCollection(get, collectionId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during collection update`)
        const draft = touch(draftCollection)
        merge(draft, update)

        if (update.name) {
          const index = nonNull(
            app.collectionsState.index.find((e) => e.id === collectionId),
            `updateCollection called with non-indexed collection.id: ${collectionId}`,
          )
          index.name = update.name
          index.updated = new Date().toISOString()
        }
      })

      return getLoadedCollection(get, collectionId)
    },

    clearScratchCollection() {
      const scratch = collectionsApi.getCollection(ScratchCollectionId)
      const requestIds = Object.keys(scratch.requests)

      if (requestIds.length === 0) {
        return
      }

      const { requestTabsApi } = get()

      // Close all open tabs for requests in the scratch collection
      const openTabs = Object.values(get().requestTabsState.openTabs)
      for (const tab of openTabs) {
        if (tab.collectionId === ScratchCollectionId) {
          void requestTabsApi.removeTab(tab.tabId)
        }
      }

      set((app) => {
        const scratchCollection = touch(
          nonNull(
            app.collectionsState.cache[ScratchCollectionId],
            "clearScratchCollection called but scratch collection not loaded",
          ),
        )
        scratchCollection.requests = {}
        for (const folder of Object.values(scratchCollection.folders)) {
          folder.requestIds = []
        }
        scratchCollection.requestIndex = {}

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === ScratchCollectionId),
          "clearScratchCollection called with non-indexed scratch collection",
        )
        index.count = 0
      })

      invalidateCollectionPromise(ScratchCollectionId)
    },

    removeCollection(id: string) {
      assert(existsInIndex(get, id), `updateCollection called with an unknown collection.id: ${id}`)

      if (ScratchCollectionId === id) {
        throw new Error("Cannot remove the unsaved collection")
      }

      set((app) => {
        delete app.collectionsState.cache[id]
        loadedCollections.delete(id)
        app.collectionsState.index = app.collectionsState.index.filter((e) => e.id !== id)
      })

      invalidateCollectionPromise(id)

      void CollectionStorage.delete(CollectionFileName(id)).catch((error) => {
        console.error(`Failed to delete collection ${id}`, error)
      })
    },

    // ===== Request CRUD =====
    getRequest(collectionId: string, requestId: string): RequestState {
      assertCollectionLoaded(collectionId)
      const collection = get().collectionsState.cache[collectionId]
      assert(collection, `getRequest called with unloaded collectionId:${collectionId}`)
      const { request } = findRequestInCollection(collection, requestId)
      return request
    },

    createRequest(collectionId: string, request: Some<RequestState, "name">): RequestState {
      assert(existsInIndex(get, collectionId), `createRequest called with unknown collectionId:${collectionId}`)

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
      const collection = getLoadedCollection(get, collectionId)

      const { request, parentFolder } = findRequestInCollection(collection, requestId)
      assert(request, `deleteRequest called with unknown requestId:${requestId}`)
      assert(parentFolder, `deleteRequest: parentFolder not found for requestId:${requestId}`)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during request delete`)
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
        merge(request, update)
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
          request.patch!.queryParams![id] = { ...request.patch!.queryParams![id], ...update, id }
        } else {
          delete request.patch!.queryParams![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "queryParams")
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
          request.patch!.pathParams![id] = { ...request.patch!.pathParams![id], ...update, id }
        } else {
          delete request.patch!.pathParams![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "pathParams")
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
          request.patch!.headers![id] = { ...request.patch!.headers![id], ...update, id }
        } else {
          delete request.patch!.headers![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "headers")
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
          request.patch!.cookieParams![id] = { ...request.patch!.cookieParams![id], ...update, id }
        } else {
          delete request.patch!.cookieParams![id]
        }
        pruneParamPatchIfEqual(request, request.patch!, "cookieParams")
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
        pruneObjectPatchIfEqual(request, ["authentication"])
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
        ensureRequestPatch(request)
        request.patch!.autoSave = value
        pruneObjectPatchIfEqual(request, ["autoSave"])
      })
    },

    setRequestName(collectionId: string, requestId: string, name: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        ensureRequestPatch(request)
        request.patch!.name = name
        pruneObjectPatchIfEqual(request, ["name"])
      })
    },

    setRequestMethod(collectionId: string, requestId: string, method: RequestState["method"]): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        ensureRequestPatch(request)
        request.patch!.method = method
        pruneObjectPatchIfEqual(request, ["method"])
      })
    },

    setRequestUrl(collectionId: string, requestId: string, url: string): void {
      assertCollectionLoaded(collectionId)

      set((app) => {
        const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
        ensureRequestPatch(request)
        request.patch!.url = url
        pruneObjectPatchIfEqual(request, ["url"])
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

    // ===== Folder Operations =====
    createFolder(collectionId: string, parentId: string | null, name: string): CollectionFolderNode {
      assertCollectionLoaded(collectionId)
      const collection = getLoadedCollection(get, collectionId)
      const parent = parentId ? getFolderOrThrow(collection, parentId) : null

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
      const folder = getFolderOrThrow(collection, folderId)

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
      const folder = getFolderOrThrow(collection, folderId)

      const requestIds = deleteFolderCascade(collection, folderId)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during folder delete`)
        const coll = touch(draftCollection)

        // Remove folder and all nested folders
        const toRemove = [folderId]
        while (toRemove.length > 0) {
          const current = toRemove.pop()!
          const f = coll.folders[current]
          if (f) {
            toRemove.push(...f.childFolderIds)
            delete coll.folders[current]
          }
        }

        // Remove from parent's children
        if (folder.parentId) {
          const parent = coll.folders[folder.parentId]
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

    // ===== Environment Operations =====
    createEnvironment(collectionId: string, name: string, description?: string) {
      assert(existsInIndex(get, collectionId), `updateCollection called with an unknown collection.id: ${collectionId}`)

      getLoadedCollection(get, collectionId)

      const newEnvironment = createEnvironment({ name, description })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment creation`)
        const environments = touch(draftCollection).environments
        assert(environments, `Collection ${collectionId} missing environments map during creation`)
        environments[newEnvironment.id] = newEnvironment
      })

      return newEnvironment
    },

    updateEnvironment(collectionId: string, id: string, update: Partial<Environment>) {
      assert(existsInIndex(get, collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === id,
        `updateEnvironment expected update.id to be absent or equal to id:${id}. Found ${update.id}`,
      )

      const collection = getLoadedCollection(get, collectionId)

      assert(
        collection.environments?.[id],
        `updateEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment update`)
        const environment = touch(draftCollection).environments?.[id]
        assert(environment, `Environment ${id} missing from collection ${collectionId} during update`)
        merge(environment, update)
      })
    },

    deleteEnvironment(collectionId: string, id: string) {
      assert(existsInIndex(get, collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      const collection = getLoadedCollection(get, collectionId)
      assert(
        collection.environments?.[id],
        `deleteEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment delete`)
        const environments = touch(draftCollection).environments
        if (environments?.[id]) {
          delete environments[id]
        }
      })
    },

    setActiveEnvironment(collectionId: string, environmentId: string | undefined) {
      assert(
        existsInIndex(get, collectionId),
        `setActiveEnvironment called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(get, collectionId)
      if (environmentId !== undefined) {
        assert(
          collection.environments?.[environmentId],
          `setActiveEnvironment called with unknown environment.id:${environmentId} on collection ${collectionId}:${collection.name}`,
        )
      }

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment activation`)
        touch(draftCollection).activeEnvironmentId = environmentId
      })
    },

    addEnvironmentVariable(collectionId: string, environmentId: string, variable: Partial<EnvironmentVariable>) {
      assert(
        existsInIndex(get, collectionId),
        `addEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = getLoadedCollection(get, collectionId)

      assert(
        collection.environments?.[environmentId],
        `addEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )

      const newVariable = zParse(zEnvironmentVariable, {
        name: "",
        value: "",
        secure: false,
        ...variable,
        id: generateUniqueId(8),
      })

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable creation`)
        const environment = touch(draftCollection).environments?.[environmentId]
        assert(
          environment,
          `Environment ${environmentId} missing from collection ${collectionId} during variable creation`,
        )
        environment.variables[newVariable.id] = newVariable
      })

      return newVariable
    },

    updateEnvironmentVariable(
      collectionId: string,
      environmentId: string,
      variableId: string,
      update: Partial<EnvironmentVariable>,
    ) {
      assert(existsInIndex(get, collectionId), `updateEnvironmentVariable: unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === variableId,
        `updateEnvironmentVariable expected update.id to be absent or equal to id:${variableId}. Found ${update.id}`,
      )

      const collection = getLoadedCollection(get, collectionId)
      const env = collection.environments?.[environmentId]
      assert(env, `updateEnvironmentVariable: unknown environment.id: ${environmentId}`)
      assert(
        env.variables?.[variableId],
        `updateEnvironmentVariable: unknown variable.id:${variableId} in environment ${environmentId}`,
      )

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable update`)
        const variable = touch(draftCollection).environments?.[environmentId]?.variables?.[variableId]
        assert(variable, `Variable ${variableId} missing during update`)
        merge(variable, update)
      })
    },

    deleteEnvironmentVariable(collectionId: string, environmentId: string, variableId: string) {
      assert(existsInIndex(get, collectionId), `deleteEnvironmentVariable: unknown collection.id: ${collectionId}`)
      const collection = getLoadedCollection(get, collectionId)
      const env = collection.environments?.[environmentId]
      assert(env, `deleteEnvironmentVariable: unknown environment.id: ${environmentId}`)
      assert(env.variables?.[variableId], `deleteEnvironmentVariable: unknown variable.id: ${variableId}`)

      set((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during variable delete`)
        const environment = touch(draftCollection).environments?.[environmentId]
        if (environment?.variables?.[variableId]) {
          delete environment.variables[variableId]
        }
      })
    },
  }

  return {
    collectionsState: {
      index: [],
      cache: {},
    },
    collectionsApi,
  }
}

export const saveScratchRequest = (
  app: Application,
  tabId: string,
  collectionId: string,
  requestId: string,
  moveToCollection: string | undefined,
) => {
  if (!moveToCollection) {
    // Save in-place; no moving
    app.collectionsApi.commitRequestPatch(collectionId, requestId)
    return requestId
  }

  // Move from scratch to destination collection
  const request = app.collectionsApi.getRequest(collectionId, requestId)

  // Create duplicate in destination collection
  const newRequest = app.collectionsApi.createRequest(moveToCollection, {
    ...request,
    collectionId: moveToCollection,
    patch: {},
  })

  // Remove from scratch collection
  app.collectionsApi.deleteRequest(collectionId, requestId)

  // Update the tab to point to the new request
  app.requestTabsApi.updateTab(tabId, {
    collectionId: moveToCollection,
    requestId: newRequest.id,
  })

  return newRequest.id
}

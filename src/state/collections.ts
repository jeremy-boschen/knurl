import { isEqual, merge, mergeWith, toMerged } from "es-toolkit"
import { current, produceWithPatches } from "immer"
import type { StateCreator } from "zustand"

import { isAppError } from "@/bindings/knurl"
import { assert, generateUniqueId, isNotEmpty, nonNull } from "@/lib/utils"
import { createStorage, type MigrateContext } from "@/state/middleware/storage"
import { invalidateCollectionPromise } from "@/state/application"
import { zParse } from "@/state/utils"
import {
  RootCollectionFolderId,
  type ApplicationState,
  type CollectionCacheState,
  type CollectionFolderNode,
  type CollectionRequestLocation,
  type CollectionState,
  type CollectionsIndexEntryState,
  type CollectionsIndexState,
  type CollectionsState,
  type CollectionsStateApi,
  type CollectionsStateSlice,
  type Environment,
  type EnvironmentVariable,
  type ExportedCollection,
  type FormField,
  type RequestBodyData,
  type RequestHeader,
  type RequestCookieParam,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  zCollectionState,
  zCollectionsIndexState,
  zEnvironment,
  zEnvironmentVariable,
  zFormField,
  zRequestHeader,
  zRequestCookieParam,
  zRequestPathParam,
  zRequestQueryParam,
  zRequestState,
} from "@/types"
import type { Patch, Some } from "@/types/common"
import type { AuthConfig } from "@/types/request"
import type { StorageProvider } from "@/types/middleware/storage-manager"

// --- Shared helpers (module-level) ---

const redactAuth = (auth: AuthConfig | undefined): AuthConfig | undefined => {
  if (!auth) {
    return auth
  }
  if (auth.type === "bearer") {
    return {
      type: "bearer",
      bearer: {
        ...auth.bearer,
        token: undefined,
        placement: auth.bearer?.placement,
        scheme: auth.bearer?.scheme,
      },
    }
  }
  return auth
}

const buildRequestSignature = (method: string | undefined, url: string | undefined): string => {
  const normalizedMethod = (method ?? "").trim().toUpperCase()
  const normalizedUrl = (url ?? "").trim()
  return `${normalizedMethod}::${normalizedUrl}`
}

const createFolderNode = (id: string, name: string, parentId: string | null, order = 0): CollectionFolderNode => ({
  id,
  name,
  parentId,
  order,
  childFolderIds: [],
  requestIds: [],
})

const buildAncestry = (folderId: string, folders: Record<string, CollectionFolderNode>): string[] => {
  const ancestry: string[] = []
  let currentId = folderId
  const safety = Object.keys(folders).length + 1
  let guard = 0
  while (currentId) {
    const node = folders[currentId]
    if (!node) {
      break
    }
    ancestry.unshift(currentId)
    if (node.parentId === null) {
      break
    }
    currentId = node.parentId
    guard += 1
    if (guard > safety) {
      break
    }
  }
  return ancestry
}

const buildRequestIndex = (collection: {
  folders: Record<string, CollectionFolderNode>
  requests: Record<string, RequestState>
}): Record<string, CollectionRequestLocation> => {
  const index: Record<string, CollectionRequestLocation> = {}
  for (const request of Object.values(collection.requests)) {
    const folderId =
      request.folderId && collection.folders[request.folderId] ? request.folderId : RootCollectionFolderId
    index[request.id] = {
      folderId,
      ancestry: buildAncestry(folderId, collection.folders),
    }
  }
  return index
}

const buildRequestIndexEntry = (collection: CollectionCacheState, requestId: string) => {
  const request = collection.requests[requestId]
  if (!request) {
    return
  }
  const folderId = request.folderId && collection.folders[request.folderId] ? request.folderId : RootCollectionFolderId
  request.folderId = folderId
  collection.requestIndex[requestId] = {
    folderId,
    ancestry: buildAncestry(folderId, collection.folders),
  }
}

const updateRequestIndexForFolder = (collection: CollectionCacheState, folderId: string) => {
  const folder = collection.folders[folderId]
  if (!folder) {
    return
  }
  for (const requestId of folder.requestIds) {
    buildRequestIndexEntry(collection, requestId)
  }
}

const updateRequestIndexForSubtree = (collection: CollectionCacheState, folderId: string) => {
  const queue = [folderId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }
    const node = collection.folders[current]
    if (!node) {
      continue
    }
    updateRequestIndexForFolder(collection, current)
    queue.push(...node.childFolderIds)
  }
}

const removeRequestIndexEntry = (collection: CollectionCacheState, requestId: string) => {
  delete collection.requestIndex[requestId]
}

const shouldValidateRequestIndex = import.meta.env?.DEV === true

const validateRequestIndex = (collection: CollectionCacheState) => {
  if (!shouldValidateRequestIndex) {
    return
  }
  const requestIds = Object.keys(collection.requests)
  const indexIds = Object.keys(collection.requestIndex)
  if (requestIds.length !== indexIds.length) {
    rebuildRequestIndex(collection)
    return
  }
  for (const requestId of requestIds) {
    const request = collection.requests[requestId]
    if (!request) {
      continue
    }
    const entry = collection.requestIndex[requestId]
    const folderId =
      request.folderId && collection.folders[request.folderId] ? request.folderId : RootCollectionFolderId
    const ancestry = buildAncestry(folderId, collection.folders)
    if (!entry || entry.folderId !== folderId || entry.ancestry.length !== ancestry.length) {
      rebuildRequestIndex(collection)
      return
    }
    for (let i = 0; i < ancestry.length; i += 1) {
      if (entry.ancestry[i] !== ancestry[i]) {
        rebuildRequestIndex(collection)
        return
      }
    }
  }
}

type RequestParamKey = "queryParams" | "pathParams" | "headers" | "cookieParams"

type RequestParamValueMap = {
  queryParams: RequestQueryParam
  pathParams: RequestPathParam
  headers: RequestHeader
  cookieParams: RequestCookieParam
}

const paramParsers: {
  [K in RequestParamKey]: (value: RequestParamValueMap[K]) => RequestParamValueMap[K]
} = {
  queryParams: (value) => zRequestQueryParam.parse(value),
  pathParams: (value) => zRequestPathParam.parse(value),
  headers: (value) => zRequestHeader.parse(value),
  cookieParams: (value) => zRequestCookieParam.parse(value),
}

const ensureParamPatch = <K extends RequestParamKey>(
  request: RequestState,
  patch: RequestState["patch"],
  key: K,
): Record<string, RequestParamValueMap[K]> => {
  const existing = patch[key] as Record<string, RequestParamValueMap[K]> | undefined
  if (existing) {
    return existing
  }

  const created = {} as Record<string, RequestParamValueMap[K]>
  const baseRecord = request[key] as Record<string, RequestParamValueMap[K]> | undefined
  if (baseRecord) {
    const parser = paramParsers[key]
    for (const [paramId, paramValue] of Object.entries(baseRecord)) {
      created[paramId] = parser({
        ...(paramValue as Partial<RequestParamValueMap[K]>),
        id: paramId,
      } as RequestParamValueMap[K])
    }
  }

  patch[key] = created as RequestState["patch"][K]
  return created
}

const pruneParamPatchIfEqual = <K extends RequestParamKey>(
  request: RequestState,
  patch: RequestState["patch"],
  key: K,
) => {
  const patchRecord = patch[key] as Record<string, RequestParamValueMap[K]> | undefined
  if (!patchRecord) {
    return
  }
  const baseRecord = request[key] as Record<string, RequestParamValueMap[K]> | undefined
  if (isEqual(patchRecord, baseRecord ?? {})) {
    delete patch[key]
  }
}

const ensureBodyPatch = (_request: RequestState, patch: RequestState["patch"]) => {
  if (!patch.body) {
    patch.body = {}
  }
  return patch.body
}

const normalizeFormDataForCompare = (entries: Record<string, FormField> | undefined) => {
  if (!entries) {
    return {}
  }
  const normalized: Record<string, FormField> = {}
  for (const [key, value] of Object.entries(entries)) {
    normalized[key] = zFormField.parse({ id: key, ...(value as Partial<FormField>) })
  }
  return normalized
}

const pruneBodyPatchIfEqual = (request: RequestState, patch: RequestState["patch"]) => {
  if (!patch.body) {
    return
  }
  const baseBody = request.body ?? { type: "none" }
  const patchBody = patch.body

  const keys = Object.keys(patchBody) as (keyof typeof patchBody)[]
  for (const key of keys) {
    if (key === "formData") {
      const patchFormData = normalizeFormDataForCompare(patchBody.formData as Record<string, FormField>)
      const baseFormData = normalizeFormDataForCompare(baseBody.formData ?? {})
      if (isEqual(patchFormData, baseFormData)) {
        delete patchBody.formData
      }
      continue
    }

    if ((patchBody as Record<string, unknown>)[key] === (baseBody as Record<string, unknown>)[key]) {
      delete (patchBody as Record<string, unknown>)[key]
    }
  }

  if (Object.keys(patchBody).length === 0) {
    delete patch.body
  }
}

const ensureObjectPatch = <K extends "authentication" | "options">(
  request: RequestState,
  patch: RequestState["patch"],
  key: K,
) => {
  if (!patch[key]) {
    const base = request[key] as Record<string, unknown> | undefined
    patch[key] = {
      ...(base ?? {}),
    } as RequestState["patch"][K]
  }
  return patch[key] as RequestState["patch"][K]
}

const pruneObjectPatchIfEqual = <K extends "authentication" | "options">(
  request: RequestState,
  patch: RequestState["patch"],
  key: K,
) => {
  const patchValue = patch[key]
  if (!patchValue) {
    return
  }
  if (isEqual(patchValue, request[key] ?? {})) {
    delete patch[key]
  }
}

const normalizeCollection = (collection: CollectionState): CollectionCacheState => {
  const folders: Record<string, CollectionFolderNode> = Object.fromEntries(
    Object.entries(collection.folders).map(([id, folder]) => [
      id,
      {
        ...folder,
        childFolderIds: folder.childFolderIds.slice(),
        requestIds: folder.requestIds.slice(),
      },
    ]),
  )

  if (!folders[RootCollectionFolderId]) {
    folders[RootCollectionFolderId] = createFolderNode(RootCollectionFolderId, "Root", null)
  }

  for (const folder of Object.values(folders)) {
    folder.childFolderIds = folder.childFolderIds.filter((childId) => folders[childId])
  }

  for (const [id, folder] of Object.entries(folders)) {
    if (id === RootCollectionFolderId) {
      folder.parentId = null
      continue
    }
    if (!folder.parentId || !folders[folder.parentId]) {
      folder.parentId = RootCollectionFolderId
    }
  }

  for (const folder of Object.values(folders)) {
    folder.childFolderIds = []
  }
  for (const [id, folder] of Object.entries(folders)) {
    if (id === RootCollectionFolderId) {
      continue
    }
    const parentId = folder.parentId ?? RootCollectionFolderId
    const parent = folders[parentId]
    if (parent && !parent.childFolderIds.includes(id)) {
      parent.childFolderIds.push(id)
    }
  }

  const requests: Record<string, RequestState> = Object.fromEntries(
    Object.entries(collection.requests).map(([id, request]) => [id, { ...request }]),
  )

  for (const folder of Object.values(folders)) {
    folder.requestIds = []
  }

  let fallbackOrder = 0
  for (const request of Object.values(requests)) {
    const folderId = request.folderId && folders[request.folderId] ? request.folderId : RootCollectionFolderId
    request.folderId = folderId
    if (request.order == null) {
      fallbackOrder += 1
      request.order = fallbackOrder
    }
    folders[folderId].requestIds.push(request.id)
  }

  for (const folder of Object.values(folders)) {
    folder.requestIds.sort((a, b) => {
      const ra = requests[a]
      const rb = requests[b]
      const oa = ra?.order ?? 0
      const ob = rb?.order ?? 0
      if (oa === ob) {
        return a.localeCompare(b)
      }
      return oa - ob
    })
  }

  const siblingGroups: Record<string, CollectionFolderNode[]> = {}
  for (const folder of Object.values(folders)) {
    const parentKey = folder.parentId ?? RootCollectionFolderId
    const bucket = siblingGroups[parentKey]
    if (bucket) {
      bucket.push(folder)
    } else {
      siblingGroups[parentKey] = [folder]
    }
  }

  for (const [parentId, children] of Object.entries(siblingGroups)) {
    if (!folders[parentId]) {
      continue
    }
    children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    folders[parentId].childFolderIds = children
      .filter((child) => child.id !== parentId)
      .map((child, index) => {
        child.order = index + 1
        return child.id
      })
  }

  const requestIndex = buildRequestIndex({ folders, requests })

  return {
    ...collection,
    folders,
    requests,
    requestIndex,
  }
}

const countCollectionRequests = (collection: CollectionCacheState): number => {
  return Object.keys(collection.requests).length
}

const rebuildRequestIndex = (collection: CollectionCacheState) => {
  collection.requestIndex = buildRequestIndex(collection)
}

const getFolderOrThrow = (collection: CollectionCacheState, folderId: string): CollectionFolderNode => {
  const folder = collection.folders[folderId]
  assert(folder, `Folder ${folderId} not found in collection ${collection.id}`)
  return folder
}

const updateSiblingOrder = (collection: CollectionCacheState, parentId: string | null) => {
  const actualParentId = parentId ?? RootCollectionFolderId
  const parent = getFolderOrThrow(collection, actualParentId)
  parent.childFolderIds = parent.childFolderIds.filter((id) => collection.folders[id])
  parent.childFolderIds.forEach((childId, index) => {
    const child = collection.folders[childId]
    if (child) {
      child.parentId = actualParentId
      child.order = index + 1
    }
  })
}

const insertChildFolder = (
  collection: CollectionCacheState,
  parentId: string | null,
  childId: string,
  position?: number,
) => {
  const actualParentId = parentId ?? RootCollectionFolderId
  const parent = getFolderOrThrow(collection, actualParentId)
  parent.childFolderIds = parent.childFolderIds.filter((id) => id !== childId)
  if (position == null || position < 0 || position > parent.childFolderIds.length) {
    position = parent.childFolderIds.length
  }
  parent.childFolderIds.splice(position, 0, childId)
  updateSiblingOrder(collection, actualParentId)
}

const removeChildFolder = (collection: CollectionCacheState, parentId: string | null, childId: string) => {
  const actualParentId = parentId ?? RootCollectionFolderId
  const parent = getFolderOrThrow(collection, actualParentId)
  parent.childFolderIds = parent.childFolderIds.filter((id) => id !== childId)
  updateSiblingOrder(collection, actualParentId)
}

const findRequestInCollection = (
  collection: CollectionCacheState,
  requestId: string,
): { folder: CollectionFolderNode; request: RequestState } => {
  const request = collection.requests[requestId]
  assert(request, `Request ${requestId} not found in collection ${collection.id}`)
  const location = collection.requestIndex[requestId]
  const folderId = location?.folderId ?? request.folderId ?? RootCollectionFolderId
  const folder = getFolderOrThrow(collection, folderId)
  return { folder, request }
}

const insertRequestIntoFolder = (
  collection: CollectionCacheState,
  folderId: string,
  request: RequestState,
  position?: number,
) => {
  const folder = getFolderOrThrow(collection, folderId)
  request.folderId = folderId
  collection.requests[request.id] = request
  if (position == null || position < 0 || position > folder.requestIds.length) {
    position = folder.requestIds.length
  }
  folder.requestIds = folder.requestIds.filter((id) => id !== request.id)
  folder.requestIds.splice(position, 0, request.id)
  folder.requestIds.forEach((id, index) => {
    const req = collection.requests[id]
    if (req) {
      req.order = index + 1
      req.folderId = folderId
    }
  })
  buildRequestIndexEntry(collection, request.id)
  validateRequestIndex(collection)
}

const removeRequestFromFolder = (
  collection: CollectionCacheState,
  requestId: string,
): { folder: CollectionFolderNode; request: RequestState } => {
  const { folder, request } = findRequestInCollection(collection, requestId)
  folder.requestIds = folder.requestIds.filter((id) => id !== requestId)
  removeRequestIndexEntry(collection, requestId)
  return { folder, request }
}

// sanitizeCollection - Create a persisted/export-friendly version of a collection by
// removing runtime-only secrets and applying other future sanitization rules (e.g.,
// trimming volatile fields, normalizing defaults, etc.).
export const sanitizeCollection = (collection: CollectionCacheState): CollectionState => {
  const sanitizeRequest = (request: RequestState): RequestState => {
    const sanitized: RequestState = {
      ...request,
      authentication: redactAuth(request.authentication) ?? request.authentication,
    }
    if (request.patch?.authentication) {
      sanitized.patch = {
        ...request.patch,
        authentication: redactAuth(
          request.patch.authentication as unknown as AuthConfig,
        ) as unknown as RequestState["authentication"],
      }
    }
    return sanitized
  }

  const { requestIndex: _requestIndex, ...rest } = collection

  const sanitized: CollectionState = {
    ...rest,
    authentication: redactAuth(collection.authentication) ?? collection.authentication,
    requests: Object.fromEntries(
      Object.entries(collection.requests ?? {}).map(([id, request]) => [id, sanitizeRequest(request)]),
    ),
    folders: Object.fromEntries(
      Object.entries(collection.folders ?? {}).map(([id, folder]) => [
        id,
        {
          ...folder,
          childFolderIds: folder.childFolderIds.slice(),
          requestIds: folder.requestIds.slice(),
        },
      ]),
    ),
  }
  return sanitized
}

const CollectionIndexStorage = createStorage<CollectionsIndexState["index"]>({
  version: 2,
  schema: zCollectionsIndexState.shape.index,
  migrate: async (context: MigrateContext) => {
    const content = (context.content as Partial<CollectionsIndexState["index"]>) ?? []

    // v2: introduce optional `order` field; preserve existing order, keep scratch first
    if (context.version < 2) {
      const entries: CollectionsIndexEntryState[] = Array.isArray(content)
        ? (content.slice() as CollectionsIndexEntryState[])
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
      return entries as CollectionsIndexState["index"]
    }

    return content as CollectionsIndexState["index"]
  },
})
const CollectionIndexFileName = () => "collections/.index.json"

const CollectionStorage = createStorage<CollectionState>({
  version: 1,
  schema: zCollectionState,
  migrate: async (context: MigrateContext) => {
    const content = context.content as Partial<CollectionState>
    // Add migration logic here
    //
    // Example:
    // if (context.version < 2) {
    //   // Migrate from version 1 to 2
    // }
    // if (context.version < 3) {
    //   // Migrate from version 2 to 3
    // }

    return content as CollectionState
  },
})

const CollectionFileName = (id: string) => `collections/${id}.json`

export const ScratchCollectionId = "scratch"
export const isScratchCollection = (collection: CollectionState | string) =>
  (typeof collection === "string" ? collection : collection.id) === ScratchCollectionId

export const createCollectionsSlice: StateCreator<
  ApplicationState,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CollectionsStateSlice
> = (set, get, storeApi) => {
  // Hookup load/save
  const storageProvider: StorageProvider<CollectionsState> = (() => {
    const timestamps: Record<string, string> = {}

    // Helpers now provided at module scope; no closure exposure required

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

  const touch = (collection: CollectionState): CollectionState => {
    collection.updated = new Date().toISOString()
    return collection
  }

  const setAndSync = (recipe: (draft: ApplicationState) => void) => {
    // 1. Generate the next state and patches in a single, efficient operation.
    const [nextState, _patches] = produceWithPatches(get(), recipe)

    // 2. Pass the fully resolved `nextState` object directly to `set`.
    // The Immer middleware is smart enough to see it's not a function (recipe)
    // and will bypass its own `produce` call, preventing redundant work.
    set(nextState)
    // Single-window: no cross-window broadcasting required.
  }

  function internalAddCollection(
    collection: CollectionState | CollectionCacheState,
    setter: (recipe: (draft: ApplicationState) => void) => void = set,
  ): CollectionCacheState {
    const normalized = (collection as CollectionCacheState).requestIndex
      ? (collection as CollectionCacheState)
      : normalizeCollection(collection as CollectionState)

    setter((app) => {
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
    return normalized
  }

  async function loadScratchCollection() {
    let collection: CollectionState | null = null
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

    return internalAddCollection(collection, set)
  }

  function existsInIndex(id: string): boolean {
    return id === ScratchCollectionId || get().collectionsState.index.some((m) => m.id === id)
  }

  function createRequest(collectionId: string, request: Partial<RequestState>) {
    return zParse(
      zRequestState,
      merge(
        {
          name: "Untitled Request",
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
          patch: {},
          updated: 0,
        },
        {
          ...request,
          id: generateUniqueId(),
          collectionId,
          // Assign order later when inserting into collection to ensure monotonic increment
        },
      ),
    )
  }

  function createEnvironment(environment: Partial<Environment>) {
    return zParse(
      zEnvironment,
      merge(
        {
          id: generateUniqueId(),
          name: "Untitled Environment",
          description: "",
          variables: {},
        },
        environment,
      ),
    )
  }

  ///
  /// CollectionsStateApi
  ///
  const collectionsApi: CollectionsStateApi = {
    getCollectionsIndex(): CollectionsIndexEntryState[] {
      return get().collectionsState.index
    },

    async setCollectionsIndex(collectionsIndex: CollectionsIndexEntryState[]) {
      set((app) => {
        app.collectionsState.index = collectionsIndex
      })

      void CollectionIndexStorage.save(CollectionIndexFileName(), get().collectionsState.index)
    },

    async reorderCollections(orderIds: string[]) {
      set((app) => {
        const current = app.collectionsState.index.slice()
        const reord = orderIds
          .map((id) => current.find((e) => e.id === id))
          .filter((e): e is CollectionsIndexEntryState => !!e)
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

      void CollectionIndexStorage.save(CollectionIndexFileName(), get().collectionsState.index)
    },

    //
    // CollectionsApi
    //

    async saveCollection(collection: CollectionCacheState | string) {
      if (typeof collection === "string") {
        collection = await collectionsApi.getCollection(collection)
      }

      assert(existsInIndex(collection.id), `saveCollection called with an unknown collection.id: ${collection.id}`)

      // Redact runtime-only secrets before persisting
      return CollectionStorage.save(CollectionFileName(collection.id), sanitizeCollection(collection))
    },

    async getCollection(id: string) {
      assert(existsInIndex(id), `getCollection called with an unknown collection.id: ${id}`)

      const cached = get().collectionsState.cache[id]
      if (cached) {
        return cached
      }

      if (ScratchCollectionId === id) {
        // Special logic for loading the scratch collection
        return loadScratchCollection()
      }

      const collection = nonNull(
        await CollectionStorage.load(CollectionFileName(id)),
        `Collection file ${CollectionFileName(id)} could not be loaded`,
      )

      return internalAddCollection(collection)
    },

    ///
    async addCollection(name: string, description?: string) {
      const now = new Date().toISOString()
      const newCollection: CollectionState = {
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

      return internalAddCollection(newCollection)
    },

    exportCollection: async (collectionId: string): Promise<ExportedCollection> => {
      const collection = await collectionsApi.getCollection(collectionId)

      // Redact runtime-only secrets before exporting
      const sanitized = sanitizeCollection(collection)
      return {
        format: "native",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        collection: sanitized,
      }
    },

    importCollection: async (exported: ExportedCollection, overrideName?: string): Promise<CollectionState> => {
      const { name, environments, requests, encryption, folders: exportedFolders, ...rest } = exported.collection

      const collectionId = generateUniqueId()

      const requestIdMap = new Map<string, string>()
      const requestEntries: Array<[string, RequestState]> = []

      for (const [originalRequestId, request] of Object.entries(requests ?? {})) {
        const created = createRequest(collectionId, {
          ...request,
          folderId: (request as { folderId?: string }).folderId,
        })
        requestIdMap.set(originalRequestId, created.id)
        requestEntries.push([created.id, created])
      }

      const clonedFolders: Record<string, CollectionFolderNode> = Object.fromEntries(
        Object.entries(exportedFolders ?? {}).map(([id, folder]) => [
          id,
          {
            ...folder,
            childFolderIds: folder.childFolderIds?.slice() ?? [],
            requestIds: folder.requestIds?.slice() ?? [],
          },
        ]),
      )

      if (!clonedFolders[RootCollectionFolderId]) {
        clonedFolders[RootCollectionFolderId] = createFolderNode(RootCollectionFolderId, "Root", null)
      }

      // Ensure child folder references only point at folders present in the import payload
      for (const folder of Object.values(clonedFolders)) {
        folder.childFolderIds = folder.childFolderIds.filter((childId) => clonedFolders[childId])
      }

      const folderRequestOrder = new Map<string, string[]>()
      for (const [folderId, folder] of Object.entries(exportedFolders ?? {})) {
        folderRequestOrder.set(folderId, folder.requestIds?.slice() ?? [])
      }

      const newCollection = merge(rest, {
        id: collectionId,
        name: overrideName ?? name ?? "Untitled Collection",
        updated: new Date().toISOString(),
        environments: Object.fromEntries(
          Object.values(environments ?? {})
            .map((environment) => createEnvironment(environment))
            .map((environment) => [environment.id, environment]),
        ),
        requests: Object.fromEntries(requestEntries),
        folders: clonedFolders,
        encryption: {
          algorithm: "aes-gcm",
          key: encryption?.key,
        },
      }) as CollectionState

      if (newCollection.authentication == null) {
        newCollection.authentication = { type: "none" } as AuthConfig
      }

      // Apply folder request ordering based on the exported structure and fall back to appending
      for (const [folderId, folder] of Object.entries(newCollection.folders)) {
        const originalOrder = folderRequestOrder.get(folderId) ?? []
        const mappedRequestIds = originalOrder
          .map((oldId) => requestIdMap.get(oldId))
          .filter((id): id is string => Boolean(id))
        folder.requestIds = mappedRequestIds
      }

      // Reconcile each request with a valid folder and ensure folder.requestIds contains it once
      for (const request of Object.values(newCollection.requests)) {
        let targetFolderId = request.folderId
        if (!targetFolderId || !newCollection.folders[targetFolderId]) {
          targetFolderId = RootCollectionFolderId
          request.folderId = targetFolderId
        }

        const folder = newCollection.folders[targetFolderId]
        if (!folder.requestIds.includes(request.id)) {
          folder.requestIds.push(request.id)
        }
      }

      // Normalize request order values within each folder
      for (const folder of Object.values(newCollection.folders)) {
        folder.requestIds = folder.requestIds
          .map((id) => (newCollection.requests[id] ? id : undefined))
          .filter((id): id is string => Boolean(id))

        folder.requestIds.forEach((requestId, index) => {
          const req = newCollection.requests[requestId]
          if (req) {
            req.order = index + 1
            req.folderId = folder.id
          }
        })
      }

      // Coerce meaningless collection-level inherit to none on import
      if ((newCollection.authentication as { type?: string })?.type === "inherit") {
        newCollection.authentication = { type: "none" } as import("@/types").AuthConfig
      }

      // One final pase to verify
      return internalAddCollection(zParse(zCollectionState, newCollection), setAndSync)
    },

    mergeCollection: async (collectionId: string, exported: ExportedCollection) => {
      assert(existsInIndex(collectionId), `mergeCollection called with an unknown collection.id: ${collectionId}`)

      await collectionsApi.getCollection(collectionId)

      const summary = {
        addedRequests: 0,
        updatedRequests: 0,
        addedEnvironments: 0,
        updatedEnvironments: 0,
      }

      const exportedCollection = exported.collection ?? {}
      const exportedRequests = exportedCollection.requests ?? {}
      const exportedEnvironments = exportedCollection.environments ?? {}
      const exportedFolders = exportedCollection.folders ?? {}

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `mergeCollection called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const signatureToId = new Map<string, string>()
        for (const request of Object.values(collection.requests)) {
          signatureToId.set(buildRequestSignature(request.method, request.url), request.id)
        }

        const ensureFolderExists = (folderId: string | null | undefined): string => {
          if (!folderId || folderId === RootCollectionFolderId) {
            return RootCollectionFolderId
          }
          if (collection.folders[folderId]) {
            return folderId
          }

          const exportedFolder = exportedFolders[folderId]
          const parentId = exportedFolder?.parentId ?? RootCollectionFolderId
          const resolvedParentId = ensureFolderExists(parentId)

          const created = createFolderNode(
            folderId,
            exportedFolder?.name ?? "Imported Folder",
            resolvedParentId,
            exportedFolder?.order ?? collection.folders[resolvedParentId]?.childFolderIds.length ?? 0,
          )
          collection.folders[folderId] = created
          insertChildFolder(collection, resolvedParentId, folderId, exportedFolder?.order)
          return folderId
        }

        for (const [envId, env] of Object.entries(exportedEnvironments)) {
          const parsed = zParse(
            zEnvironment,
            merge(
              {
                id: envId,
                variables: {},
              },
              env,
            ),
          )

          if (!collection.environments) {
            collection.environments = {}
          }

          if (collection.environments[envId]) {
            collection.environments[envId] = {
              ...collection.environments[envId],
              ...parsed,
              id: envId,
            }
            summary.updatedEnvironments += 1
          } else {
            collection.environments[envId] = parsed
            summary.addedEnvironments += 1
          }
        }

        for (const [requestId, request] of Object.entries(exportedRequests)) {
          const parsed = zParse(
            zRequestState,
            merge(
              {
                id: requestId,
                collectionId,
                patch: {},
              },
              request,
            ),
          )

          const signature = buildRequestSignature(parsed.method, parsed.url)
          let targetId = requestId
          let existingRequest = collection.requests[targetId]

          if (!existingRequest) {
            const matchedId = signatureToId.get(signature)
            if (matchedId) {
              targetId = matchedId
              existingRequest = collection.requests[matchedId]
            }
          }

          if (existingRequest) {
            const oldSignature = buildRequestSignature(existingRequest.method, existingRequest.url)
            signatureToId.delete(oldSignature)

            const folderId =
              existingRequest.folderId && collection.folders[existingRequest.folderId]
                ? existingRequest.folderId
                : RootCollectionFolderId

            collection.requests[targetId] = {
              ...existingRequest,
              ...parsed,
              id: targetId,
              collectionId,
              folderId,
              order: existingRequest.order,
              patch: existingRequest.patch ?? {},
            }
            buildRequestIndexEntry(collection, targetId)
            signatureToId.set(buildRequestSignature(parsed.method, parsed.url), targetId)
            summary.updatedRequests += 1
          } else {
            const resolvedFolderId = ensureFolderExists(parsed.folderId)
            const newRequest: RequestState = {
              ...parsed,
              id: targetId,
              collectionId,
              folderId: resolvedFolderId,
              patch: parsed.patch ?? {},
            }
            insertRequestIntoFolder(collection, resolvedFolderId, newRequest)
            signatureToId.set(signature, targetId)
            summary.addedRequests += 1
          }
        }

        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `mergeCollection called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
        index.updated = collection.updated
      })

      return summary
    },

    ///
    async updateCollection(collectionId: string, update: Partial<CollectionState>) {
      // Ensure that update cannot change collectionId
      assert(
        update.id === undefined || update.id === collectionId,
        `updateCollection called with mismatched id:${collectionId} !== update.id:${update.id}`,
      )

      // Ensure the collection is loaded into the cache
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        // biome-ignore lint/style/noNonNullAssertion: Safe via getCollection
        merge(touch(app.collectionsState.cache[collectionId]!), update)

        if (update.name) {
          const index = nonNull(
            app.collectionsState.index.find((e) => e.id === collectionId),
            `updateCollection called with non-indexed collection.id: ${collectionId}`,
          )
          index.name = update.name
          index.updated = new Date().toISOString()
        }
      })

      // biome-ignore lint/style/noNonNullAssertion: Known safe
      return get().collectionsState.cache[collectionId]!
    },

    async clearScratchCollection() {
      const scratch = await collectionsApi.getCollection(ScratchCollectionId)
      const requestIds = Object.keys(scratch.requests)

      if (requestIds.length === 0) {
        return
      }

      const { requestTabsApi } = get()

      // Close all open tabs for requests in the scratch collection
      const openTabs = Object.values(get().requestTabsState.openTabs)
      for (const tab of openTabs) {
        if (tab.collectionId === ScratchCollectionId) {
          // Do not wait for the tab to be removed
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

    ///
    async removeCollection(id: string) {
      assert(existsInIndex(id), `updateCollection called with an unknown collection.id: ${id}`)

      if (ScratchCollectionId === id) {
        throw new Error("Cannot remove the unsaved collection")
      }

      set((app) => {
        // An unloaded collection can be removed, so we can't assume it exists in the cache
        delete app.collectionsState.cache[id]
        app.collectionsState.index = app.collectionsState.index.filter((e) => e.id !== id)
      })

      invalidateCollectionPromise(id)

      // We need to manually delete the collection file since the save logic will only pick up the index change
      // Fire & Forget
      void CollectionStorage.delete(CollectionFileName(id))
    },

    ///
    async createEnvironment(collectionId: string, name: string, description?: string) {
      assert(existsInIndex(collectionId), `updateCollection called with an unknown collection.id: ${collectionId}`)

      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `createEnvironment called with an unknown collection.id: ${collectionId}`,
      )

      const newEnvironment = createEnvironment({ name, description })

      setAndSync((app) => {
        // biome-ignore lint/style/noNonNullAssertion: Safe due to getCollection() check
        touch(app.collectionsState.cache[collection.id]!).environments![newEnvironment.id] = newEnvironment
      })

      return newEnvironment
    },

    ///
    async updateEnvironment(collectionId: string, id: string, update: Partial<Environment>) {
      assert(existsInIndex(collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === id,
        `updateEnvironment expected update.id to be absent or equal to id:${id}. Found ${update.id}`,
      )

      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `updateEnvironment called with an unknown collection.id: ${collectionId}`,
      )

      assert(
        collection.environments?.[id],
        `updateEnvironment called with an unknown environment.id:${id} on collection ${collectionId}:${collection.name}`,
      )

      setAndSync((app) => {
        // biome-ignore lint/style/noNonNullAssertion: Safe via getCollection()
        merge(touch(app.collectionsState.cache[collection.id]!).environments[id]!, update)
      })
    },

    ///
    async deleteEnvironment(collectionId: string, id: string) {
      assert(existsInIndex(collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)
      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `deleteEnvironment called with an unknown collection.id: ${collectionId}`,
      )

      setAndSync((app) => {
        // biome-ignore lint/style/noNonNullAssertion: Safe via getCollection()
        delete touch(app.collectionsState.cache[collection.id]!).environments[id]
      })
    },

    ///
    async setActiveEnvironment(collectionId: string, environmentId: string | undefined) {
      assert(existsInIndex(collectionId), `setActiveEnvironment called with an unknown collection.id: ${collectionId}`)
      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `setActiveEnvironment called with an unknown collection.id: ${collectionId}`,
      )

      setAndSync((app) => {
        // biome-ignore lint/style/noNonNullAssertion: Safe via getCollection()
        touch(app.collectionsState.cache[collection.id]!).activeEnvironmentId = environmentId
      })
    },

    ///
    async addEnvironmentVariable(collectionId: string, environmentId: string, variable: Partial<EnvironmentVariable>) {
      assert(
        existsInIndex(collectionId),
        `addEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `addEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )

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

      setAndSync((app) => {
        // biome-ignore lint/style/noNonNullAssertion: Safe via getCollection() and assert
        touch(app.collectionsState.cache[collectionId]!).environments[environmentId]!.variables[newVariable.id] =
          newVariable
      })
    },

    ///
    async updateEnvironmentVariable(
      collectionId: string,
      environmentId: string,
      variableId: string,
      update: Partial<EnvironmentVariable>,
    ) {
      assert(
        existsInIndex(collectionId),
        `updateEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `updateEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )

      assert(
        collection.environments?.[environmentId],
        `updateEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )

      assert(
        collection.environments[environmentId].variables?.[variableId],
        `updateEnvironmentVariable called with an unknown collection:${collectionId} environment:${environmentId} variable.id:${variableId}`,
      )

      setAndSync((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment update`)
        const collection = touch(draftCollection)
        const environment = collection.environments?.[environmentId]
        assert(environment, `Environment ${environmentId} missing from collection ${collectionId} during update`)
        const variable = environment.variables?.[variableId]
        assert(
          variable,
          `Variable ${variableId} missing from collection ${collectionId} environment ${environmentId} during update`,
        )
        merge(variable, update)
      })
    },

    ///
    async deleteEnvironmentVariable(collectionId: string, environmentId: string, variableId: string) {
      assert(
        existsInIndex(collectionId),
        `deleteEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )
      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `updateEnvironmentVariable called with an unknown collection.id: ${collectionId}`,
      )

      assert(
        collection.environments?.[environmentId],
        `updateEnvironmentVariable called with an unknown environment.id: ${environmentId}`,
      )

      assert(
        collection.environments[environmentId].variables?.[variableId],
        `updateEnvironmentVariable called with an unknown collection:${collectionId} environment:${environmentId} variable.id:${variableId}`,
      )

      setAndSync((app) => {
        const draftCollection = app.collectionsState.cache[collectionId]
        assert(draftCollection, `Collection ${collectionId} missing from cache during environment delete`)
        const collection = touch(draftCollection)
        const environment = collection.environments?.[environmentId]
        assert(environment, `Environment ${environmentId} missing from collection ${collectionId} during delete`)
        if (environment.variables) {
          delete environment.variables[variableId]
        }
      })
    },

    ///
    async getRequest(collectionId: string, requestId: string) {
      assert(existsInIndex(collectionId), `getRequest called with an unknown collection.id: ${collectionId}`)

      const collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `getRequest called with an unknown collection.id: ${collectionId}`,
      )

      return findRequestInCollection(collection, requestId).request
    },

    ///
    async createRequest(collectionId: string, request: Some<RequestState, "name">) {
      assert(request.id === undefined, `createRequest expected request.id to be absent. Found ${request.id}`)
      assert(
        request.collectionId === undefined,
        `createRequest expected request.collectionId to be absent. Found ${request.collectionId}`,
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

      // Ensure the collection is loaded into the cache as it's possible to create a request before loading the collection
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `createRequest called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const targetFolderId = newRequest.folderId ?? RootCollectionFolderId
        insertRequestIntoFolder(collection, targetFolderId, newRequest)

        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === collectionId),
          `createRequest called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })

      // biome-ignore lint/style/noNonNullAssertion: Known safe
      return findRequestInCollection(get().collectionsState.cache[collectionId]!, newRequest.id).request
    },

    ///
    async deleteRequest(collectionId: string, requestId: string) {
      assert(existsInIndex(collectionId), `createRequest called with an unknown collection.id: ${collectionId}`)

      set((app) => {
        // It should not be possible to delete a request before its collection is loaded
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `deleteRequest called with unloaded collection.id: ${collectionId}`,
          ),
        )

        removeRequestFromFolder(collection, requestId)
        delete collection.requests[requestId]
        validateRequestIndex(collection)
        const index = nonNull(
          app.collectionsState.index.find((m) => m.id === collectionId),
          `deleteRequest called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })
    },

    async reorderRequestsInFolder(collectionId: string, folderId: string, orderedIds: string[]) {
      const _collection = nonNull(
        await collectionsApi.getCollection(collectionId),
        `reorderRequestsInFolder called with unknown collectionId: ${collectionId}`,
      )

      set((app) => {
        const col = nonNull(app.collectionsState.cache[collectionId], `Collection missing during reorder`)
        touch(col)
        const folder = getFolderOrThrow(col, folderId)
        const seen = new Set(orderedIds)
        const remaining = folder.requestIds.filter((id) => !seen.has(id))
        folder.requestIds = [...orderedIds.filter((id) => seen.has(id)), ...remaining]
        folder.requestIds.forEach((id, index) => {
          const request = col.requests[id]
          if (request) {
            request.order = index + 1
            buildRequestIndexEntry(col, id)
          }
        })
        validateRequestIndex(col)
      })
    },

    async moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string, position?: number) {
      assert(existsInIndex(collectionId), `moveRequestToFolder called with unknown collectionId: ${collectionId}`)
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `moveRequestToFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        getFolderOrThrow(collection, targetFolderId)
        const { request } = removeRequestFromFolder(collection, requestId)
        insertRequestIntoFolder(collection, targetFolderId, request, position)
        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `moveRequestToFolder called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })
    },

    async createFolder(collectionId: string, parentId: string | null, name: string) {
      assert(name.trim().length > 0, "Folder name cannot be empty")
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support additional folders")
      await collectionsApi.getCollection(collectionId)

      let created: CollectionFolderNode | null = null
      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `createFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const actualParentId = parentId ?? RootCollectionFolderId
        getFolderOrThrow(collection, actualParentId)

        const folderId = generateUniqueId()
        const folderNode = createFolderNode(folderId, name.trim(), actualParentId)
        collection.folders[folderId] = folderNode
        insertChildFolder(collection, actualParentId, folderId)
        created = folderNode
      })

      return nonNull(created, "Folder creation failed")
    },

    async renameFolder(collectionId: string, folderId: string, name: string) {
      assert(name.trim().length > 0, "Folder name cannot be empty")
      assert(folderId !== RootCollectionFolderId, "Cannot rename root folder")
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `renameFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )
        if (collection.id === ScratchCollectionId) {
          throw new Error("Scratch collection does not support folder renames")
        }
        const folder = getFolderOrThrow(collection, folderId)
        folder.name = name.trim()
      })
    },

    async deleteFolder(collectionId: string, folderId: string) {
      assert(folderId !== RootCollectionFolderId, "Cannot delete root folder")
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support folder deletion")
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `deleteFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const target = getFolderOrThrow(collection, folderId)
        const toDelete = new Set<string>()
        const stack = [folderId]
        while (stack.length > 0) {
          const currentId = stack.pop()
          if (!currentId || toDelete.has(currentId)) {
            continue
          }
          toDelete.add(currentId)
          const currentFolder = collection.folders[currentId]
          if (!currentFolder) {
            continue
          }
          for (const childId of currentFolder.childFolderIds) {
            stack.push(childId)
          }
        }

        const parentId = target.parentId ?? RootCollectionFolderId
        removeChildFolder(collection, parentId, target.id)

        for (const id of toDelete) {
          const folder = collection.folders[id]
          if (!folder) {
            continue
          }
          for (const requestId of folder.requestIds) {
            removeRequestIndexEntry(collection, requestId)
            delete collection.requests[requestId]
          }
          delete collection.folders[id]
        }

        updateSiblingOrder(collection, parentId)
        validateRequestIndex(collection)

        const index = nonNull(
          app.collectionsState.index.find((entry) => entry.id === collectionId),
          `deleteFolder called with non-indexed collection.id: ${collectionId}`,
        )
        index.count = countCollectionRequests(collection)
      })
    },

    async moveFolder(collectionId: string, folderId: string, targetParentId: string | null, position?: number) {
      assert(folderId !== RootCollectionFolderId, "Cannot move root folder")
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support folder moves")
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `moveFolder called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const folder = getFolderOrThrow(collection, folderId)
        const currentParentId = folder.parentId ?? RootCollectionFolderId
        const destinationParentId = targetParentId ?? RootCollectionFolderId

        assert(folderId !== destinationParentId, "Cannot move folder into itself")

        const ancestry = buildAncestry(destinationParentId, collection.folders)
        assert(!ancestry.includes(folderId), "Cannot move folder into its descendant")

        removeChildFolder(collection, currentParentId, folderId)
        folder.parentId = destinationParentId
        insertChildFolder(collection, destinationParentId, folderId, position)
        updateRequestIndexForSubtree(collection, folderId)
        validateRequestIndex(collection)
      })
    },

    async reorderFolders(collectionId: string, parentId: string | null, orderedIds: string[]) {
      assert(collectionId !== ScratchCollectionId, "Scratch collection does not support folder reordering")
      await collectionsApi.getCollection(collectionId)

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `reorderFolders called with unloaded collection.id: ${collectionId}`,
          ),
        )

        const actualParentId = parentId ?? RootCollectionFolderId
        const parent = getFolderOrThrow(collection, actualParentId)
        const allowed = orderedIds.filter((id) => collection.folders[id])
        const seen = new Set(allowed)
        const remaining = parent.childFolderIds.filter((id) => !seen.has(id))
        parent.childFolderIds = [...allowed, ...remaining]
        updateSiblingOrder(collection, actualParentId)
      })
    },

    async duplicateRequest(collectionId: string, requestId: string) {
      const { id: _id, collectionId: _cid, ...sourceRequest } = await collectionsApi.getRequest(collectionId, requestId)
      const newName = `Copy of ${sourceRequest.name}`
      await collectionsApi.createRequest(collectionId, {
        ...sourceRequest,
        name: newName,
      })
    },

    ///
    async updateRequest(collectionId: string, requestId: string, update: Partial<RequestState>) {
      assert(existsInIndex(collectionId), `updateRequest called with an unknown collection.id: ${collectionId}`)
      assert(
        update.id === undefined || update.id === requestId,
        `updateRequest expected update.id to be absent or equal to requestId:${requestId}. Found ${update.id}`,
      )
      assert(
        update.collectionId === undefined || update.collectionId === collectionId,
        `updateRequest expected update.collectionId to be absent or equal to collectionId:${collectionId}. Found ${update.collectionId}`,
      )

      set((app) => {
        const collection = touch(
          nonNull(
            app.collectionsState.cache[collectionId],
            `updateRequest called with unloaded collection.id: ${collectionId}`,
          ),
        )

        let { request } = findRequestInCollection(collection, requestId)

        if (update.folderId && update.folderId !== request.folderId) {
          const { request: removed } = removeRequestFromFolder(collection, requestId)
          insertRequestIntoFolder(collection, update.folderId, removed)
          request = removed
        }

        merge(request, {
          ...update,
          updated: request.updated + 1,
        })
      })
    },

    ///
    async updateRequestPatch(collectionId: string, requestId: string, update: Patch<RequestState["patch"]>) {
      assert(
        isNotEmpty(update),
        "updateRequestPatch called with empty patch. Use discardRequestPatch to clear the patch",
      )

      set((app) => {
        const collection = nonNull(
          app.collectionsState.cache[collectionId],
          `updateRequestPatch called with an unknown collection.id: ${collectionId}`,
        )

        const { request } = findRequestInCollection(collection, requestId)

        // Initialize the patch if it doesn't exist
        let patch: RequestState["patch"] = request.patch
        if (!patch) {
          patch = {}
          request.patch = patch
        }

        for (const [updateKey, updateValue] of Object.entries(update)) {
          switch (updateKey) {
            case "pathParams":
            case "queryParams":
            case "headers": {
              const paramsPatch = ensureParamPatch(request, patch, updateKey)
              const baseRecord = request[updateKey] as
                | Record<string, RequestParamValueMap[typeof updateKey]>
                | undefined
              for (const [paramKey, paramValue] of Object.entries(updateValue as object)) {
                if (paramValue == null) {
                  delete paramsPatch[paramKey]
                } else {
                  const currentEntry = paramsPatch[paramKey] ?? baseRecord?.[paramKey]
                  paramsPatch[paramKey] = {
                    ...(currentEntry ?? {}),
                    ...(paramValue as object),
                    id: paramKey,
                  } as RequestParamValueMap[typeof updateKey]
                }
              }

              pruneParamPatchIfEqual(request, patch, updateKey)
              break
            }

            case "body": {
              const patchBody = ensureBodyPatch(request, patch)

              for (const [bodyKey, bodyValue] of Object.entries(updateValue as object)) {
                if (bodyKey === "formData") {
                  let formDataPatch = patchBody.formData as Record<string, FormField> | undefined
                  if (!formDataPatch) {
                    formDataPatch = {}
                    patchBody.formData = formDataPatch
                  }
                  const baseFormData = request.body?.formData ?? {}

                  for (const [fieldKey, fieldValue] of Object.entries(bodyValue as object)) {
                    if (fieldValue == null) {
                      delete formDataPatch[fieldKey]
                      continue
                    }
                    const baseField = baseFormData[fieldKey]
                    const currentField = formDataPatch[fieldKey]
                    formDataPatch[fieldKey] = zFormField.parse({
                      id: fieldKey,
                      ...(baseField as Partial<FormField> | undefined),
                      ...(currentField as Partial<FormField> | undefined),
                      ...(fieldValue as Partial<FormField>),
                    })
                  }
                } else {
                  ;(patchBody as Record<string, unknown>)[bodyKey] = bodyValue
                }
              }

              pruneBodyPatchIfEqual(request, patch)
              break
            }

            case "authentication":
            case "options": {
              const valuePatch = ensureObjectPatch(request, patch, updateKey)
              for (const [paramKey, paramValue] of Object.entries(updateValue as object)) {
                valuePatch[paramKey as keyof typeof valuePatch] = paramValue
              }
              pruneObjectPatchIfEqual(request, patch, updateKey)
              break
            }

            default: {
              // Primitive/flat fields (name, method, url, etc.)

              // biome-ignore lint/suspicious/noExplicitAny: OK
              if (updateValue !== (request as any)[updateKey]) {
                patch[updateKey] = updateValue
              } else {
                delete patch[updateKey]
              }
              break
            }
          }
        }

        if (!isNotEmpty(patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestPatchQueryParam(
      collectionId: string,
      requestId: string,
      id: string,
      update: Partial<RequestQueryParam> | null,
    ) {
      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestPatchQueryParam called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)

        request.patch ??= {}
        const queryParams = ensureParamPatch(request, request.patch, "queryParams")
        const baseQueryParams = request.queryParams ?? {}
        if (update === null) {
          delete queryParams[id]
        } else {
          const next = {
            ...(queryParams[id] ?? baseQueryParams[id] ?? {}),
            ...update,
            id,
          }
          queryParams[id] = zRequestQueryParam.parse(next)
        }

        pruneParamPatchIfEqual(request, request.patch, "queryParams")
        if (!isNotEmpty(request.patch)) {
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
    ) {
      set((app) => {
        const request = app.collectionsState.cache[collectionId]?.requests[requestId]
        assert(request, `updateRequestPatchPathParam called with unrecognized request: ${collectionId}:${requestId}`)

        request.patch ??= {}
        const pathParams = ensureParamPatch(request, request.patch, "pathParams")
        const basePathParams = request.pathParams ?? {}
        if (update === null) {
          delete pathParams[id]
        } else {
          const next = {
            ...(pathParams[id] ?? basePathParams[id] ?? {}),
            ...update,
            id,
          }
          pathParams[id] = zRequestPathParam.parse(next)
        }

        pruneParamPatchIfEqual(request, request.patch, "pathParams")
        if (!isNotEmpty(request.patch)) {
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
    ) {
      set((app) => {
        const request = app.collectionsState.cache[collectionId]?.requests[requestId]
        assert(request, `updateRequestPatchHeader called with unrecognized request: ${collectionId}:${requestId}`)

        let patch: RequestState["patch"] = request.patch
        if (!patch) {
          patch = {}
          request.patch = patch
        }
        const headers = ensureParamPatch(request, patch, "headers")
        const baseHeaders = request.headers ?? {}
        if (update === null) {
          delete headers[id]
        } else {
          const next = {
            ...(headers[id] ?? baseHeaders[id] ?? {}),
            ...update,
            id,
          }
          headers[id] = zRequestHeader.parse(next)
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
    ) {
      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestPatchCookieParam called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)

        request.patch ??= {}
        const cookieParams = ensureParamPatch(request, request.patch, "cookieParams")
        const baseCookieParams = request.cookieParams ?? {}
        if (update === null) {
          delete cookieParams[id]
        } else {
          const next = {
            ...(cookieParams[id] ?? baseCookieParams[id] ?? {}),
            ...update,
            id,
          }
          cookieParams[id] = zRequestCookieParam.parse(next)
        }

        pruneParamPatchIfEqual(request, request.patch, "cookieParams")
        if (!isNotEmpty(request.patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestPatchFormData(collectionId: string, requestId: string, id: string, update: Partial<FormField> | null) {
      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `updateRequestPatchFormData called with unknown collectionId:${collectionId}`)
        const { request } = findRequestInCollection(collection, requestId)

        let patch: RequestState["patch"] = request.patch
        if (!patch) {
          patch = {}
          request.patch = patch
        }
        const bodyPatch = ensureBodyPatch(request, patch)
        let formData = bodyPatch.formData as Record<string, FormField> | undefined
        if (!formData) {
          formData = {}
          bodyPatch.formData = formData
        }
        const baseFormData = collection.requests[requestId]?.body?.formData ?? {}
        if (update === null) {
          delete formData[id]
        } else {
          const baseField = baseFormData[id]
          const currentField = formData[id]
          formData[id] = zFormField.parse({
            id,
            ...(baseField as Partial<FormField> | undefined),
            ...(currentField as Partial<FormField> | undefined),
            ...update,
          })
        }

        pruneBodyPatchIfEqual(request, patch)
        if (!isNotEmpty(patch)) {
          request.patch = {}
        }

        request.updated += 1
      })
    },

    updateRequestPatchBody(collectionId: string, requestId: string, update: Partial<RequestBodyData>) {
      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        if (!collection) {
          return
        }
        const { request } = findRequestInCollection(collection, requestId)
        if (request) {
          const patch = request.patch
          if (patch?.body) {
            Object.assign(patch.body, update)
          }

          request.updated += 1
        }
      })
    },

    ///
    async discardRequestPatch(collectionId: string, requestId: string) {
      set((app) => {
        const collection = app.collectionsState.cache[collectionId]
        assert(collection, `discardRequestPatch called with unknown collectionId:${collectionId}`)

        const { request } = findRequestInCollection(collection, requestId)
        request.patch = {}
        request.updated += 1
      })
    },

    ///
    async commitRequestPatch(collectionId: string, requestId: string) {
      const collection = get().collectionsState.cache[collectionId]
      assert(collection, `commitRequestPatch called with unknown collectionId:${collectionId}`)

      set((app) => {
        const cachedCollection = app.collectionsState.cache[collectionId]
        assert(cachedCollection, `commitRequestPatch called with unknown collectionId:${collectionId}`)
        const draftCollection = touch(cachedCollection)
        const { request } = findRequestInCollection(draftCollection, requestId)
        if (isNotEmpty(request?.patch)) {
          // Capture auth before merge to detect type changes
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
          // If patch changed auth type, remove stale data from the previous type
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
  }

  return {
    collectionsState: {
      index: [],
      cache: {},
    },
    collectionsApi,
  }
}

/**
 * Moves a request from the scratch collection to a persistent one. WARNING: This method can only be called within
 * a set operation. It's used by the RequestsTabSlice to ensure a single atomic move WRT application state.
 *
 * @param slice CollectionsStateSlice to target
 * @param update RequestState to update. id and collectionId are required and should refer to a target collection
 */
export const saveScratchRequest = (
  slice: CollectionsStateSlice,
  update: Some<RequestState, "id" | "collectionId">,
): void => {
  const scratch = nonNull(slice.collectionsState.cache[ScratchCollectionId], `Unexpected error`)
  const target = nonNull(slice.collectionsState.cache[update.collectionId], `Unexpected error`)

  assert(!!scratch.requests[update.id], `saveScratchRequest called with unknown scratch request:${update.id}`)

  const { request: scratchRequest } = findRequestInCollection(scratch, update.id)
  const request = toMerged(scratchRequest, update)
  if (isNotEmpty(request.patch)) {
    merge(request, request.patch)
    request.patch = {}
  }

  removeRequestFromFolder(scratch, request.id)
  delete scratch.requests[request.id]
  nonNull(
    slice.collectionsState.index.find((m) => m.id === ScratchCollectionId),
    `saveScratchRequest called with non-indexed collection.id: ${ScratchCollectionId}`,
  ).count -= 1
  validateRequestIndex(scratch)

  insertRequestIntoFolder(target, request.folderId ?? RootCollectionFolderId, request)
  nonNull(
    slice.collectionsState.index.find((m) => m.id === update.collectionId),
    `saveScratchRequest called with non-indexed target collection.id: ${update.collectionId}`,
  ).count = countCollectionRequests(target)
  validateRequestIndex(target)
}

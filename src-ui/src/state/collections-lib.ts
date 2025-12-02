import { isEqual, merge } from "es-toolkit"

import { assert, generateUniqueId } from "@/lib/utils"
import { naturalSort } from "@/state/collections/sort-utils"
import { zParse } from "@/state/utils"
import {
  type Collection,
  type CollectionCache,
  type CollectionFolderNode,
  type CollectionRequestLocation,
  type Environment,
  type ExportedCollection,
  type FormField,
  type RequestCookieParam,
  type RequestHeader,
  type RequestPathParam,
  type RequestQueryParam,
  type RequestState,
  RootCollectionFolderId,
  zCollection,
  zFormField,
  zRequestCookieParam,
  zRequestHeader,
  zRequestPathParam,
  zRequestQueryParam,
} from "@/types"
import type { AuthConfig } from "@/types/request"
import { zRequestState } from "@/types/request"
import { zEnvironment } from "@/types/environments"

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

export const buildRequestSignature = (method: string | undefined, url: string | undefined): string => {
  const normalizedMethod = (method ?? "").trim().toUpperCase()
  const normalizedUrl = (url ?? "").trim()
  return `${normalizedMethod}::${normalizedUrl}`
}

export const createFolderNode = (
  id: string,
  name: string,
  parentId: string | null,
  order = 0,
): CollectionFolderNode => ({
  id,
  name,
  parentId,
  order,
  childFolderIds: [],
  requestIds: [],
})

export const buildAncestry = (folderId: string, folders: Record<string, CollectionFolderNode>): string[] => {
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

export const buildRequestIndexEntry = (collection: CollectionCache, requestId: string) => {
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

const updateRequestIndexForFolder = (collection: CollectionCache, folderId: string) => {
  const folder = collection.folders[folderId]
  if (!folder) {
    return
  }
  for (const requestId of folder.requestIds) {
    buildRequestIndexEntry(collection, requestId)
  }
}

export const updateRequestIndexForSubtree = (collection: CollectionCache, folderId: string) => {
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

export const removeRequestIndexEntry = (collection: CollectionCache, requestId: string) => {
  delete collection.requestIndex[requestId]
}

const shouldValidateRequestIndex = import.meta.env?.DEV === true

export const validateRequestIndex = (collection: CollectionCache) => {
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

export const ensureRequestPatch = (request: RequestState): RequestState["patch"] => {
  if (!request.patch) {
    request.patch = {}
  }
  return request.patch
}

export type RequestParamKey = "queryParams" | "pathParams" | "headers" | "cookieParams"

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

export const ensureParamPatch = <K extends RequestParamKey>(
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

export const pruneParamPatchIfEqual = <K extends RequestParamKey>(
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

export const ensureBodyPatch = (_request: RequestState, patch: RequestState["patch"]) => {
  if (!patch.body) {
    patch.body = {}
  }
  return patch.body
}

export const applyBodyPatchUpdates = (
  request: RequestState,
  patch: RequestState["patch"],
  updates: Partial<RequestBodyData>,
) => {
  const patchBody = ensureBodyPatch(request, patch)
  for (const [bodyKey, bodyValue] of Object.entries(updates) as [
    keyof RequestBodyData,
    RequestBodyData[keyof RequestBodyData],
  ][]) {
    if (bodyKey === "formData") {
      let formDataPatch = patchBody.formData as Record<string, FormField> | undefined
      if (!formDataPatch) {
        formDataPatch = {}
        patchBody.formData = formDataPatch
      }
      const baseFormData = request.body?.formData ?? {}

      for (const [fieldKey, fieldValue] of Object.entries(bodyValue as Record<string, FormField | null | undefined>)) {
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
      continue
    }

    ;(patchBody as Record<string, unknown>)[bodyKey] = bodyValue
  }

  pruneBodyPatchIfEqual(request, patch)
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

export const pruneBodyPatchIfEqual = (request: RequestState, patch: RequestState["patch"]) => {
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

export const ensureObjectPatch = <K extends "authentication" | "options">(
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

export const pruneObjectPatchIfEqual = <K extends "authentication" | "options">(
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

export const normalizeCollection = (collection: Collection): CollectionCache => {
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

  // Validate and fix request folder assignments
  // Track which requests have been assigned to maintain disk order
  const assignedRequests = new Set<string>()
  const requestsByFolder: Record<string, string[]> = {}

  // First pass: preserve existing folder.requestIds order from disk
  // Only keep requests that actually exist
  for (const folder of Object.values(folders)) {
    requestsByFolder[folder.id] = []
    for (const requestId of folder.requestIds ?? []) {
      if (requests[requestId]) {
        const request = requests[requestId]
        const folderId = request.folderId && folders[request.folderId] ? request.folderId : folder.id
        request.folderId = folderId
        if (folderId === folder.id) {
          requestsByFolder[folder.id].push(requestId)
          assignedRequests.add(requestId)
        }
      }
    }
  }

  // Second pass: fix any requests that reference non-existent folders
  // and add any requests that weren't in any folder's requestIds array
  for (const request of Object.values(requests)) {
    const folderId = request.folderId && folders[request.folderId] ? request.folderId : RootCollectionFolderId
    request.folderId = folderId

    if (!assignedRequests.has(request.id)) {
      if (!requestsByFolder[folderId]) {
        requestsByFolder[folderId] = []
      }
      requestsByFolder[folderId].push(request.id)
      assignedRequests.add(request.id)
    }
  }

  // Synchronize folder requestIds with validated requests
  // Preserve disk order - DO NOT SORT
  for (const folder of Object.values(folders)) {
    folder.requestIds = requestsByFolder[folder.id] ?? []
    // Update order field to match current position
    folder.requestIds.forEach((requestId, index) => {
      if (requests[requestId]) {
        requests[requestId].order = index + 1
      }
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

export const countCollectionRequests = (collection: CollectionCache): number => {
  return Object.keys(collection.requests).length
}

export const rebuildRequestIndex = (collection: CollectionCache) => {
  collection.requestIndex = buildRequestIndex(collection)
}

export const getFolderOrThrow = (collection: CollectionCache, folderId: string): CollectionFolderNode => {
  const folder = collection.folders[folderId]
  assert(folder, `Folder ${folderId} not found in collection ${collection.id}`)
  return folder
}

export const updateSiblingOrder = (collection: CollectionCache, parentId: string | null) => {
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

export const insertChildFolder = (
  collection: CollectionCache,
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

export const removeChildFolder = (collection: CollectionCache, parentId: string | null, childId: string) => {
  const actualParentId = parentId ?? RootCollectionFolderId
  const parent = getFolderOrThrow(collection, actualParentId)
  parent.childFolderIds = parent.childFolderIds.filter((id) => id !== childId)
  updateSiblingOrder(collection, actualParentId)
}

export const findRequestInCollection = (
  collection: CollectionCache,
  requestId: string,
): { folder: CollectionFolderNode; request: RequestState } => {
  const request = collection.requests[requestId]
  assert(request, `Request ${requestId} not found in collection ${collection.id}`)
  const location = collection.requestIndex[requestId]
  const folderId = location?.folderId ?? request.folderId ?? RootCollectionFolderId
  const folder = getFolderOrThrow(collection, folderId)
  return { folder, request }
}

export const insertRequestIntoFolder = (collection: CollectionCache, folderId: string, request: RequestState) => {
  const folder = getFolderOrThrow(collection, folderId)
  request.folderId = folderId
  collection.requests[request.id] = request

  // Remove request from folder if it's already there
  folder.requestIds = folder.requestIds.filter((id) => id !== request.id)

  // Always insert in natural alphabetical order (e.g., r1 < r2 < r10)
  const insertIndex = folder.requestIds.findIndex((id) => {
    const existingRequest = collection.requests[id]
    return existingRequest && naturalSort(request.name, existingRequest.name) < 0
  })
  const position = insertIndex === -1 ? folder.requestIds.length : insertIndex

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

export const removeRequestFromFolder = (
  collection: CollectionCache,
  requestId: string,
): { folder: CollectionFolderNode; request: RequestState } => {
  const { folder, request } = findRequestInCollection(collection, requestId)
  folder.requestIds = folder.requestIds.filter((id) => id !== requestId)
  removeRequestIndexEntry(collection, requestId)
  return { folder, request }
}

export const reorderFolderRequests = (collection: CollectionCache, folderId: string, orderedIds: string[]): void => {
  const folder = getFolderOrThrow(collection, folderId)
  folder.requestIds = orderedIds
  orderedIds.forEach((requestId, index) => {
    const request = collection.requests[requestId]
    if (request) {
      request.order = index + 1
    }
  })
}

export const moveRequestWithinCollection = (
  collection: CollectionCache,
  requestId: string,
  destinationFolderId: string,
) => {
  const destinationFolder = getFolderOrThrow(collection, destinationFolderId)
  const { request } = removeRequestFromFolder(collection, requestId)
  insertRequestIntoFolder(collection, destinationFolder.id, request)
}

export const moveFolderNode = (
  collection: CollectionCache,
  folderId: string,
  destinationParentId: string | null,
  position?: number,
) => {
  const folder = getFolderOrThrow(collection, folderId)
  const currentParentId = folder.parentId ?? RootCollectionFolderId
  const targetParentId = destinationParentId ?? RootCollectionFolderId
  const ancestry = buildAncestry(targetParentId, collection.folders)
  assert(!ancestry.includes(folderId), "Cannot move folder into its descendant")

  removeChildFolder(collection, currentParentId, folderId)
  folder.parentId = targetParentId
  insertChildFolder(collection, targetParentId, folderId, position)
  updateRequestIndexForSubtree(collection, folderId)
  validateRequestIndex(collection)
}

export const reorderChildFolders = (collection: CollectionCache, parentId: string | null, orderedIds: string[]) => {
  const actualParentId = parentId ?? RootCollectionFolderId
  const parent = getFolderOrThrow(collection, actualParentId)
  const allowed = orderedIds.filter((id) => collection.folders[id])
  const seen = new Set(allowed)
  const remaining = parent.childFolderIds.filter((id) => !seen.has(id))
  parent.childFolderIds = [...allowed, ...remaining]
  updateSiblingOrder(collection, actualParentId)
}

export const deleteFolderCascade = (
  collection: CollectionCache,
  folderId: string,
): { parentId: string; removedRequestIds: string[] } => {
  const target = getFolderOrThrow(collection, folderId)
  const parentId = target.parentId ?? RootCollectionFolderId
  const toDelete = new Set<string>()
  const stack = [folderId]
  while (stack.length > 0) {
    const currentId = stack.pop()
    if (!currentId || toDelete.has(currentId)) {
      continue
    }
    toDelete.add(currentId)
    const node = collection.folders[currentId]
    if (!node) {
      continue
    }
    stack.push(...node.childFolderIds)
  }

  removeChildFolder(collection, parentId, folderId)

  const removedRequestIds: string[] = []
  for (const id of toDelete) {
    const folder = collection.folders[id]
    if (!folder) {
      continue
    }
    for (const requestId of folder.requestIds) {
      removedRequestIds.push(requestId)
      removeRequestIndexEntry(collection, requestId)
      delete collection.requests[requestId]
    }
    delete collection.folders[id]
  }

  updateSiblingOrder(collection, parentId)
  validateRequestIndex(collection)
  return { parentId, removedRequestIds }
}

// sanitizeCollection - Create a persisted/export-friendly version of a collection by
// removing runtime-only secrets and applying other future sanitization rules (e.g.,
// trimming volatile fields, normalizing defaults, etc.).
export const sanitizeCollection = (collection: CollectionCache): Collection => {
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

  const sanitized: Collection = {
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

export const buildEnvironmentState = (environment?: Partial<Environment>): Environment => {
  return zParse(
    zEnvironment,
    merge(
      {
        id: generateUniqueId(),
        name: "Untitled Environment",
        description: "",
        variables: {},
      },
      environment ?? {},
    ),
  )
}

export const buildRequestState = (collectionId: string, request?: Partial<RequestState>): RequestState => {
  return zParse(
    zRequestState,
    merge(
      {
        id: request?.id ?? generateUniqueId(),
        collectionId,
        name: "Untitled Request",
        method: "GET",
        autoSave: false,
        url: "",
        pathParams: {},
        queryParams: {},
        headers: {},
        cookieParams: {},
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
      request ?? {},
    ),
  )
}

type FolderCreationPlan = {
  node: CollectionFolderNode
  parentId: string | null
  position?: number
}

type EnvironmentUpsertPlan = {
  id: string
  data: Environment
  isNew: boolean
}

type RequestAddPlan = {
  data: RequestState
  folderId: string
}

type RequestUpdatePlan = {
  id: string
  data: RequestState
}

export type MergeSummary = {
  addedRequests: number
  updatedRequests: number
  addedEnvironments: number
  updatedEnvironments: number
}

export type MergePlan = {
  foldersToCreate: FolderCreationPlan[]
  environments: EnvironmentUpsertPlan[]
  requestAdds: RequestAddPlan[]
  requestUpdates: RequestUpdatePlan[]
  summary: MergeSummary
}

export const normalizeImportedCollection = (exported: ExportedCollection, overrideName?: string): Collection => {
  const now = new Date().toISOString()
  const collectionId = generateUniqueId()
  const exportedCollection = exported.collection ?? {}
  const exportedFolders = exportedCollection.folders ?? {}
  const exportedRequests = exportedCollection.requests ?? {}
  const exportedEnvironments = exportedCollection.environments ?? {}

  const environments: Record<string, Environment> = {}
  for (const environment of Object.values(exportedEnvironments)) {
    const created = buildEnvironmentState(environment)
    environments[created.id] = created
  }

  const requests: Record<string, RequestState> = {}
  const requestIdMap = new Map<string, string>()

  for (const [originalId, request] of Object.entries(exportedRequests)) {
    const requestedFolderId = (request as { folderId?: string }).folderId
    const hasExportedFolder = requestedFolderId ? Boolean(exportedFolders[requestedFolderId]) : false
    const folderId = hasExportedFolder && requestedFolderId ? requestedFolderId : RootCollectionFolderId
    const created = buildRequestState(collectionId, {
      ...request,
      id: generateUniqueId(),
      folderId,
    } as Partial<RequestState>)
    requests[created.id] = created
    requestIdMap.set(originalId, created.id)
  }

  const folders: Record<string, CollectionFolderNode> = Object.fromEntries(
    Object.entries(exportedFolders).map(([id, folder]) => [
      id,
      {
        ...folder,
        childFolderIds: folder.childFolderIds?.slice() ?? [],
        requestIds: [],
      },
    ]),
  )

  if (!folders[RootCollectionFolderId]) {
    folders[RootCollectionFolderId] = createFolderNode(RootCollectionFolderId, "Root", null)
  }

  for (const folder of Object.values(folders)) {
    folder.childFolderIds = folder.childFolderIds.filter((childId) => folders[childId])
  }

  for (const request of Object.values(requests)) {
    let folderId = request.folderId
    if (!folderId || !folders[folderId]) {
      folderId = RootCollectionFolderId
      request.folderId = folderId
    }
    const folder = folders[folderId]
    if (!folder.requestIds.includes(request.id)) {
      folder.requestIds.push(request.id)
    }
  }

  for (const folder of Object.values(folders)) {
    folder.requestIds = folder.requestIds.filter((id) => requests[id])
    // Sort requests alphabetically by name (case-insensitive)
    folder.requestIds.sort((a, b) => {
      const ra = requests[a]
      const rb = requests[b]
      return (ra?.name ?? "").localeCompare(rb?.name ?? "", undefined, { sensitivity: "base" })
    })
    // Assign order field based on sorted position
    folder.requestIds.forEach((requestId, index) => {
      const request = requests[requestId]
      if (request) {
        request.order = index + 1
        request.folderId = folder.id
      }
    })
  }

  const parsed = zParse(zCollection, {
    ...exportedCollection,
    id: collectionId,
    name: overrideName ?? exportedCollection.name ?? "Untitled Collection",
    updated: now,
    environments,
    requests,
    folders,
    encryption: {
      algorithm: exportedCollection.encryption?.algorithm ?? "aes-gcm",
      key: exportedCollection.encryption?.key,
    },
    authentication: exportedCollection.authentication ?? { type: "none" },
  })

  if (parsed.authentication?.type === "inherit") {
    parsed.authentication = { type: "none" } as AuthConfig
  }

  return parsed
}

export const prepareMergePlan = (collection: CollectionCache, exported: ExportedCollection): MergePlan => {
  const exportedCollection = exported.collection ?? {}
  const exportedFolders = exportedCollection.folders ?? {}
  const exportedEnvironments = exportedCollection.environments ?? {}
  const exportedRequests = exportedCollection.requests ?? {}

  const plan: MergePlan = {
    foldersToCreate: [],
    environments: [],
    requestAdds: [],
    requestUpdates: [],
    summary: {
      addedRequests: 0,
      updatedRequests: 0,
      addedEnvironments: 0,
      updatedEnvironments: 0,
    },
  }

  const existingEnvironments = collection.environments ?? {}
  for (const [envId, environment] of Object.entries(exportedEnvironments)) {
    const parsed = zParse(
      zEnvironment,
      merge(
        {
          id: envId,
          variables: {},
        },
        environment,
      ),
    )
    const isNew = !existingEnvironments[envId]
    plan.environments.push({ id: envId, data: parsed, isNew })
    if (isNew) {
      plan.summary.addedEnvironments += 1
    } else {
      plan.summary.updatedEnvironments += 1
    }
  }

  const signatureToId = new Map<string, string>()
  for (const request of Object.values(collection.requests)) {
    signatureToId.set(buildRequestSignature(request.method, request.url), request.id)
  }

  const plannedFolders = new Set<string>()

  const ensureFolder = (folderId: string | null | undefined): string => {
    if (!folderId || folderId === RootCollectionFolderId) {
      return RootCollectionFolderId
    }
    if (collection.folders[folderId]) {
      return folderId
    }
    if (plannedFolders.has(folderId)) {
      return folderId
    }
    const exportedFolder = exportedFolders[folderId]
    const parentId = ensureFolder(exportedFolder?.parentId ?? RootCollectionFolderId)
    const node = createFolderNode(
      folderId,
      exportedFolder?.name ?? "Imported Folder",
      parentId === RootCollectionFolderId ? null : parentId,
      exportedFolder?.order ?? collection.folders[parentId]?.childFolderIds.length ?? 0,
    )
    plan.foldersToCreate.push({
      node,
      parentId,
      position: exportedFolder?.order,
    })
    plannedFolders.add(folderId)
    return folderId
  }

  for (const [requestId, request] of Object.entries(exportedRequests)) {
    const parsed = zParse(
      zRequestState,
      merge(
        {
          id: requestId,
          collectionId: collection.id,
          pathParams: {},
          queryParams: {},
          headers: {},
          cookieParams: {},
          body: { type: "none" },
          authentication: { type: "none" },
          options: {},
          patch: {},
        },
        request,
      ),
    )

    const signature = buildRequestSignature(parsed.method, parsed.url)
    let targetId = requestId
    let existing = collection.requests[targetId]

    if (!existing) {
      const matchedId = signatureToId.get(signature)
      if (matchedId) {
        targetId = matchedId
        existing = collection.requests[matchedId]
      }
    }

    if (existing) {
      const mergedRequest: RequestState = {
        ...existing,
        ...parsed,
        id: targetId,
        collectionId: collection.id,
        folderId: existing.folderId,
        order: existing.order,
        patch: existing.patch ?? {},
      }
      plan.requestUpdates.push({ id: targetId, data: mergedRequest })
      signatureToId.set(buildRequestSignature(mergedRequest.method, mergedRequest.url), targetId)
      plan.summary.updatedRequests += 1
    } else {
      const resolvedFolderId = ensureFolder(parsed.folderId)
      const newRequest: RequestState = {
        ...parsed,
        collectionId: collection.id,
        folderId: resolvedFolderId,
        patch: parsed.patch ?? {},
      }
      plan.requestAdds.push({ data: newRequest, folderId: resolvedFolderId })
      signatureToId.set(signature, parsed.id)
      plan.summary.addedRequests += 1
    }
  }

  return plan
}

export const applyMergePlan = (collection: CollectionCache, plan: MergePlan): MergeSummary => {
  if (!collection.environments) {
    collection.environments = {}
  }
  for (const { id, data } of plan.environments) {
    if (collection.environments[id]) {
      collection.environments[id] = {
        ...collection.environments[id],
        ...data,
        id,
      }
    } else {
      collection.environments[id] = data
    }
  }

  for (const { node, parentId, position } of plan.foldersToCreate) {
    if (!collection.folders[node.id]) {
      collection.folders[node.id] = {
        ...node,
        childFolderIds: [],
        requestIds: [],
      }
      insertChildFolder(collection, parentId, node.id, position)
    }
  }

  for (const { id, data } of plan.requestUpdates) {
    const existing = collection.requests[id]
    if (!existing) {
      const targetFolder = data.folderId ?? RootCollectionFolderId
      insertRequestIntoFolder(collection, targetFolder, { ...data, folderId: targetFolder })
      continue
    }

    const folderId = existing.folderId ?? RootCollectionFolderId
    collection.requests[id] = {
      ...existing,
      ...data,
      id,
      collectionId: collection.id,
      folderId,
      order: existing.order,
      patch: existing.patch ?? {},
    }
    buildRequestIndexEntry(collection, id)
  }

  for (const { data, folderId } of plan.requestAdds) {
    const targetFolder = folderId ?? RootCollectionFolderId
    insertRequestIntoFolder(collection, targetFolder, {
      ...data,
      folderId: targetFolder,
    })
  }

  return plan.summary
}

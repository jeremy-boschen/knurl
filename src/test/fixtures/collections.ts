import type {
  CollectionFolderNode,
  Environment,
  ExportedCollection,
  RequestCookieParam,
  RequestHeader,
  RequestPathParam,
  RequestQueryParam,
  RequestState,
} from "@/types"
import { RootCollectionFolderId } from "@/types"

let requestCounter = 0
let environmentCounter = 0
let collectionCounter = 0
let folderCounter = 0

export function resetCollectionFixtureSeeds() {
  requestCounter = 0
  environmentCounter = 0
  collectionCounter = 0
  folderCounter = 0
}

export function createRequestFixture(overrides: Partial<RequestState> = {}): RequestState {
  const nextRequestId = requestCounter + 1
  requestCounter = nextRequestId
  const id = overrides.id ?? `request-${nextRequestId}`
  return {
    id,
    name: overrides.name ?? `Request ${id}`,
    collectionId: overrides.collectionId ?? "collection-fixture",
    folderId: overrides.folderId ?? RootCollectionFolderId,
    order: overrides.order,
    environmentId: overrides.environmentId,
    autoSave: overrides.autoSave ?? false,
    method: overrides.method ?? "GET",
    url: overrides.url ?? "https://example.knurl.dev",
    pathParams: overrides.pathParams ?? ({} as Record<string, RequestPathParam>),
    queryParams: overrides.queryParams ?? ({} as Record<string, RequestQueryParam>),
    headers: overrides.headers ?? ({} as Record<string, RequestHeader>),
    cookieParams: overrides.cookieParams ?? ({} as Record<string, RequestCookieParam>),
    body: overrides.body ?? { type: "none" },
    authentication: overrides.authentication ?? { type: "none" },
    tests: overrides.tests,
    options: overrides.options,
    patch: overrides.patch ?? {},
    updated: overrides.updated ?? 0,
  }
}

export function createEnvironmentFixture(overrides: Partial<Environment> = {}): Environment {
  const nextEnvironmentId = environmentCounter + 1
  environmentCounter = nextEnvironmentId
  const id = overrides.id ?? `environment-${nextEnvironmentId}`
  return {
    id,
    name: overrides.name ?? `Environment ${id}`,
    description: overrides.description,
    variables: overrides.variables ?? {},
  }
}

export function createFolderFixture(overrides: Partial<CollectionFolderNode> = {}): CollectionFolderNode {
  const nextFolderId = folderCounter + 1
  folderCounter = nextFolderId
  const id = overrides.id ?? `folder-${nextFolderId}`
  return {
    id,
    name: overrides.name ?? `Folder ${id}`,
    parentId: overrides.parentId ?? null,
    order: overrides.order ?? 0,
    childFolderIds: overrides.childFolderIds ?? [],
    requestIds: overrides.requestIds ?? [],
  }
}

type CollectionFixtureOptions = {
  id?: string
  name?: string
  requests?: Record<string, RequestState>
  environments?: Record<string, Environment>
  folders?: Record<string, CollectionFolderNode>
  collectionOverrides?: Partial<NonNullable<ExportedCollection["collection"]>>
  version?: string
  exportedAt?: string
}

export function createExportedCollectionFixture(options: CollectionFixtureOptions = {}): ExportedCollection {
  const nextCollectionId = collectionCounter + 1
  collectionCounter = nextCollectionId
  const id = options.id ?? `collection-${nextCollectionId}`

  const folders =
    options.folders ??
    ({
      [RootCollectionFolderId]: createFolderFixture({
        id: RootCollectionFolderId,
        name: "Root",
        parentId: null,
      }),
    } as Record<string, CollectionFolderNode>)

  return {
    format: "native",
    version: options.version ?? "1.0.0",
    exportedAt: options.exportedAt ?? new Date("2024-01-01T00:00:00.000Z").toISOString(),
    collection: {
      id,
      name: options.name ?? `Collection ${id}`,
      encryption: { algorithm: "aes-gcm", key: "fixture-key" },
      authentication: { type: "none" },
      requests: options.requests ?? {},
      environments: options.environments ?? {},
      folders,
      ...options.collectionOverrides,
    },
  }
}

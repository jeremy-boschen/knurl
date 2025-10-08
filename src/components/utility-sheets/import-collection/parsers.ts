import type {
  MediaTypeObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
} from "openapi3-ts/oas31"
import { z } from "zod"

import { generateUniqueId } from "@/lib/utils"
import type {
  Collection,
  CollectionFolderNode,
  Environment,
  EnvironmentVariable,
  ExportedCollection,
  FormField,
  RequestBodyData,
  RequestHeader,
  RequestPathParam,
  RequestQueryParam,
  RequestState,
} from "@/types"
import { RootCollectionFolderId, zExportedCollection, zHttpMethod } from "@/types"

export type ValidationResult = { success: true; data: ExportedCollection } | { success: false; error: z.ZodError }

/**
 * Validates a document against the native Knurl collection schema.
 * @param doc The document to validate.
 * @returns A result object indicating success or failure with parsed data or a Zod error.
 */
export const validateNativeDocument = (doc: unknown): ValidationResult => {
  const result = zExportedCollection.safeParse(doc)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

const zPostmanDescription = z
  .union([
    z.string(),
    z
      .object({
        content: z.string().optional(),
      })
      .passthrough(),
  ])
  .optional()

const zPostmanKeyValue = z
  .object({
    key: z.string().optional(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    disabled: z.boolean().optional(),
    type: z.string().optional(),
    description: zPostmanDescription,
  })
  .passthrough()

const zPostmanVariable = zPostmanKeyValue.extend({
  id: z.string().optional(),
})

const zPostmanFormDataItem = zPostmanKeyValue.extend({
  src: z.union([z.string(), z.array(z.string())]).optional(),
})

const zPostmanUrl = z
  .object({
    raw: z.string().optional(),
    protocol: z.string().optional(),
    host: z.array(z.string()).optional(),
    port: z.union([z.string(), z.number()]).optional(),
    path: z.array(z.string()).optional(),
    query: z.array(zPostmanVariable).optional(),
    variable: z.array(zPostmanVariable).optional(),
  })
  .passthrough()

const zPostmanBody = z
  .object({
    mode: z.string().optional(),
    raw: z.string().optional(),
    options: z
      .object({
        raw: z
          .object({
            language: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    urlencoded: z.array(zPostmanVariable).optional(),
    formdata: z.array(zPostmanFormDataItem).optional(),
    file: z
      .object({
        src: z.union([z.string(), z.array(z.string())]).optional(),
      })
      .optional(),
    graphql: z
      .object({
        query: z.string().optional(),
        variables: z.union([z.string(), z.record(z.any())]).optional(),
      })
      .optional(),
  })
  .passthrough()

const zPostmanAuthParam = z.object({
  key: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  type: z.string().optional(),
})

const zPostmanAuth = z
  .object({
    type: z.string(),
  })
  .catchall(z.array(zPostmanAuthParam).optional())
  .optional()

const zPostmanScript = z
  .object({
    exec: z.array(z.string()).optional(),
    type: z.string().optional(),
  })
  .optional()

const zPostmanEvent = z.object({
  listen: z.string(),
  script: zPostmanScript,
})

const zPostmanRequest = z
  .object({
    name: z.string().optional(),
    method: z.string(),
    header: z.array(zPostmanKeyValue).optional(),
    body: zPostmanBody.optional(),
    url: z.union([z.string(), zPostmanUrl]).optional(),
    description: zPostmanDescription,
    auth: zPostmanAuth,
  })
  .passthrough()

const zPostmanItem: z.ZodType = z.lazy(() =>
  z
    .object({
      name: z.string().optional(),
      description: zPostmanDescription,
      request: zPostmanRequest.optional(),
      response: z.array(z.any()).optional(),
      item: z.array(zPostmanItem).optional(),
      event: z.array(zPostmanEvent).optional(),
    })
    .passthrough(),
)

const zPostmanInfo = z.object({
  name: z.string(),
  description: zPostmanDescription,
  schema: z.string().optional(),
})

export const zPostmanCollection = z.object({
  info: zPostmanInfo,
  item: z.array(zPostmanItem),
  variable: z.array(zPostmanVariable).optional(),
})

export type PostmanCollection = z.infer<typeof zPostmanCollection>
type PostmanItem = z.infer<typeof zPostmanItem>
type PostmanRequest = z.infer<typeof zPostmanRequest>
type PostmanBody = z.infer<typeof zPostmanBody>
type PostmanAuth = z.infer<typeof zPostmanAuth>
type PostmanEvent = z.infer<typeof zPostmanEvent>
type PostmanVariable = z.infer<typeof zPostmanVariable>
type PostmanFormDataItem = z.infer<typeof zPostmanFormDataItem>
type PostmanAuthParam = z.infer<typeof zPostmanAuthParam>
type PostmanHeader = z.infer<typeof zPostmanKeyValue>

export type PostmanValidationResult = { success: true; data: PostmanCollection } | { success: false; error: z.ZodError }

/**
 * Lightweight heuristic to detect Postman v2 collection exports.
 * @param doc Unknown document to test.
 */
export const isPostmanCollection = (doc: unknown): doc is PostmanCollection => {
  if (doc === null || typeof doc !== "object") {
    return false
  }
  const maybe = doc as Record<string, unknown>
  const info = maybe.info as Record<string, unknown> | undefined
  if (info) {
    const schema = info.schema
    if (typeof schema === "string" && schema.includes("schema.getpostman.com/json/collection")) {
      return true
    }
    if (typeof info._postman_id === "string" || typeof info.postman_id === "string") {
      return true
    }
  }
  return Array.isArray((maybe as { item?: unknown }).item)
}

/**
 * Validates and parses a Postman collection document.
 * @param doc The raw document to validate.
 */
export const validatePostmanDocument = (doc: unknown): PostmanValidationResult => {
  const result = zPostmanCollection.safeParse(doc)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  return String(value)
}

const extractDescription = (desc: unknown): string => {
  if (typeof desc === "string") {
    return desc
  }
  if (
    desc &&
    typeof desc === "object" &&
    "content" in desc &&
    typeof (desc as { content?: unknown }).content === "string"
  ) {
    return (desc as { content?: string }).content ?? ""
  }
  return ""
}

const mapRawLanguage = (language?: string): RequestBodyData["language"] => {
  switch (language) {
    case "json":
      return "json"
    case "xml":
      return "xml"
    case "graphql":
      return "graphql"
    case "javascript":
      return "javascript"
    case "html":
      return "html"
    case "text":
      return "text"
    default:
      return undefined
  }
}

const isSensitiveHeader = (headerName: string): boolean => {
  const normalized = headerName.toLowerCase()
  return normalized.includes("authorization") || normalized.includes("token") || normalized.includes("secret")
}

const normaliseSrc = (src?: unknown): string | undefined => {
  if (typeof src === "string") {
    return src
  }
  if (Array.isArray(src)) {
    const first = src.find((entry) => typeof entry === "string")
    return typeof first === "string" ? first : undefined
  }
  return undefined
}

const extractFileName = (filePath?: string): string | undefined => {
  if (!filePath) {
    return undefined
  }
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

const buildUrl = (url: PostmanRequest["url"]): string => {
  if (!url) {
    return ""
  }
  if (typeof url === "string") {
    return url
  }
  if (typeof url.raw === "string" && url.raw.trim()) {
    return url.raw
  }
  const protocol = url.protocol ? `${url.protocol}://` : ""
  const host = Array.isArray(url.host) ? url.host.join(".") : ""
  const port = url.port ? `:${url.port}` : ""
  const pathValue = Array.isArray(url.path) ? url.path.filter(Boolean).join("/") : ""
  let output = `${protocol}${host}${port}`
  if (pathValue) {
    if (output) {
      const prefix = pathValue.startsWith("/") || output.endsWith("/") ? "" : "/"
      output = `${output}${prefix}${pathValue}`
    } else {
      output = pathValue.startsWith("/") ? pathValue : `/${pathValue}`
    }
  }
  if (!output) {
    output = ""
  }
  if (Array.isArray(url.query) && url.query.length > 0) {
    const query = url.query
      .map((entry) => {
        if (!entry?.key) {
          return null
        }
        return `${entry.key}=${toStringValue(entry.value)}`
      })
      .filter((segment): segment is string => Boolean(segment))
      .join("&")
    if (query) {
      const separator = output.includes("?") ? "&" : "?"
      output += `${separator}${query}`
    }
  }
  return output
}

const convertQueryParams = (query: PostmanVariable[] | undefined) => {
  const record: Record<string, RequestQueryParam> = {}
  if (!Array.isArray(query)) {
    return record
  }
  for (const entry of query) {
    if (!entry?.key) {
      continue
    }
    const id = generateUniqueId()
    record[id] = {
      id,
      name: entry.key,
      value: toStringValue(entry.value),
      enabled: entry.disabled !== true,
      secure: entry.type === "secret",
    }
  }
  return record
}

const convertUrlEncoded = (entries: PostmanVariable[] | undefined) => {
  if (!Array.isArray(entries)) {
    return undefined
  }
  const record: Record<string, FormField> = {}
  for (const entry of entries) {
    if (!entry?.key) {
      continue
    }
    const id = generateUniqueId()
    record[id] = {
      id,
      key: entry.key,
      value: toStringValue(entry.value),
      enabled: entry.disabled !== true,
      secure: entry.type === "secret",
      kind: "text",
    }
  }
  return record
}

const convertPathVariables = (variables: PostmanVariable[] | undefined) => {
  const record: Record<string, RequestPathParam> = {}
  if (!Array.isArray(variables)) {
    return record
  }
  for (const variable of variables) {
    if (!variable?.key) {
      continue
    }
    const id = generateUniqueId()
    record[id] = {
      id,
      name: variable.key,
      value: toStringValue(variable.value),
      enabled: variable.disabled !== true,
      secure: variable.type === "secret",
    }
  }
  return record
}

const convertHeaders = (headers: PostmanHeader[] | undefined) => {
  const record: Record<string, RequestHeader> = {}
  if (!Array.isArray(headers)) {
    return record
  }
  for (const header of headers) {
    if (!header?.key) {
      continue
    }
    const id = generateUniqueId()
    record[id] = {
      id,
      name: header.key,
      value: toStringValue(header.value),
      enabled: header.disabled !== true,
      secure: header.type === "secret" || isSensitiveHeader(header.key),
    }
  }
  return record
}

const convertFormData = (entries: PostmanFormDataItem[] | undefined) => {
  if (!Array.isArray(entries)) {
    return undefined
  }
  const record: Record<string, FormField> = {}
  for (const entry of entries) {
    if (!entry?.key) {
      continue
    }
    const id = generateUniqueId()
    const src = normaliseSrc((entry as Record<string, unknown>).src)
    const isFile = entry.type === "file" || Boolean(src)
    const contentType =
      "contentType" in entry && typeof (entry as { contentType?: unknown }).contentType === "string"
        ? (entry as { contentType?: string }).contentType
        : undefined
    const fileName = isFile ? extractFileName(src) : undefined
    record[id] = {
      id,
      key: entry.key,
      value: isFile ? "" : toStringValue(entry.value),
      enabled: entry.disabled !== true,
      secure: entry.type === "secret",
      kind: isFile ? "file" : "text",
      fileName,
      filePath: isFile ? src : undefined,
      contentType,
    }
  }
  return record
}

const convertBody = (body: PostmanBody | undefined): Partial<RequestBodyData> | undefined => {
  if (!body) {
    return { type: "none" }
  }
  const mode = body.mode ?? (body.raw ? "raw" : undefined)
  if (!mode) {
    return { type: "none" }
  }
  if (mode === "raw") {
    return {
      type: "text",
      content: body.raw ?? "",
      language: mapRawLanguage(body.options?.raw?.language),
    }
  }
  if (mode === "urlencoded") {
    const formData = convertUrlEncoded(body.urlencoded)
    return {
      type: "form",
      encoding: "url",
      formData: formData ?? {},
    }
  }
  if (mode === "formdata") {
    return {
      type: "form",
      encoding: "multipart",
      formData: convertFormData(body.formdata) ?? {},
    }
  }
  if (mode === "file" || mode === "binary") {
    const src = normaliseSrc(body.file?.src ?? (body as Record<string, unknown>).src)
    return {
      type: "binary",
      binaryPath: src,
      binaryFileName: extractFileName(src),
    }
  }
  if (mode === "graphql") {
    const query = body.graphql?.query ?? ""
    const variables = body.graphql?.variables
    const variablesString =
      typeof variables === "string"
        ? variables
        : variables && typeof variables === "object"
          ? JSON.stringify(variables, null, 2)
          : ""
    const combined = variablesString ? `${query}\n\n# Variables\n${variablesString}` : query
    return {
      type: "text",
      language: "graphql",
      content: combined,
    }
  }
  return { type: "none" }
}

const getAuthParams = (auth: PostmanAuth, key: string) => {
  if (!auth) {
    return undefined
  }
  const lowerKey = key.toLowerCase()
  const source = auth[lowerKey] ?? auth[key]
  return Array.isArray(source) ? source : undefined
}

const findAuthValue = (entries: PostmanAuthParam[] | undefined, key: string) => {
  if (!entries) {
    return undefined
  }
  const match = entries.find((entry) => entry?.key === key)
  return match?.value ? toStringValue(match.value) : undefined
}

const convertAuth = (auth?: PostmanAuth): RequestState["authentication"] => {
  if (!auth || typeof auth.type !== "string") {
    return { type: "none" }
  }
  const kind = auth.type.toLowerCase()
  if (kind === "bearer") {
    const params = getAuthParams(auth, "bearer")
    const token = findAuthValue(params, "token") ?? ""
    const scheme = findAuthValue(params, "prefix")
    return {
      type: "bearer",
      bearer: {
        token,
        scheme,
      },
    }
  }
  if (kind === "basic") {
    const params = getAuthParams(auth, "basic")
    return {
      type: "basic",
      basic: {
        username: findAuthValue(params, "username"),
        password: findAuthValue(params, "password"),
      },
    }
  }
  if (kind === "apikey" || kind === "apiKey") {
    const params = getAuthParams(auth, "apikey") ?? getAuthParams(auth, "apiKey")
    const key = findAuthValue(params, "key") ?? "X-API-Key"
    const value = findAuthValue(params, "value") ?? ""
    const placementType = findAuthValue(params, "in") ?? "header"
    const placementName = findAuthValue(params, "name") ?? key
    const placement =
      placementType === "query"
        ? { type: "query", name: placementName }
        : placementType === "cookie"
          ? { type: "cookie", name: placementName }
          : { type: "header", name: placementName }
    return {
      type: "apiKey",
      apiKey: {
        key,
        value,
        placement,
      },
    }
  }
  if (kind === "oauth2") {
    const params = getAuthParams(auth, "oauth2")
    return {
      type: "oauth2",
      oauth2: {
        clientId: findAuthValue(params, "clientId"),
        clientSecret: findAuthValue(params, "clientSecret"),
        scope: findAuthValue(params, "scope"),
        authUrl: findAuthValue(params, "authUrl"),
        tokenUrl: findAuthValue(params, "accessTokenUrl") ?? findAuthValue(params, "tokenUrl"),
      },
    }
  }
  return { type: "none" }
}

const convertTests = (events?: PostmanEvent[]): string | undefined => {
  if (!Array.isArray(events)) {
    return undefined
  }
  const scripts = events
    .filter((event) => event.listen === "test" && Array.isArray(event.script?.exec))
    .map((event) => (event.script?.exec ?? []).join("\n").trim())
    .filter(Boolean)

  if (scripts.length === 0) {
    return undefined
  }
  return scripts.join("\n\n")
}

/**
 * Converts a Postman collection into the native Knurl collection format.
 * @param collection The Postman collection.
 */
export function postmanToNative(collection: PostmanCollection): ExportedCollection {
  const collectionId = generateUniqueId()
  const now = new Date().toISOString()

  const folders: Record<string, CollectionFolderNode> = {
    [RootCollectionFolderId]: createFolderNode(RootCollectionFolderId, "Root", null),
  }
  const folderOrder = new Map<string, number>([[RootCollectionFolderId, 0]])
  const requestOrder = new Map<string, number>([[RootCollectionFolderId, 0]])

  const nextFolderOrder = (parentId: string) => {
    const current = folderOrder.get(parentId) ?? 0
    folderOrder.set(parentId, current + 1)
    return current
  }

  const nextRequestOrder = (parentId: string) => {
    const current = requestOrder.get(parentId) ?? 0
    requestOrder.set(parentId, current + 1)
    return current
  }

  const ensureFolder = (name: string | undefined, parentId: string): string => {
    const parent = folders[parentId] ?? folders[RootCollectionFolderId]
    const resolvedParentId = parent.id
    const id = generateUniqueId()
    const folderName = name?.trim() || "Folder"
    folders[id] = {
      id,
      name: folderName,
      parentId: resolvedParentId,
      order: nextFolderOrder(resolvedParentId),
      childFolderIds: [],
      requestIds: [],
    }
    parent.childFolderIds.push(id)
    folderOrder.set(id, 0)
    requestOrder.set(id, 0)
    return id
  }

  const requests: RequestState[] = []

  const traverseItems = (items: PostmanItem[] | undefined, parentId: string) => {
    if (!Array.isArray(items)) {
      return
    }
    for (const item of items) {
      const isFolder = Array.isArray(item.item) && item.item.length > 0
      if (isFolder) {
        const folderId = ensureFolder(item.name, parentId)
        traverseItems(item.item, folderId)
        continue
      }
      if (!item.request) {
        continue
      }
      const requestId = generateUniqueId()
      const method = item.request.method?.toUpperCase?.() ?? "GET"
      const methodParse = zHttpMethod.safeParse(method)
      const finalMethod = methodParse.success ? methodParse.data : "GET"

      const folder = folders[parentId] ?? folders[RootCollectionFolderId]

      const request: RequestState = {
        id: requestId,
        order: nextRequestOrder(folder.id),
        name: item.request.name ?? item.name ?? `${finalMethod} ${buildUrl(item.request.url)}`.trim(),
        collectionId,
        folderId: folder.id,
        environmentId: undefined,
        autoSave: false,
        method: finalMethod,
        url: buildUrl(item.request.url),
        pathParams: convertPathVariables(
          typeof item.request.url === "object" && item.request.url !== null ? item.request.url.variable : undefined,
        ),
        queryParams: convertQueryParams(
          typeof item.request.url === "object" && item.request.url !== null ? item.request.url.query : undefined,
        ),
        headers: convertHeaders(item.request.header),
        cookieParams: {},
        body: convertBody(item.request.body),
        authentication: convertAuth(item.request.auth),
        tests: convertTests(item.event),
        options: undefined,
        patch: {},
        updated: 0,
      }

      folder.requestIds.push(request.id)
      requests.push(request)
    }
  }

  traverseItems(collection.item, RootCollectionFolderId)
  folders[RootCollectionFolderId].childFolderIds = Array.from(new Set(folders[RootCollectionFolderId].childFolderIds))

  const environments: Environment[] =
    Array.isArray(collection.variable) && collection.variable.length > 0
      ? [
          {
            id: generateUniqueId(),
            name: `${collection.info.name} Variables`,
            description: "Imported from Postman collection variables.",
            variables: collection.variable.reduce(
              (acc, variable) => {
                if (!variable?.key) {
                  return acc
                }
                const varId = variable.id ?? generateUniqueId()
                acc[varId] = {
                  id: varId,
                  name: variable.key,
                  value: toStringValue(variable.value),
                  secure: variable.type === "secret",
                }
                return acc
              },
              {} as Record<string, EnvironmentVariable>,
            ),
          },
        ]
      : []

  const collectionState: Partial<Collection> = {
    id: collectionId,
    name: collection.info.name,
    description: extractDescription(collection.info.description),
    updated: now,
    requests: requests.reduce<Record<string, RequestState>>((acc, request) => {
      acc[request.id] = request
      return acc
    }, {}),
    folders,
    environments: environments.reduce<Record<string, Environment>>((acc, environment) => {
      acc[environment.id] = environment
      return acc
    }, {}),
  }

  return {
    format: "native",
    version: "1.0.0",
    exportedAt: now,
    collection: collectionState,
  }
}

/**
 * Type guard to check if an object is a valid OpenAPI v3 document.
 * @param doc The object to check.
 */
export const isOpenApiDocument = (doc: unknown): doc is OpenAPIObject => {
  const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null
  return (
    isObject(doc) &&
    typeof doc.openapi === "string" &&
    doc.openapi.startsWith("3.") &&
    isObject(doc.info) &&
    typeof doc.info.title === "string" &&
    isObject(doc.paths)
  )
}

/**
 * Type guard to check if an object is a Reference Object in OpenAPI.
 * @param x The object to check.
 */
export function isReferenceObject(x: unknown): x is ReferenceObject {
  return typeof x === "object" && x !== null && "$ref" in x
}

/**
 * Options to control OpenAPI → native conversion behavior.
 */
export interface OpenApiToNativeOptions {
  /** When true, create top-level folders for the first tag on each operation. */
  groupByTags?: boolean
}

const createFolderNode = (id: string, name: string, parentId: string | null, order = 0): CollectionFolderNode => ({
  id,
  name,
  parentId,
  order,
  childFolderIds: [],
  requestIds: [],
})

/**
 * Converts an OpenAPI v3 specification into the native Knurl collection format.
 * @param spec The OpenAPI document.
 * @param options Conversion customisations.
 * @returns An `ExportedCollection` object.
 */
export function openApiToNative(
  spec: OpenAPIObject,
  options: OpenApiToNativeOptions = { groupByTags: true },
): ExportedCollection {
  const collectionId = generateUniqueId()
  const { groupByTags = true } = options

  // 1) Convert servers to environments
  const environments: Environment[] = (spec.servers ?? []).flatMap((srv, i): Environment[] => {
    if (typeof srv.url !== "string") {
      return []
    }

    const vars: EnvironmentVariable[] = [
      {
        id: generateUniqueId(),
        name: "baseUrl",
        value: srv.url,
        secure: false,
      },
    ]

    for (const [name, def] of Object.entries(srv.variables ?? {})) {
      if (typeof def.default === "string") {
        vars.push({
          id: generateUniqueId(),
          name,
          value: def.default,
          secure: false,
        })
      }
    }

    return [
      {
        id: generateUniqueId(),
        name: srv.description ?? `Server ${i + 1}`,
        description: srv.description,
        variables: vars.reduce(
          (acc, variable) => {
            acc[variable.id] = variable
            return acc
          },
          {} as Record<string, EnvironmentVariable>,
        ),
      },
    ]
  })

  // 2) Build requests from paths
  const requests: RequestState[] = []
  const folders: Record<string, CollectionFolderNode> = {
    [RootCollectionFolderId]: createFolderNode(RootCollectionFolderId, "Root", null),
  }
  const tagFolderMap = new Map<string, string>()
  for (const [path, item] of Object.entries(spec.paths ?? {}) as [string, PathItemObject][]) {
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options"] as const) {
      const op = item[method] as OperationObject | undefined
      if (!op) {
        continue
      }

      // Collect parameters from both PathItem and Operation, resolving $ref when possible
      const allParams = [...(item.parameters ?? []), ...(op.parameters ?? [])]
        .map((p) => {
          if (isReferenceObject(p)) {
            const ref = p.$ref
            // Resolve refs like "#/components/parameters/ParamName"
            const match = ref.match(/#\/components\/parameters\/([^/]+)$/)
            const key = match?.[1]
            const resolved = key ? spec.components?.parameters?.[key] : undefined
            return resolved && !isReferenceObject(resolved) ? (resolved as ParameterObject) : undefined
          }
          return p as ParameterObject
        })
        .filter((p): p is ParameterObject => !!p)

      // Prepare query and path params as objects matching schema
      const queryParams: Record<
        string,
        { id: string; name: string; value: string; enabled: boolean; secure: boolean }
      > = {}
      const pathParams: Record<string, { id: string; name: string; value: string; enabled: boolean; secure: boolean }> =
        {}

      for (const p of allParams) {
        const name = p.name
        let val = ""
        // Try schema.default or schema.example or top-level example
        const schemaUnknown = p.schema as unknown
        if (schemaUnknown && typeof schemaUnknown === "object") {
          const schemaObj = schemaUnknown as { default?: unknown; example?: unknown }
          if (schemaObj.default != null) {
            val = String(schemaObj.default)
          } else if (schemaObj.example != null) {
            val = String(schemaObj.example)
          }
        } else if (p.example != null) {
          val = String(p.example as unknown as string)
        }

        const paramObj = {
          id: generateUniqueId(),
          name,
          value: val,
          enabled: true,
          secure: false,
        }

        if (p.in === "query") {
          // Operation-level params override path-level by writing last
          queryParams[paramObj.id] = paramObj
        } else if (p.in === "path") {
          pathParams[paramObj.id] = paramObj
        }
      }

      let body: RequestBodyData = { type: "none", content: "" }
      if (op.requestBody && !isReferenceObject(op.requestBody)) {
        const rb = op.requestBody as RequestBodyObject
        const mb = rb.content["application/json"] as MediaTypeObject | undefined
        if (mb?.example) {
          body = { type: "text", content: JSON.stringify(mb.example, null, 2) }
        }
      }

      // Normalize OpenAPI path templates `{id}` -> `{{id}}` to match Knurl variables
      const normalizedPath = path.replace(/\{([^}]+)\}/g, "{{$1}}")

      const requestId = generateUniqueId()

      const resolveFolderId = () => {
        if (!groupByTags) {
          return RootCollectionFolderId
        }
        const firstTag = op.tags?.find((tag) => typeof tag === "string" && tag.trim().length > 0)?.trim()
        if (!firstTag) {
          return RootCollectionFolderId
        }

        const existing = tagFolderMap.get(firstTag)
        if (existing) {
          return existing
        }

        const folderId = generateUniqueId()
        tagFolderMap.set(firstTag, folderId)
        folders[folderId] = createFolderNode(folderId, firstTag, RootCollectionFolderId, tagFolderMap.size)
        folders[RootCollectionFolderId].childFolderIds.push(folderId)
        return folderId
      }

      const folderId = resolveFolderId()

      const request = {
        id: requestId,
        name: op.summary ?? `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        url: `{{baseUrl}}${normalizedPath}`,
        headers: {},
        queryParams,
        pathParams,
        body,
        authentication: { type: "none" },
        collectionId,
        autoSave: true,
        folderId,
      } as unknown as RequestState

      requests.push(request)

      const folderNode = folders[folderId] ?? folders[RootCollectionFolderId]
      folderNode.requestIds.push(requestId)
      request.order = folderNode.requestIds.length
    }
  }

  folders[RootCollectionFolderId].childFolderIds = Array.from(new Set(folders[RootCollectionFolderId].childFolderIds))

  // 3) Assemble the collection
  const collection: Partial<Collection> = {
    id: collectionId,
    name: spec.info.title,
    description: spec.info.description ?? "",
    requests: requests.reduce(
      (acc, req) => {
        acc[req.id] = req
        return acc
      },
      {} as Record<string, RequestState>,
    ),
    folders,
    environments: environments.reduce(
      (acc, env) => {
        acc[env.id] = env
        return acc
      },
      {} as Record<string, Environment>,
    ),
  }

  return {
    format: "native",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    collection,
  }
}

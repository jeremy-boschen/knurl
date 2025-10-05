import type {
  MediaTypeObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
} from "openapi3-ts/oas31"
import type { z } from "zod"

import { generateUniqueId } from "@/lib/utils"
import type {
  Collection,
  CollectionFolderNode,
  Environment,
  EnvironmentVariable,
  ExportedCollection,
  RequestBodyData,
  RequestState,
} from "@/types"
import { RootCollectionFolderId, zExportedCollection } from "@/types"

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

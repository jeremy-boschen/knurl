// Re-export core types and enums
export { DefaultCollectionFolderId, zHttpMethod, zRequestOpenStatus } from "./core"
export type { HttpMethod, RequestOpenStatus } from "./core"

// Re-export body types
export {
  zFormField,
  zRequestBodyType,
  zRequestBodyGrammar,
  zFormEncoding,
  zRequestBodyData,
  detectRequestBodyGrammar,
} from "./body"
export type { FormField, RequestBodyType, RequestBodyGrammar, FormEncoding, RequestBodyData } from "./body"

// Re-export auth types
export { zAuthType, zAuthTypes, AuthTypes, zAuthPlacementType, zAuthPlacement, zAuthConfig } from "./auth"
export type { AuthType, AuthPlacementType, BasicAuth, BearerAuth, ApiKeyAuth, OAuth2Auth, AuthConfig } from "./auth"

// Re-export parameter types
export { zRequestQueryParam, zRequestPathParam, zRequestHeader, zRequestCookieParam } from "./parameters"
export type { RequestQueryParam, RequestPathParam, RequestHeader, RequestCookieParam } from "./parameters"

// Re-export options types
export { zClientOptionsData } from "./options"
export type { ClientOptionsData } from "./options"

// Re-export patch types
export { zRequestPatch } from "./patch"
export type { RequestPatch } from "./patch"

// Re-export response types
export {
  zLogLevel,
  DEFAULT_LOG_LEVELS,
  zLogEntry,
  zCookie,
  zHttpResponseData,
  zWebSocketResponseData,
  zResponseState,
} from "./response"
export type { LogLevel, LogEntry, Cookie, HttpResponseData, WebSocketResponseData, ResponseState } from "./response"

// Re-export main request state
import { z } from "zod"
import { zHttpMethod } from "./core"
import { zRequestBodyData } from "./body"
import { zRequestQueryParam, zRequestPathParam, zRequestHeader, zRequestCookieParam } from "./parameters"
import { zAuthConfig } from "./auth"
import { zClientOptionsData } from "./options"
import { zRequestPatch } from "./patch"
import type { RequestPatch } from "./patch"
import type { RequestBodyData } from "./body"
import type { AuthConfig } from "./auth"
import type { ClientOptionsData } from "./options"
import { isNotEmpty } from "@/lib/utils"

/**
 * Base schema for request data
 */
const zRequestStateCore = z.object({
  /**
   * Unique identifier for the request
   */
  id: z.string(),
  /**
   * Folder that owns this request inside its parent collection.
   */
  folderId: z.string().default("root"),
  /**
   * Sort order for the request within its collection
   */
  order: z.number().int().optional(),
  /**
   * Name of the request
   */
  name: z.string(),
  /**
   * Identifier for the collection this request belongs to
   */
  collectionId: z.string(),
  /**
   * Identifier for the environment this request belongs to
   */
  environmentId: z.string().optional(),
  /**
   * Whether the request should be automatically saved
   */
  autoSave: z.boolean().default(false),
  /**
   * HTTP method for the request
   */
  method: zHttpMethod,
  /**
   * URL for the request
   */
  url: z.string(),
  /**
   * Path parameters
   */
  pathParams: z.record(z.string(), zRequestPathParam),
  /**
   * Query parameters
   */
  queryParams: z.record(z.string(), zRequestQueryParam),
  /**
   * Request headers
   */
  headers: z.record(z.string(), zRequestHeader),
  /**
   * Request cookies (first-class params)
   */
  cookieParams: z.record(z.string(), zRequestCookieParam).default({}),
  /**
   * Request body configuration
   */
  body: zRequestBodyData.partial(),
  /**
   * Authentication configuration
   */
  authentication: zAuthConfig,
  /**
   * Test cases for the request
   */
  tests: z.string().optional(),
  /**
   * HTTP client options configuration
   */
  options: zClientOptionsData.optional(),
})

/**
 * Schema for request data with patch modifications
 */
export const zRequestState = zRequestStateCore.extend({
  /**
   * Whether the request should be automatically saved
   */
  autoSave: z.boolean().default(false),
  /**
   * Changes to the request data prior to saving. This is persisted across application restarts and
   * can be automatically merged into the request via the autoSave flag. The application will generally
   * show this applied to the core request throughout the application.
   */
  patch: zRequestPatch.partial().optional().default({}),
  /**
   * Version number to track when changes happen without
   */
  updated: z.int().default(0),
})

export type RequestState = z.infer<typeof zRequestState>

export const isRequestDirty = (request: RequestState): boolean => {
  // The patching methods delete entries from the patch when they match the base, so we can use the existence
  // of any field in the patch to indicate that there are changes
  return isNotEmpty(request.patch)
}

export const isRequestBodyNone = (request: RequestState): boolean => {
  return request.body.type === "none"
}

export const isRequestBodyEncoded = (request: RequestState): boolean => {
  return request.body.type === "form" || request.body.type === "text"
}

export const isRequestBodyText = (request: RequestState): boolean => {
  return request.body.type === "text"
}

export const isRequestBodyForm = (request: RequestState): boolean => {
  return request.body.type === "form"
}

export const isRequestBodyBinary = (request: RequestState): boolean => {
  return request.body.type === "binary"
}

/**
 * Returns a RequestState with `patch` applied over the base,
 * where `headers` and `params` arrays in the patch **replace** the originals.
 * All other fields fall back to the base when not present in a patch.
 * The returned object omits `patch`. If no patch is present, the original request is returned.
 */
export function toMergedRequest(request: RequestState): RequestState {
  if (!request.patch || Object.keys(request.patch).length === 0) {
    return request
  }

  const p = request.patch

  // noinspection UnnecessaryLocalVariableJS
  const merged = {
    // identifiers & flags
    id: request.id,
    name: p.name ?? request.name,
    collectionId: p.collectionId ?? request.collectionId,
    folderId: p.folderId ?? request.folderId,
    environmentId: p.environmentId ?? request.environmentId,
    autoSave: p.autoSave ?? request.autoSave,

    // HTTP details
    method: p.method ?? request.method,
    url: p.url ?? request.url,

    // records: replace when the patch provides them
    headers: p.headers !== undefined ? p.headers : request.headers,
    queryParams: p.queryParams !== undefined ? p.queryParams : request.queryParams,
    pathParams: p.pathParams !== undefined ? p.pathParams : request.pathParams,
    cookieParams: p.cookieParams !== undefined ? p.cookieParams : request.cookieParams,

    // body: shallow-merge all fields, but replace formData record if present
    body: {
      type: p.body?.type ?? request.body.type,
      content: p.body?.content ?? request.body.content,
      language: p.body?.language ?? request.body.language,
      formData: p.body?.formData !== undefined ? p.body.formData : request.body.formData,
      encoding: p.body?.encoding ?? request.body.encoding,
      // Include binary body fields when present in patch or base
      binaryPath: p.body?.binaryPath ?? request.body.binaryPath,
      binaryFileName: p.body?.binaryFileName ?? request.body.binaryFileName,
      binaryContentType: p.body?.binaryContentType ?? request.body.binaryContentType,
    } as RequestBodyData,

    // auth: deep-merge, ensuring clean transition between auth types
    authentication: (() => {
      const baseAuth = request.authentication
      const patchAuth = p.authentication
      if (!patchAuth) {
        return baseAuth
      }

      const mergedAuth: AuthConfig = {
        ...baseAuth,
        ...patchAuth,
      }

      // If the auth type has changed, we need to clean up the old auth type's data
      if (patchAuth.type && patchAuth.type !== baseAuth.type) {
        // Erase the old auth type's data
        const oldType = baseAuth.type
        if (oldType !== "none" && oldType !== "inherit") {
          // biome-ignore lint/suspicious/noExplicitAny: OK
          delete (mergedAuth as any)[oldType]
        }
      }
      return mergedAuth
    })(),

    // tests or other optional fields
    tests: p.tests ?? request.tests,

    // options: shallow-merge any changed subfields
    options: {
      ...request.options,
      ...(p.options as Partial<ClientOptionsData>),
    },

    patch: {},

    updated: request.updated,
  }

  return merged
}

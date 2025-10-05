// noinspection DuplicatedCode, JSUnusedGlobalSymbols

import { z } from "zod"

import { isNotEmpty } from "@/lib/utils"

export const DefaultCollectionFolderId = "root" as const

/**
 * Schema & type defining valid HTTP methods
 */
export const zHttpMethod = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"])
export type HttpMethod = z.infer<typeof zHttpMethod>

/**
 * Schema & type for form data entries
 */
export const zFormField = z.object({
  /**
   * Unique identifier for the form field
   */
  id: z.string(),
  /**
   * Form field key
   */
  key: z.string().default(""),
  /**
   * Form field value
   */
  value: z.string().default(""),
  /**
   * Whether the field is enabled
   */
  enabled: z.boolean().default(true),
  /**
   * Whether the field contains sensitive data. If true, data will be encrypted when stored to disk
   */
  secure: z.boolean().default(false),
  /**
   * Kind of form field: text or file. Defaults to text for backward compatibility.
   */
  kind: z.enum(["text", "file"]).default("text").optional(),
  /**
   * For file kind: the original file name
   */
  fileName: z.string().optional(),
  /**
   * For file kind: MIME content type (defaults to application/octet-stream when missing)
   */
  contentType: z.string().optional(),
  /**
   * For file kind: full path on disk. Backend reads bytes at send time when present.
   */
  filePath: z.string().optional(),
})

export type FormField = z.infer<typeof zFormField>

/**
 * Schema defining request body types
 */
export const zRequestBodyType = z.enum(["none", "form", "text", "binary"])
export type RequestBodyType = z.infer<typeof zRequestBodyType>

/**
 * Schema defining text language types for request bodies
 */
export const zRequestBodyGrammar = z.enum(["json", "yaml", "xml", "html", "graphql", "javascript", "text", "css"])
export type RequestBodyGrammar = z.infer<typeof zRequestBodyGrammar>

/**
 * Schema defining form encoding types
 */
export const zFormEncoding = z.enum(["url", "multipart", "plain"])
export type FormEncoding = z.infer<typeof zFormEncoding>

/**
 * Schema for request body configurations
 */
export const zRequestBodyData = z.object({
  /**
   * Type of request body (none/form/text/binary)
   */
  type: zRequestBodyType.default("none"),
  /**
   * Content of the request body (used for text types)
   */
  content: z.string().optional(),
  /**
   * Language type for text content (json/yaml/graphql/xml/plain)
   */
  language: zRequestBodyGrammar.optional(),
  /**
   * Form data entries (used for form type)
   */
  formData: z.record(z.string(), zFormField).optional(),
  /**
   * Encoding type for form data (url/multipart/plain)
   */
  encoding: zFormEncoding.optional(),
  /**
   * For binary body type: full path of a file to send as raw body
   */
  binaryPath: z.string().optional(),
  /**
   * For binary body type: original file name (display-only)
   */
  binaryFileName: z.string().optional(),
  /**
   * For binary body type: optional content type hint; engine may set header if missing
   */
  binaryContentType: z.string().optional(),
})
export type RequestBodyData = z.infer<typeof zRequestBodyData>

/**
 * Schema defining authentication types
 */
export const zAuthType = z.enum(["none", "inherit", "bearer", "basic", "apiKey", "oauth2"])
export type AuthType = z.infer<typeof zAuthType>

export const zAuthTypes = z.record(zAuthType, z.string())

export const AuthTypes: z.infer<typeof zAuthTypes> = {
  none: "None",
  inherit: "Inherit",
  bearer: "Bearer",
  basic: "Basic",
  apiKey: "API Key",
  oauth2: "OAuth2",
}

/**
 * Where to place token/credentials when injecting auth
 */
export const zAuthPlacementType = z.enum(["header", "query", "cookie", "body"])
export type AuthPlacementType = z.infer<typeof zAuthPlacementType>

export const zAuthPlacement = z.discriminatedUnion("type", [
  // Default header name to Authorization if missing
  z.object({ type: z.literal("header"), name: z.string().default("Authorization") }),
  // Default names to empty string for query/cookie when missing
  z.object({ type: z.literal("query"), name: z.string().default("") }),
  z.object({ type: z.literal("cookie"), name: z.string().default("") }),
  // Default body fields to empty strings when missing
  z.object({ type: z.literal("body"), fieldName: z.string().default(""), contentType: z.string().default("") }),
])

const zBasicAuth = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
})
export type BasicAuth = z.infer<typeof zBasicAuth>

const zBearerAuth = z.object({
  token: z.string().optional(),
  // Optional scheme for Authorization header (e.g., "Bearer", "JWT", or custom)
  scheme: z.string().optional(),
  placement: zAuthPlacement.optional(),
})
export type BearerAuth = z.infer<typeof zBearerAuth>

const zApiKeyAuth = z.object({
  key: z.string().optional(),
  value: z.string().optional(),
  placement: zAuthPlacement.optional(),
})
export type ApiKeyAuth = z.infer<typeof zApiKeyAuth>

const zOauth2Auth = z.object({
  grantType: z.enum(["client_credentials", "password", "refresh_token", "device_code"]).default("client_credentials"),
  // Optional OpenID Connect discovery endpoint (issuer base or full .well-known URL)
  discoveryUrl: z.string().optional(),
  authUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  // Present only for historical compatibility; ROPC is not supported at runtime
  username: z.string().optional(),
  password: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenCaching: z.enum(["always", "never"]).default("always").optional(),
  clientAuth: z.enum(["basic", "body"]).default("body").optional(),
  tokenExtraParams: z.record(z.string(), z.string()).optional(),
})
export type OAuth2Auth = z.infer<typeof zOauth2Auth>

export const zAuthConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("inherit") }),
  z.object({ type: z.literal("basic"), basic: zBasicAuth }),
  z.object({ type: z.literal("bearer"), bearer: zBearerAuth }),
  z.object({ type: z.literal("apiKey"), apiKey: zApiKeyAuth }),
  z.object({ type: z.literal("oauth2"), oauth2: zOauth2Auth }),
])

export type AuthConfig = z.infer<typeof zAuthConfig>

/**
 * Schema for HTTP client options configuration
 */
export const zClientOptionsData = z.object({
  /**
   * If true, disable SSL certificate verification
   */
  disableSsl: z.boolean().default(false).optional(),
  /**
   * Path to a custom root CA bundle (PEM format)
   */
  caPath: z.string().optional(),
  /**
   * Hostname part for custom DNS override (e.g., "api.example.com")
   */
  hostOverride: z.string().optional(),
  /**
   * IP to resolve hostOverride to (e.g., "127.0.0.1")
   */
  ipOverride: z.string().optional(),
  /**
   * Timeout in seconds for the request
   */
  timeoutSecs: z.union([z.int(), z.string()]).optional(),
  /**
   * User agent string
   */
  userAgent: z.string().optional(), //TODO: set to Knurl/version when ready
  /**
   * HTTP version preference for this request (ALPN offer / enforcement)
   */
  httpVersion: z.enum(["auto", "http1", "http2"]).optional(),
  /**
   * Maximum number of redirects to follow automatically. 0 disables.
   */
  maxRedirects: z.number().int().min(0).optional(),
})
export type ClientOptionsData = z.infer<typeof zClientOptionsData>

export const zRequestOpenStatus = z.enum(["open", "closed"])
export type RequestOpenStatus = z.infer<typeof zRequestOpenStatus>

export const zRequestQueryParam = z.object({
  id: z.string(),
  name: z.string().default(""),
  value: z.string().default(""),
  enabled: z.boolean().default(true),
  secure: z.boolean().default(false),
})
export type RequestQueryParam = z.infer<typeof zRequestQueryParam>

export const zRequestPathParam = z.object({
  id: z.string(),
  name: z.string().default(""),
  value: z.string().default(""),
  enabled: z.boolean().default(true),
  secure: z.boolean().default(false),
})
export type RequestPathParam = z.infer<typeof zRequestPathParam>

export const zRequestHeader = z.object({
  id: z.string(),
  name: z.string().default(""),
  value: z.string().default(""),
  enabled: z.boolean().default(true),
  secure: z.boolean().default(false),
})
export type RequestHeader = z.infer<typeof zRequestHeader>

export const zRequestCookieParam = z.object({
  id: z.string(),
  name: z.string().default(""),
  value: z.string().default(""),
  enabled: z.boolean().default(true),
  secure: z.boolean().default(false),
})
export type RequestCookieParam = z.infer<typeof zRequestCookieParam>

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
  folderId: z.string().default(DefaultCollectionFolderId),
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
  method: zHttpMethod, //.default("GET"),
  /**
   * URL for the request
   */
  url: z.string(), //.default(""),
  /**
   * Path parameters
   */
  pathParams: z.record(z.string(), zRequestPathParam), //.default({}),
  /**
   * Query parameters
   */
  queryParams: z.record(z.string(), zRequestQueryParam), //.default({}),
  /**
   * Request headers
   */
  headers: z.record(z.string(), zRequestHeader), //.default({}),
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

// Patch schema must not inherit defaults from the base request schema,
// otherwise Zod will populate missing fields (e.g., autoSave: false) on load.
// Define it explicitly with all fields optional and without defaults.
export const zRequestPatch = z.object({
  order: z.number().int().optional(),
  name: z.string().optional(),
  collectionId: z.string().optional(),
  folderId: z.string().optional(),
  environmentId: z.string().optional(),
  autoSave: z.boolean().optional(),
  method: zHttpMethod.optional(),
  url: z.string().optional(),
  pathParams: z.record(z.string(), zRequestPathParam).optional(),
  queryParams: z.record(z.string(), zRequestQueryParam).optional(),
  headers: z.record(z.string(), zRequestHeader).optional(),
  cookieParams: z.record(z.string(), zRequestCookieParam).optional(),
  body: zRequestBodyData.partial().optional(),
  authentication: zAuthConfig.optional(),
  tests: z.string().optional(),
  options: zClientOptionsData.optional(),
})
export type RequestPatch = z.infer<typeof zRequestPatch>

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

export const detectRequestBodyGrammar = (request: RequestState): RequestBodyGrammar | undefined => {
  const content = request.body?.content?.trim() ?? ""
  if (!content) {
    return undefined
  }

  if (content.startsWith("{") || content.startsWith("[")) {
    try {
      JSON.parse(content)
      return "json"
    } catch (_) {
      // ignore
    }
  } else if (content.includes("<?xml") || content.includes("<")) {
    return "xml"
  } else if (content.includes("query") || content.includes("mutation")) {
    return "graphql"
  }

  return "text"
}

export const zLogLevel = z.enum(["info", "debug", "error", "warning"])
export type LogLevel = z.infer<typeof zLogLevel>
export const DEFAULT_LOG_LEVELS: LogLevel[] = ["info", "debug", "warning", "error"]

/**
 * Schema for log entries from HTTP requests
 */
export const zLogEntry = z.object({
  /**
   * Unique ID for the request this log belongs to
   */
  requestId: z.string(),
  /**
   * Timestamp of the log entry
   */
  timestamp: z.string(),
  /**
   * Log level/category
   */
  level: zLogLevel,
  /**
   * Type of debug info (optional)
   */
  infoType: z.string().optional(),
  /**
   * The actual log message
   */
  message: z.string(),
  /**
   * High-level structured category (dns/connect/tls/...)
   */
  category: z.string().optional(),
  /**
   * Optional phase within the category (start/resolved/...)
   */
  phase: z.string().optional(),
  /**
   * Milliseconds elapsed from request dispatch when emitted
   */
  elapsedMs: z.number().optional(),
  /**
   * Structured payload for UI consumption
   */
  details: z.unknown().optional(),
  /**
   * Number of payload bytes included with the event
   */
  bytesLogged: z.number().optional(),
  /**
   * Indicates whether the payload was truncated due to log limits
   */
  truncated: z.boolean().optional(),
})
export type LogEntry = z.infer<typeof zLogEntry>

export const zCookie = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.iso.datetime().optional(),
  maxAge: z.int64().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.string().optional(),
})

export type Cookie = z.infer<typeof zCookie>

/**
 * Schema for HTTP-specific response data
 */
export const zHttpResponseData = z.object({
  /**
   * HTTP status code
   */
  status: z.number(),
  /**
   * Status text from the HTTP response
   */
  statusText: z.string(),
  /**
   * Response headers
   */
  headers: z.record(z.string(), z.string()),
  /**
   * Response cookies
   */
  cookies: z.array(zCookie),
  /**
   * Response body content
   */
  body: z.string().optional(),
  /**
   * Base64-encoded body for binary/preview purposes (optional)
   */
  bodyBase64: z.string().optional(),
  /**
   * If present, body was streamed to this local file path on disk.
   */
  filePath: z.string().optional(),
})
export type HttpResponseData = z.infer<typeof zHttpResponseData>

/**
 * Schema for WebSocket-specific response data (placeholder)
 */
export const zWebSocketResponseData = z.object({
  status: z.literal("Connected"),
  // Future fields: messages, connection details, etc.
})
export type WebSocketResponseData = z.infer<typeof zWebSocketResponseData>

/**
 * Schema for response data, discriminated by protocol type
 */
export const zResponseState = z.object({
  /**
   * Unique identifier for this request/response session
   */
  requestId: z.string(),
  /**
   * Time taken for the response (in milliseconds)
   */
  responseTime: z.number(),
  /**
   * Size of the response (in bytes)
   */
  responseSize: z.number(),
  /**
   * Timestamp of the response
   */
  timestamp: z.string(),
  /**
   * Request logs captured during execution
   */
  logs: z.array(zLogEntry).optional().default([]),
  /**
   * User-selected log levels to surface in the UI
   */
  logFilterLevels: z.array(zLogLevel).optional().default(DEFAULT_LOG_LEVELS),
  /**
   * Protocol-specific response data
   */
  data: z.discriminatedUnion("type", [
    z.object({ type: z.literal("http"), data: zHttpResponseData }),
    z.object({ type: z.literal("websocket"), data: zWebSocketResponseData }),
  ]),
})
export type ResponseState = z.infer<typeof zResponseState>

//
// Helpers
//

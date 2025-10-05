import { invoke } from "@tauri-apps/api/core"

/**
 * Well-defined error kinds for the application.
 * Serialized as camelCase strings.
 */
export type ErrorKind =
  // File system errors
  | "FileNotFound"
  | "InvalidPath"
  | "PermissionDenied"
  | "FileAlreadyExists"
  | "IoError"

  // Crypto errors
  | "InvalidKeyLength"
  | "DecryptionFailed"
  | "EncryptionFailed"

  // Keyring errors
  | "KeyringPlatformFailure"
  | "KeyringBadEncoding"
  | "KeyringAttributeInvalid"

  // Data format errors
  | "Base64Error"
  | "JsonError"
  // Generic Tauri error
  | "TauriError"

  // Network errors
  | "Timeout"
  | "ConnectionRefused"
  | "HttpError"

  // Request validation / feature
  | "BadRequest"
  | "NotImplemented"

  // User-driven errors
  | "UserCancelled"

/**
 * Minimal backtrace information for an error.
 */
export interface ErrorTrace {
  /** The originating source of the error, if known. */
  source?: string
  /** A cause or underlying reason for the error, if available. */
  cause?: string
  /** Location in code where the error occurred, if known. */
  location?: string
}

/**
 * Main error structure for the application.
 */
export interface AppError {
  /** The classification of the error. */
  kind: ErrorKind
  /** Human-readable description of the error. */
  message: string
  /**
   * Optional contextual key/value data that can help diagnose the issue.
   */
  context?: Record<string, string>
  /**
   * Minimal backtrace information, if available.
   */
  trace?: ErrorTrace
  /**
   * ISO 8601 timestamp of when the error was recorded.
   */
  timestamp: string
}

/**
 * Options for an HTTP request sent via the CurlClient over the Tauri backend.
 * Field names use camelCase to match the serialized/JSON payloads from Rust.
 */
export interface Request {
  /**
   * Unique ID of the request.
   */
  requestId: string

  /**
   * Full request URL.
   */
  url: string

  /**
   * HTTP method (e.g., "GET", "POST").
   */
  method: string

  /**
   * Optional map of header key/value pairs.
   * Keys are case-insensitive per HTTP, but original casing may be preserved by caller.
   */
  headers?: Record<string, string>

  /**
   * Optional request body as raw bytes.
   */
  body?: Uint8Array

  /**
   * If true, disable SSL certificate verification.
   */
  disableSsl: boolean | undefined

  /**
   * Path to a custom root CA bundle (PEM format).
   */
  caPath: string | undefined

  /**
   * Hostname for custom DNS override (e.g., "api.example.com").
   */
  hostOverride: string | undefined

  /**
   * IP address to resolve `hostOverride` to (e.g., "127.0.0.1").
   */
  ipOverride: string | undefined

  /**
   * Timeout in seconds for the request.
   */
  timeoutSecs: number | undefined

  /**
   * User-Agent string to send with the request.
   */
  userAgent: string | undefined

  /**
   * HTTP version preference for this request.
   * - "auto": offer h2 and http/1.1 via ALPN and let server choose
   * - "http1": force http/1.1 only
   * - "http2": force HTTP/2 only
   */
  httpVersion?: "auto" | "http1" | "http2"

  // Backend uses a single HTTP engine (Hyper); deprecated engine selection removed.

  /**
   * Max bytes to log for request/response DATA events.
   * `undefined` means no cap.
   */
  maxLogBytes: number | undefined

  /**
   * If true, redact sensitive header values (Authorization, Cookie, Set-Cookie).
   * Default is false unless explicitly set.
   */
  redactSensitive: boolean | undefined

  /**
   * If false, suppress DATA (body) logs; headers/ssl/debug remain.
   * Default is true (log bodies) unless explicitly set to false.
   */
  logBodies: boolean | undefined

  /**
   * Structured multipart parts for backend-side assembly.
   * When present, backend generates the multipart body and sets Content-Type.
   */
  multipartParts?: MultipartPart[]

  /**
   * If set, backend reads this file from disk and uses its bytes as the raw request body.
   * Ignored when `multipartParts` is present.
   */
  bodyFilePath?: string

  /**
   * Maximum number of redirects to follow automatically. 0 disables.
   */
  maxRedirects?: number

  /**
   * Threshold in bytes before streaming response body to a temp file on disk.
   * Used to keep memory bounded and align with UI preview limits.
   */
  previewMaxBytes?: number
}

export type MultipartPart =
  | { type: "text"; name: string; value: string }
  | { type: "file"; name: string; filePath: string; fileName?: string; contentType?: string }

/**
 * SameSite attribute for cookies.
 * Valid values per modern specs.
 */
export type SameSite = "Strict" | "Lax" | "None"

/**
 * Representation of an HTTP cookie using modern cookie attributes.
 * Optional fields are omitted when unknown (match Rust's skip_serializing_if).
 */
export interface Cookie {
  /** The cookie name. */
  name: string
  /** The cookie value. */
  value: string
  /** Domain the cookie is scoped to (e.g., "example.com"). */
  domain?: string
  /** Path the cookie is scoped to (e.g., "/"). */
  path?: string
  /**
   * Expiration timestamp in RFC 3339 / ISO 8601 format
   * (e.g., "2025-08-13T12:34:56Z").
   * Omitted for session cookies or unknown expiration.
   */
  expires?: string
  /**
   * Max-Age in seconds until expiry. Omitted when unspecified.
   */
  maxAge?: number
  /**
   * Whether the cookie has the Secure attribute.
   * Omitted when unspecified.
   */
  secure?: boolean
  /**
   * Whether the cookie has the HttpOnly attribute.
   * Omitted when unspecified.
   */
  httpOnly?: boolean
  /**
   * SameSite attribute when specified: "Strict" | "Lax" | "None".
   * Omitted when unspecified.
   */
  sameSite?: SameSite
}

/**
 * Structured response returned to the frontend.
 */
export interface Response {
  /** Unique ID of the request this response corresponds to. */
  requestId: string
  /** HTTP status code (e.g., 200). */
  status: number
  /** HTTP status message (e.g., "OK"). */
  statusText: string
  /**
   * List of response headers as [name, value] tuples.
   * Mirrors Rust Vec<(String, String)>.
   */
  headers: Array<[string, string]>
  /**
   * Cookies parsed from the response with structured attributes.
   */
  cookies: Cookie[]
  /**
   * Raw response body bytes.
   */
  body: Uint8Array
  /**
   * Total response size in bytes.
   * Note: JavaScript numbers are IEEE-754 doubles; large 64-bit values may lose precision.
   */
  size: number
  /**
   * Response duration in milliseconds.
   */
  duration: number
  /**
   * Timestamp the response was recorded, ISO 8601 (RFC 3339) string.
   */
  timestamp: string
}

/**
 * Log levels for categorizing different types of logs.
 * Serialized as lowercase strings to match Rust's `#[serde(rename_all = "lowercase")]`.
 */
export type LogLevel = "info" | "debug" | "error" | "warning"

/**
 * Log entry for streaming to the frontend during request execution.
 */
export interface LogEntry {
  /** Unique ID for the related request. */
  requestId: string
  /** Timestamp of the log entry, ISO 8601 string. */
  timestamp: string
  /** Log level/category. */
  level: LogLevel
  /**
   * Type of debug info (when applicable), often a sub-category or phase.
   * Present as null if explicitly set to None on the Rust side.
   */
  infoType?: string | null
  /** The actual log message. */
  message: string
  /** Structured category identifier (dns/connect/tls/http/etc). */
  category?: string
  /** Optional phase within the category (e.g., start/resolved). */
  phase?: string
  /** Milliseconds since the request started when emitted. */
  elapsedMs?: number
  /** Structured payload for the UI (mirrors serde_json::Value). */
  details?: unknown
  /** Number of payload bytes represented by this log entry. */
  bytesLogged?: number
  /** Indicates that the payload was truncated due to log limits. */
  truncated?: boolean
}

/**
 * Narrow type for JSON-like data (serde_json::Value).
 */
export type JsonValue = unknown

export interface FileDialogFilter {
  name: string
  extensions: string[]
}

export interface SaveFileDialogOptions {
  title: string
  defaultPath: string
  filters?: FileDialogFilter[]
}

export interface OpenFileDialogOptions {
  title: string
  filters?: FileDialogFilter[]
  defaultPath?: string
  /** If false, only return the path; don't read file content. Defaults to true. */
  readContent?: boolean
}

export interface OpenedFile {
  filePath: string
  content: string
  mimeType: string
}

/**
 * The error thrown by command wrappers. It's a standard `Error` with an
 * `appError` property containing the structured error from the backend.
 */
export type CommandError = Error & { appError: AppError }

/**
 * Type guard to check if an error from a command is a specific AppError.
 *
 * @param e The error to check.
 * @param kind Optional ErrorKind to match against.
 * @returns True if the error is a CommandError, and (if provided) its kind matches.
 */
export function isCommandError(e: unknown, kind?: ErrorKind | ErrorKind[]): e is CommandError {
  if (!(e instanceof Error) || !("appError" in e) || !e.appError) {
    return false
  }
  const err = e as CommandError
  return kind === undefined || (Array.isArray(kind) ? kind : [kind]).includes(err.appError.kind)
}

/**
 * Type guard: does a value look like an AppError?
 */
export function isAppError(e: unknown, kind?: ErrorKind | ErrorKind[]): e is AppError {
  const is = !!e && typeof e === "object" && "appError" in e
  if (is && kind) {
    return (Array.isArray(kind) ? kind : [kind]).includes((e.appError as AppError)?.kind)
  }
  return is
}

/**
 * Normalize Tauri invoke errors:
 * - If the command returned Result<_, AppError> and failed, unwrap the AppError.
 * - Otherwise rethrow as Error with the original message.
 */
function normalizeInvokeError(err: unknown): never {
  const tryExtractAppError = (value: unknown): AppError | null => {
    const looksLike = (v: unknown): v is AppError =>
      !!v &&
      typeof v === "object" &&
      "kind" in (v as Record<string, unknown>) &&
      "message" in (v as Record<string, unknown>) &&
      "timestamp" in (v as Record<string, unknown>)
    if (looksLike(value)) {
      return value
    }
    if (value && typeof value === "object") {
      const obj = value as {
        appError?: unknown
        payload?: unknown
        cause?: unknown
        error?: unknown
        message?: unknown
        toString?: () => string
      }
      if (looksLike(obj.appError)) {
        return obj.appError
      }
      if (looksLike(obj.payload)) {
        return obj.payload
      }
      if (looksLike(obj.cause)) {
        return obj.cause
      }
      if (looksLike(obj.error)) {
        return obj.error
      }
      // Some environments may stringify the payload into the message
      const msg: unknown = obj.message ?? (typeof obj.toString === "function" ? obj.toString() : undefined)
      if (typeof msg === "string" && msg.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(msg)
          if (looksLike(parsed)) {
            return parsed
          }
        } catch {
          // ignore
        }
      }
    }
    return null
  }
  // Tauri wraps errors; `err` may be a string, Error, or a structured payload.
  const extracted = tryExtractAppError(err)
  if (extracted) {
    const e = extracted
    // Build a richer error message including trace/cause/context when available.
    const parts: string[] = [`[${e.kind}] ${e.message}`]
    if (e.trace?.cause) {
      parts.push(`cause: ${e.trace.cause}`)
    }
    if (e.trace?.source) {
      parts.push(`source: ${e.trace.source}`)
    }
    if (e.trace?.location) {
      parts.push(`at: ${e.trace.location}`)
    }
    if (e.context && Object.keys(e.context).length > 0) {
      try {
        parts.push(`context: ${JSON.stringify(e.context)}`)
      } catch {
        // ignore stringify errors
      }
    }
    const msg = parts.join(" | ")
    const ex = new Error(msg)
    ;(ex as Error & { appError?: AppError }).appError = e
    throw ex
  }
  if (typeof err === "string") {
    throw new Error(err)
  }
  if (err instanceof Error) {
    throw err
  }
  throw new Error(String(err))
}

/**
 * Send an HTTP request through the Rust backend (Hyper engine) with logging enabled.
 * Mirrors `send_http_request` Tauri command.
 *
 * @param opts Request options (headers as map, body as raw bytes, etc.)
 * @returns Structured response data from the backend.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function sendHttpRequest(opts: Request): Promise<Response> {
  try {
    return await invoke<Response>("send_http_request", { opts })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Load an application data file.
 * Mirrors `fn load_app_data(app, file_name) -> Result<Value, AppError>`.
 *
 * @param fileName Name of the file to load (no path traversal).
 * @returns Parsed JSON value from the file.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function loadAppData(fileName: string): Promise<JsonValue> {
  try {
    return await invoke<JsonValue>("load_app_data", { fileName })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Save an application data file.
 * Mirrors `fn save_app_data(app, file_name, data) -> Result<(), AppError>`.
 *
 * @param fileName Target filename (no path traversal).
 * @param data JSON-serializable content to write.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function saveAppData(fileName: string, data: JsonValue): Promise<void> {
  try {
    await invoke<void>("save_app_data", { fileName, data })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Delete an application data file.
 * Mirrors `fn delete_app_data(app, file_name) -> Result<(), AppError>`.
 *
 * @param fileName Name of the file to delete.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function deleteAppData(fileName: string): Promise<void> {
  try {
    await invoke<void>("delete_app_data", { fileName })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Retrieves the data encryption key by invoking the "get_data_encryption_key" method.
 * Mirrors `fn get_data_encryption_key(app: tauri::AppHandle) -> Result<String, AppError>`
 *
 * @return {Promise<string>} A promise that resolves to the encryption key as a string.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function getDataEncryptionKey(): Promise<string> {
  try {
    return await invoke<string>("get_data_encryption_key")
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Sets the data encryption key by invoking the "set_data_encryption_key" method.
 * Mirrors `fn set_data_encryption_key(app: tauri::AppHandle, key_b64: String) -> Result<(), AppError>`
 *
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function setDataEncryptionKey(key: string): Promise<void> {
  try {
    await invoke<void>("set_data_encryption_key", { keyB64: key })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Retrieves the application's data directory path.
 * Mirrors `fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, AppError>`.
 *
 * @returns {Promise<string>} A promise that resolves to the data directory path.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function getAppDataDir(): Promise<string> {
  try {
    return await invoke<string>("get_app_data_dir")
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Prompts the user to select a location and saves content to a file.
 * Mirrors `async fn save_file(app: tauri::AppHandle, content: String, options: SaveFileDialogOptions) -> Result<(), AppError>`.
 *
 * @param content The string content to save.
 * @param options The dialog options.
 * @throws Error whose `.appError` will be `UserCancelled` if the user cancels.
 */
export async function saveFile(content: string, options: SaveFileDialogOptions): Promise<string> {
  try {
    return await invoke<string>("save_file", { content, options })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Saves base64-encoded binary content to a user-chosen file.
 * Mirrors `async fn save_binary(app: tauri::AppHandle, content_base64: String, options: SaveFileDialogOptions)`.
 */
export async function saveBinary(contentBase64: string, options: SaveFileDialogOptions): Promise<string> {
  try {
    return await invoke<string>("save_binary", { contentBase64, options })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Prompts the user to select a file and returns its content.
 * Mirrors `async fn open_file(app: tauri::AppHandle, options: OpenFileDialogOptions) -> Result<Option<String>, AppError>`.
 *
 * @param options The dialog options.
 * @returns The content of the selected file, or `null` if the user canceled.
 * @throws Error whose `.appError` will be `UserCancelled` if the user cancels.
 */
export async function openFile(options: OpenFileDialogOptions): Promise<OpenedFile | null> {
  try {
    return await invoke<OpenedFile | null>("open_file", { options })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/** Delete a file from disk (best-effort; no error if missing). */
export async function deleteFile(path: string): Promise<void> {
  try {
    await invoke<void>("delete_file", { path })
  } catch {
    // best effort
  }
}

export interface AuthPlacement {
  type: string
  name?: string
  fieldName?: string
  contentType?: string
}

export interface AuthConfig {
  type: string
  placement?: AuthPlacement
  username?: string
  password?: string
  token?: string
  // Optional scheme for Authorization header (e.g., "Bearer", "JWT", or custom)
  scheme?: string
  key?: string
  value?: string
  grantType?: "client_credentials" | "password" | "refresh_token" | "authorization_code" | "device_code"
  authUrl?: string
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
  scope?: string
  refreshToken?: string
  redirectUri?: string
  usePkce?: boolean
  tokenCaching?: "always" | "never"
  clientAuth?: "basic" | "body"
  tokenExtraParams?: Record<string, string>
}

export interface AuthResult {
  headers?: Record<string, string>
  query?: Record<string, string>
  cookies?: Record<string, string>
  body?: Record<string, unknown>
  expiresAt?: number
}

export interface OidcDiscovery {
  authorizationEndpoint?: string
  tokenEndpoint?: string
  deviceAuthorizationEndpoint?: string
}

/**
 * Retrieves the result of an authentication flow.
 * Mirrors `async fn get_authentication_result(config: AuthConfig) -> Result<AuthResult, String>`.
 *
 * @param config The authentication configuration.
 * @returns The result of the authentication flow.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function getAuthenticationResult(config: AuthConfig, parentRequestId?: string): Promise<AuthResult> {
  try {
    return await invoke<AuthResult>("get_authentication_result", { config, parent_request_id: parentRequestId })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Discovers OIDC endpoints.
 * Mirrors `async fn discover_oidc(app: tauri::AppHandle, url: String) -> Result<OidcDiscovery, String>`.
 *
 * @param url The base URL of the OIDC provider.
 * @returns The discovered endpoints.
 * @throws Error whose `.appError` (if present) contains the structured `AppError`.
 */
export async function discoverOidc(url: string): Promise<OidcDiscovery> {
  try {
    return await invoke<OidcDiscovery>("discover_oidc", { url })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

/**
 * Cancel an in-flight HTTP request by its requestId/correlationId.
 */
export async function cancelHttpRequest(requestId: string): Promise<void> {
  try {
    await invoke<void>("cancel_http_request", { requestId })
  } catch (err) {
    normalizeInvokeError(err)
  }
}

import type { MultipartPart } from "@/bindings/knurl"
import type { AuthResult, RequestState } from "@/types"

type PreparedTextBody = {
  mode: "text" | "urlencoded"
  value: string
}

type PreparedMultipartBody = {
  mode: "multipart"
  parts: MultipartPart[]
}

type PreparedBinaryBody = {
  mode: "binary"
  filePath: string
}

type PreparedEmptyBody = {
  mode: "none"
}

export type PreparedHttpBody = PreparedTextBody | PreparedMultipartBody | PreparedBinaryBody | PreparedEmptyBody

export type PreparedHttpRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: PreparedHttpBody
  options: PreparedHttpOptions
}

type PrepareOptions = {
  request: RequestState
  authResult?: AuthResult
}

export type PreparedHttpOptions = {
  disableSsl?: boolean
  caPath?: string
  hostOverride?: string
  ipOverride?: string
  timeoutSecs?: number
  userAgent?: string
  httpVersion?: "auto" | "http1" | "http2"
  maxRedirects?: number
  maxLogBytes?: number
  redactSensitive?: boolean
  logBodies?: boolean
}

const BASIC_CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  yaml: "application/yaml",
  xml: "application/xml",
  html: "text/html",
  javascript: "application/javascript",
  css: "text/css",
  graphql: "application/json",
  text: "text/plain",
}

const COOKIE_HEADER = "cookie"

export function prepareHttpRequest({ request, authResult }: PrepareOptions): PreparedHttpRequest {
  if (!request.url) {
    throw new Error("Request is missing a URL. Enter a URL (e.g., https://api.example.com/users)")
  }

  const url = buildUrl(request, authResult)
  validateUrl(url)
  const headers = buildHeaders(request, authResult)
  const body = buildBody(request, authResult, headers)
  const options = buildOptions(request)

  return {
    method: request.method,
    url,
    headers,
    body,
    options,
  }
}

function buildUrl(request: RequestState, authResult?: AuthResult): string {
  let urlValue = request.url

  // Substitute path params that may remain unresolved (safety net)
  if (request.pathParams) {
    for (const pathParam of Object.values(request.pathParams)) {
      if (!pathParam?.enabled || !pathParam.name) {
        continue
      }
      const pattern = new RegExp(`\\{\\{${escapeRegExp(pathParam.name)}\\}\\}`, "g")
      urlValue = urlValue.replace(pattern, pathParam.value)
    }
  }

  // Check for unresolved environment variables in the URL
  const unresolvedVars = extractUnresolvedVariables(urlValue)
  if (unresolvedVars.length > 0) {
    const varList = unresolvedVars.join(", ")
    throw new Error(
      `Unknown environment variable(s): ${varList}. Check your active environment or add these variables.`,
    )
  }

  try {
    const url = new URL(urlValue)
    if (request.queryParams) {
      for (const query of Object.values(request.queryParams)) {
        if (query?.enabled && query.name) {
          url.searchParams.append(query.name, query.value)
        }
      }
    }
    if (authResult?.query) {
      for (const [key, value] of Object.entries(authResult.query)) {
        if (value === undefined || value === null) {
          continue
        }
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  } catch (_error) {
    const hasScheme = /^[a-zA-Z][\w+.-]*:\/\//.test(urlValue)
    if (hasScheme && !/^[a-zA-Z][\w+.-]*:\/\/[^/?#]+/.test(urlValue)) {
      throw new Error(`Invalid URL: host is missing. Check your URL format (e.g., https://example.com)`)
    }
    if (!hasScheme) {
      throw new Error(`Invalid URL: must start with http:// or https://. Got: "${urlValue}"`)
    }
    // Fallback to manual concatenation if URL constructor fails
    const parts: string[] = []
    if (request.queryParams) {
      for (const query of Object.values(request.queryParams)) {
        if (query?.enabled && query.name) {
          parts.push(`${query.name}=${encodeURIComponent(query.value)}`)
        }
      }
    }
    if (authResult?.query) {
      for (const [key, value] of Object.entries(authResult.query)) {
        if (value === undefined || value === null) {
          continue
        }
        parts.push(`${key}=${encodeURIComponent(String(value))}`)
      }
    }
    if (parts.length === 0) {
      return urlValue
    }
    const separator = urlValue.includes("?") ? "&" : "?"
    const fallback = parts.length > 0 ? `${urlValue}${separator}${parts.join("&")}` : urlValue
    if (hasScheme) {
      // Ensure fallback is still a valid absolute URL
      new URL(fallback)
    }
    return fallback
  }
}

function buildHeaders(request: RequestState, authResult?: AuthResult): Record<string, string> {
  const headers: Record<string, string> = {}

  if (request.headers) {
    for (const header of Object.values(request.headers)) {
      if (!header?.enabled || !header.name) {
        continue
      }
      headers[header.name] = header.value
    }
  }

  if (request.cookieParams) {
    const combined = combineCookieValues(headers, request.cookieParams)
    if (combined) {
      headers[combined.key] = combined.value
    }
  }

  if (authResult?.headers) {
    for (const [key, value] of Object.entries(authResult.headers)) {
      if (value === undefined || value === null) {
        continue
      }
      const existingKey = findHeaderKey(headers, key)
      if (!existingKey) {
        headers[key] = String(value)
      }
    }
  }

  if (authResult?.cookies) {
    const additional = Object.entries(authResult.cookies).reduce((map, [key, value]) => {
      if (value === undefined || value === null) {
        return map
      }
      map.set(key, String(value))
      return map
    }, new Map<string, string>())

    if (additional.size > 0) {
      const cookieKey = findHeaderKey(headers, COOKIE_HEADER) ?? "Cookie"
      const existing = headers[cookieKey]
      const appended = joinCookieHeader(additional)
      headers[cookieKey] = existing ? `${existing}; ${appended}` : appended
    }
  }

  return headers
}

function buildBody(
  request: RequestState,
  authResult: AuthResult | undefined,
  headers: Record<string, string>,
): PreparedHttpBody {
  const body = request.body
  if (!body || body.type === "none" || request.method === "GET" || request.method === "HEAD") {
    return { mode: "none" }
  }

  const authBodyEntries: Array<[string, string]> = authResult?.body
    ? Object.entries(authResult.body)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value as unknown as string)])
    : []

  if (body.type === "text") {
    if (authBodyEntries.length > 0) {
      throw new Error("Auth placement 'body' is only supported with form bodies (URL-encoded or Multipart).")
    }
    ensureContentType(headers, body.language ?? "text")
    return body.content ? { mode: "text", value: body.content } : { mode: "none" }
  }

  if (body.type === "form") {
    const encoding = body.encoding ?? "url"
    const entries = Object.values(body.formData ?? {}).filter((field) => field?.enabled)

    if (encoding === "url") {
      if (entries.some((field) => (field.kind ?? "text") === "file")) {
        throw new Error(
          "File fields are not supported with application/x-www-form-urlencoded. Use Multipart or Binary Body.",
        )
      }
      const form = new URLSearchParams()
      for (const field of entries) {
        form.append(field.key, field.value)
      }
      for (const [key, value] of authBodyEntries) {
        form.set(key, value)
      }
      setHeaderIfMissing(headers, "Content-Type", "application/x-www-form-urlencoded")
      return { mode: "urlencoded", value: form.toString() }
    }

    if (encoding === "plain") {
      if (entries.some((field) => (field.kind ?? "text") === "file")) {
        throw new Error("File fields are not supported with text/plain form encoding. Use Multipart or Binary Body.")
      }
      if (authBodyEntries.length > 0) {
        throw new Error(
          "Auth placement 'body' is not supported with text/plain form encoding. Use URL-encoded or Multipart.",
        )
      }
      const text = entries.map((field) => `${field.key}=${field.value}`).join("\n")
      setHeaderIfMissing(headers, "Content-Type", "text/plain")
      return text ? { mode: "text", value: text } : { mode: "none" }
    }

    if (encoding === "multipart") {
      const parts: MultipartPart[] = []
      for (const field of entries) {
        if (field.kind === "file") {
          if (!field.filePath) {
            continue
          }
          parts.push({
            type: "file",
            name: field.key,
            filePath: field.filePath,
            fileName: field.fileName,
            contentType: field.contentType,
          })
        } else {
          parts.push({ type: "text", name: field.key, value: field.value })
        }
      }
      for (const [key, value] of authBodyEntries) {
        parts.push({ type: "text", name: key, value })
      }
      return { mode: "multipart", parts }
    }
  }

  if (body.type === "binary") {
    if (!body.binaryPath) {
      return { mode: "none" }
    }
    if (body.binaryContentType) {
      setHeaderIfMissing(headers, "Content-Type", body.binaryContentType)
    }
    return { mode: "binary", filePath: body.binaryPath }
  }

  return { mode: "none" }
}

function buildOptions(request: RequestState): PreparedHttpOptions {
  const raw = request.options ?? {}
  const options: PreparedHttpOptions = {}

  if (raw.disableSsl !== undefined) {
    options.disableSsl = raw.disableSsl
  }

  if (raw.caPath) {
    const trimmed = raw.caPath.trim()
    if (trimmed.length > 0) {
      options.caPath = trimmed
    }
  }

  let parsedHostOverride: HostOverrideParts | undefined
  if (raw.hostOverride) {
    const trimmed = raw.hostOverride.trim()
    if (trimmed.length > 0) {
      parsedHostOverride = parseHostOverride(trimmed)
      if (parsedHostOverride.hostPort.length > 0) {
        options.hostOverride = parsedHostOverride.hostPort
      }
    }
  }

  const explicitIp = raw.ipOverride?.trim()
  const overrideIp = explicitIp && explicitIp.length > 0 ? explicitIp : parsedHostOverride?.ip
  if (overrideIp && overrideIp.length > 0) {
    options.ipOverride = overrideIp
  }

  if (raw.timeoutSecs !== undefined && raw.timeoutSecs !== null) {
    const numeric = coerceNumber(raw.timeoutSecs)
    if (numeric !== undefined) {
      options.timeoutSecs = numeric
    }
  }

  if (raw.userAgent) {
    const trimmed = raw.userAgent.trim()
    if (trimmed.length > 0) {
      options.userAgent = trimmed
    }
  }

  if (raw.httpVersion) {
    options.httpVersion = raw.httpVersion
  }

  if (raw.maxRedirects !== undefined) {
    options.maxRedirects = raw.maxRedirects
  }

  if (raw.maxLogBytes !== undefined && raw.maxLogBytes !== null) {
    const numeric = coerceNumber(raw.maxLogBytes)
    if (numeric !== undefined) {
      options.maxLogBytes = numeric
    }
  }

  if (raw.redactSensitive !== undefined) {
    options.redactSensitive = Boolean(raw.redactSensitive)
  }

  if (raw.logBodies !== undefined) {
    options.logBodies = Boolean(raw.logBodies)
  }

  return options
}

function ensureContentType(headers: Record<string, string>, language: string) {
  const inferred = BASIC_CONTENT_TYPES[language]
  if (!inferred) {
    return
  }
  setHeaderIfMissing(headers, "Content-Type", inferred)
}

function combineCookieValues(
  headers: Record<string, string>,
  cookieParams: RequestState["cookieParams"],
): { key: string; value: string } | null {
  if (!cookieParams) {
    return null
  }
  const dedup = new Map<string, string>()
  for (const cookie of Object.values(cookieParams)) {
    if (cookie?.enabled && cookie.name) {
      dedup.set(cookie.name, cookie.value)
    }
  }
  if (dedup.size === 0) {
    return null
  }
  const key = findHeaderKey(headers, COOKIE_HEADER) ?? "Cookie"
  const value = joinCookieHeader(dedup)
  return value ? { key, value } : null
}

function joinCookieHeader(entries: Map<string, string>): string {
  if (entries.size === 0) {
    return ""
  }
  return Array.from(entries.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ")
}

function setHeaderIfMissing(headers: Record<string, string>, name: string, value: string) {
  const existingKey = findHeaderKey(headers, name)
  if (!existingKey) {
    headers[name] = value
  }
}

function findHeaderKey(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase()
  return Object.keys(headers).find((header) => header.toLowerCase() === target)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function coerceNumber(value: number | string): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

type HostOverrideParts = {
  hostPort: string
  ip?: string
}

function parseHostOverride(value: string): HostOverrideParts {
  const trimmed = value.trim()
  if (!trimmed) {
    return { hostPort: "" }
  }

  if (trimmed.startsWith("[")) {
    const closingIndex = trimmed.indexOf("]")
    if (closingIndex === -1) {
      return { hostPort: trimmed }
    }
    const hostToken = trimmed.slice(0, closingIndex + 1)
    const remainder = trimmed.slice(closingIndex + 1)
    if (!remainder) {
      return { hostPort: hostToken }
    }
    const segments = remainder.split(":").filter((segment) => segment.length > 0)
    if (segments.length === 0) {
      return { hostPort: hostToken }
    }
    const port = segments[0]
    const ip = segments.length > 1 ? segments.slice(1).join(":") : undefined
    return {
      hostPort: `${hostToken}:${port}`,
      ip,
    }
  }

  const segments = trimmed.split(":")
  if (segments.length <= 2) {
    return { hostPort: trimmed }
  }
  const ip = segments.pop()
  return {
    hostPort: segments.join(":"),
    ip,
  }
}

function extractUnresolvedVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) ?? []
  return matches.map((match) => match.slice(2, -2))
}

function validateUrl(url: string): void {
  if (!url) {
    throw new Error("Request is missing a URL. Enter a URL (e.g., https://api.example.com/users)")
  }
  const hasScheme = /^[a-zA-Z][\w+.-]*:\/\//.test(url)
  if (!hasScheme) {
    throw new Error(`Invalid URL: must start with http:// or https://. Got: "${url}"`)
  }
}

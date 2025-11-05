import { resolveRequestVariables } from "@/lib/environments"
import { type PreparedHttpRequest, prepareHttpRequest } from "@/lib/request/prepared-http"
import { assert } from "@/lib/utils"
import type { AuthConfig, AuthResult, Collection, CredentialsCacheApi, Environment, RequestState } from "@/types"

const BASIC_SCHEME = "Basic"
const DEFAULT_BEARER_SCHEME = "Bearer"

type ExportFormat = "curl" | "wget" | "fetch"

type PrepareOptions = {
  request: RequestState
  collection: Collection
  environment?: Environment
  credentialsCacheApi: CredentialsCacheApi
}

export async function buildExportCommand(format: ExportFormat, options: PrepareOptions): Promise<string> {
  const prepared = await prepareForExport(options)
  switch (format) {
    case "curl":
      return buildCurlCommand(prepared)
    case "wget":
      return buildWgetCommand(prepared)
    case "fetch":
      return buildFetchSnippet(prepared)
    default:
      assert(false, `Unsupported export format: ${format satisfies never}`)
  }
}

async function prepareForExport(options: PrepareOptions): Promise<PreparedHttpRequest> {
  const { request, collection, environment, credentialsCacheApi } = options
  const resolved = resolveRequestVariables(structuredClone(request), environment)
  const authResult = await resolveAuthResult(resolved, collection, credentialsCacheApi)
  return prepareHttpRequest({ request: resolved, authResult })
}

function buildCurlCommand(prepared: PreparedHttpRequest): string {
  const parts: string[] = []
  parts.push("curl")
  parts.push("-X")
  parts.push(shellQuote(prepared.method.toUpperCase()))
  parts.push(shellQuote(prepared.url))

  const dnsInfo = extractDnsOverride(prepared)
  const headers = buildEffectiveHeaders(prepared, dnsInfo, { includeUserAgent: false })
  for (const [name, value] of Object.entries(headers)) {
    parts.push("-H")
    parts.push(shellQuote(`${name}: ${value}`))
  }

  appendBodyForCurl(parts, prepared)
  appendOptionsForCurl(parts, prepared, dnsInfo)

  return parts.join(" ")
}

function appendBodyForCurl(parts: string[], prepared: PreparedHttpRequest) {
  const { body } = prepared
  switch (body.mode) {
    case "none":
      return
    case "text":
    case "urlencoded":
      parts.push("--data-raw")
      parts.push(shellQuote(body.value))
      return
    case "binary":
      parts.push("--data-binary")
      parts.push(shellQuote(`@${body.filePath}`))
      return
    case "multipart":
      for (const part of body.parts) {
        if (part.type === "file") {
          const metadata: string[] = []
          if (part.fileName) {
            metadata.push(`filename="${part.fileName}"`)
          }
          if (part.contentType) {
            metadata.push(`type=${part.contentType}`)
          }
          const prefix = metadata.length > 0 ? `${metadata.join(";")}@${part.filePath}` : `@${part.filePath}`
          parts.push("-F")
          parts.push(shellQuote(`${part.name}=${prefix}`))
        } else {
          parts.push("-F")
          parts.push(shellQuote(`${part.name}=${part.value}`))
        }
      }
  }
}

function buildWgetCommand(prepared: PreparedHttpRequest): string {
  const parts: string[] = []
  parts.push("wget")
  parts.push(`--method=${shellQuote(prepared.method.toUpperCase())}`)
  parts.push(shellQuote(prepared.url))

  const dnsInfo = extractDnsOverride(prepared)
  const headers = buildEffectiveHeaders(prepared, dnsInfo, { includeUserAgent: false })
  for (const [name, value] of Object.entries(headers)) {
    parts.push(`--header=${shellQuote(`${name}: ${value}`)}`)
  }

  appendBodyForWget(parts, prepared)
  appendOptionsForWget(parts, prepared, dnsInfo)

  return parts.join(" ")
}

function appendBodyForWget(parts: string[], prepared: PreparedHttpRequest) {
  const { body } = prepared
  switch (body.mode) {
    case "none":
      return
    case "text":
    case "urlencoded":
      parts.push(`--body-data=${shellQuote(body.value)}`)
      return
    case "binary":
      parts.push(`--body-file=${shellQuote(body.filePath)}`)
      return
    case "multipart":
      throw new Error("Exporting multipart form data is not supported for wget.")
  }
}

function buildFetchSnippet(prepared: PreparedHttpRequest): string {
  const lines: string[] = []
  lines.push(`fetch(${jsonQuote(prepared.url)}, {`)
  lines.push(`  method: ${jsonQuote(prepared.method.toUpperCase())},`)

  const dnsInfo = extractDnsOverride(prepared)
  const headers = buildEffectiveHeaders(prepared, dnsInfo, { includeUserAgent: true })
  const headerEntries = Object.entries(headers)
  if (headerEntries.length > 0) {
    lines.push("  headers: {")
    for (const [name, value] of headerEntries) {
      lines.push(`    ${jsonQuote(name)}: ${jsonQuote(value)},`)
    }
    lines.push("  },")
  }

  appendBodyForFetch(lines, prepared)
  appendOptionsForFetch(lines, prepared, dnsInfo)

  lines.push("});")
  return lines.join("\n")
}

function appendBodyForFetch(lines: string[], prepared: PreparedHttpRequest) {
  const { body } = prepared
  switch (body.mode) {
    case "none":
      return
    case "text":
    case "urlencoded":
      lines.push(`  body: ${jsonQuote(body.value)},`)
      return
    case "binary":
      lines.push("  // TODO: Replace with ArrayBuffer or Blob of your binary payload.")
      lines.push(`  body: /* readFileSync(${jsonQuote(body.filePath)}) */ undefined,`)
      return
    case "multipart":
      lines.push("  // TODO: Populate a FormData instance with the multipart fields.")
      lines.push("  body: /* new FormData() */ undefined,")
      return
  }
}

function appendOptionsForCurl(parts: string[], prepared: PreparedHttpRequest, dnsInfo: DnsOverrideInfo | undefined) {
  const { options } = prepared
  if (options.disableSsl) {
    parts.push("--insecure")
  }
  if (options.caPath) {
    parts.push("--cacert")
    parts.push(shellQuote(options.caPath))
  }
  if (typeof options.timeoutSecs === "number") {
    parts.push("--max-time")
    parts.push(shellQuote(String(options.timeoutSecs)))
  }
  if (options.userAgent) {
    parts.push("-A")
    parts.push(shellQuote(options.userAgent))
  }
  if (options.httpVersion === "http1") {
    parts.push("--http1.1")
  } else if (options.httpVersion === "http2") {
    parts.push("--http2")
  }
  if (typeof options.maxRedirects === "number") {
    parts.push("--max-redirs")
    parts.push(shellQuote(String(options.maxRedirects)))
  }
  if (dnsInfo?.resolve) {
    const entry = dnsInfo.resolve
    parts.push("--resolve")
    parts.push(shellQuote(`${entry.host}:${entry.port}:${entry.ip}`))
  }
}

function appendOptionsForWget(parts: string[], prepared: PreparedHttpRequest, dnsInfo: DnsOverrideInfo | undefined) {
  const { options } = prepared
  if (options.disableSsl) {
    parts.push("--no-check-certificate")
  }
  if (options.caPath) {
    parts.push(`--ca-certificate=${shellQuote(options.caPath)}`)
  }
  if (typeof options.timeoutSecs === "number") {
    parts.push(`--timeout=${shellQuote(String(options.timeoutSecs))}`)
  }
  if (typeof options.maxRedirects === "number") {
    parts.push(`--max-redirect=${shellQuote(String(options.maxRedirects))}`)
  }
  if (options.userAgent) {
    parts.push(`--user-agent=${shellQuote(options.userAgent)}`)
  }
  if (dnsInfo?.resolve) {
    const entry = dnsInfo.resolve
    parts.push(`--resolve=${shellQuote(`${entry.host}:${entry.port}:${entry.ip}`)}`)
  }
}

function appendOptionsForFetch(lines: string[], prepared: PreparedHttpRequest, dnsInfo: DnsOverrideInfo | undefined) {
  const notes: string[] = []
  const { options } = prepared
  if (options.disableSsl) {
    notes.push("configure HTTPS agent to disable certificate verification")
  }
  if (options.caPath) {
    notes.push(`load CA bundle from ${options.caPath}`)
  }
  if (typeof options.timeoutSecs === "number") {
    notes.push(`enforce a ${options.timeoutSecs}s timeout (e.g., AbortController)`)
  }
  if (typeof options.maxRedirects === "number") {
    notes.push(`limit redirects to ${options.maxRedirects}`)
  }
  if (options.httpVersion && options.httpVersion !== "auto") {
    notes.push(`force HTTP/${options.httpVersion.replace("http", "")} via a custom agent`)
  }
  if (dnsInfo?.resolve) {
    const entry = dnsInfo.resolve
    notes.push(`map ${entry.host}:${entry.port} to ${entry.ip}`)
  }
  if (notes.length > 0) {
    lines.push("  // Additional client options to mirror:")
    for (const note of notes) {
      lines.push(`  // - ${note}`)
    }
  }
}

type DnsOverrideInfo = {
  hostHeader?: string
  resolve?: {
    host: string
    port: number
    ip: string
  }
}

function extractDnsOverride(prepared: PreparedHttpRequest): DnsOverrideInfo | undefined {
  const { hostOverride, ipOverride } = prepared.options
  if (!hostOverride && !ipOverride) {
    return undefined
  }

  let hostname: string
  let defaultPort: number
  try {
    const parsed = new URL(prepared.url)
    hostname = parsed.hostname
    defaultPort = parsed.port ? Number.parseInt(parsed.port, 10) : determineDefaultPort(parsed.protocol)
  } catch {
    return undefined
  }

  const { host, port } = splitHostAndPort(hostOverride, hostname, defaultPort)
  const info: DnsOverrideInfo = {}

  if (host && (host !== hostname || port !== defaultPort)) {
    info.hostHeader = port === defaultPort ? host : `${host}:${port}`
  }

  const ip = ipOverride?.trim()
  if (ip && ip.length > 0) {
    info.resolve = { host, port, ip }
  }

  if (!info.hostHeader && !info.resolve) {
    return undefined
  }
  return info
}

function buildEffectiveHeaders(
  prepared: PreparedHttpRequest,
  dnsInfo: DnsOverrideInfo | undefined,
  options: { includeUserAgent: boolean },
): Record<string, string> {
  const headers: Record<string, string> = { ...prepared.headers }
  if (dnsInfo?.hostHeader && !hasHeader(headers, "host")) {
    headers.Host = dnsInfo.hostHeader
  }
  if (options.includeUserAgent && prepared.options.userAgent && !hasHeader(headers, "user-agent")) {
    headers["User-Agent"] = prepared.options.userAgent
  }
  return headers
}

function hasHeader(headers: Record<string, string>, target: string): boolean {
  const lower = target.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === lower)
}

function splitHostAndPort(
  raw: string | undefined,
  fallbackHost: string,
  fallbackPort: number,
): { host: string; port: number } {
  if (!raw) {
    return { host: fallbackHost, port: fallbackPort }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { host: fallbackHost, port: fallbackPort }
  }
  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    const closing = trimmed.indexOf("]")
    const hostPart = trimmed.slice(0, closing + 1)
    const remainder = trimmed.slice(closing + 1)
    if (remainder.startsWith(":")) {
      const portCandidate = Number.parseInt(remainder.slice(1), 10)
      if (Number.isFinite(portCandidate)) {
        return { host: hostPart, port: portCandidate }
      }
    }
    return { host: hostPart, port: fallbackPort }
  }
  const colonIndex = trimmed.lastIndexOf(":")
  if (colonIndex > -1 && /^\d+$/.test(trimmed.slice(colonIndex + 1))) {
    const hostPart = trimmed.slice(0, colonIndex)
    const portCandidate = Number.parseInt(trimmed.slice(colonIndex + 1), 10)
    if (Number.isFinite(portCandidate)) {
      return { host: hostPart, port: portCandidate }
    }
  }
  return { host: trimmed, port: fallbackPort }
}

function determineDefaultPort(protocol: string): number {
  switch (protocol) {
    case "https:":
      return 443
    case "http:":
      return 80
    default:
      return 80
  }
}

async function resolveAuthResult(
  request: RequestState,
  collection: Collection,
  credentialsCacheApi: CredentialsCacheApi,
): Promise<AuthResult | undefined> {
  const auth = request.authentication
  const effectiveAuth = auth.type === "inherit" ? collection.authentication : auth
  switch (effectiveAuth.type) {
    case "none":
      return undefined
    case "inherit":
      return undefined
    case "basic":
      return buildBasicAuthResult(effectiveAuth)
    case "bearer":
      return buildBearerAuthResult(effectiveAuth)
    case "apiKey":
      return buildApiKeyAuthResult(effectiveAuth)
    case "oauth2": {
      const cacheKey =
        auth.type === "inherit"
          ? credentialsCacheApi.generateCollectionCacheKey(collection.id)
          : credentialsCacheApi.generateCacheKey(request.id)
      const cached = await credentialsCacheApi.get(cacheKey)
      return cached ?? undefined
    }
    default:
      return undefined
  }
}

function buildBasicAuthResult(auth: AuthConfig & { type: "basic" }): AuthResult {
  const username = auth.basic?.username ?? ""
  const password = auth.basic?.password ?? ""
  const token = base64Encode(`${username}:${password}`)
  return {
    headers: {
      Authorization: `${BASIC_SCHEME} ${token}`,
    },
  }
}

function buildBearerAuthResult(auth: AuthConfig & { type: "bearer" }): AuthResult | undefined {
  const token = auth.bearer?.token
  if (!token) {
    return undefined
  }
  const scheme = auth.bearer?.scheme || DEFAULT_BEARER_SCHEME
  const placement = auth.bearer?.placement ?? { type: "header", name: "Authorization" }
  switch (placement.type) {
    case "header": {
      const name = placement.name || "Authorization"
      return { headers: { [name]: `${scheme} ${token}`.trim() } }
    }
    case "query": {
      const name = placement.name || "access_token"
      return { query: { [name]: token } }
    }
    case "cookie": {
      const name = placement.name || "access_token"
      return { cookies: { [name]: token } }
    }
    case "body": {
      const fieldName = placement.fieldName || "access_token"
      return { body: { [fieldName]: token } }
    }
    default:
      return undefined
  }
}

function buildApiKeyAuthResult(auth: AuthConfig & { type: "apiKey" }): AuthResult | undefined {
  const key = auth.apiKey?.key
  const value = auth.apiKey?.value ?? ""
  if (!key) {
    return undefined
  }
  const placement = auth.apiKey?.placement ?? { type: "header", name: key }
  switch (placement.type) {
    case "header": {
      const name = placement.name || key
      return { headers: { [name]: value } }
    }
    case "query": {
      const name = placement.name || key
      return { query: { [name]: value } }
    }
    case "cookie": {
      const name = placement.name || key
      return { cookies: { [name]: value } }
    }
    case "body": {
      const fieldName = placement.fieldName || key
      return { body: { [fieldName]: value } }
    }
    default:
      return undefined
  }
}

function shellQuote(value: string): string {
  if (value === "") {
    return "''"
  }
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function jsonQuote(value: string): string {
  return JSON.stringify(value)
}

function base64Encode(value: string): string {
  if (typeof btoa === "function") {
    return btoa(value)
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64")
  }
  throw new Error("No base64 encoder available in this environment.")
}

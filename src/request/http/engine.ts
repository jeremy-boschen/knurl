import { sendHttpRequest, type MultipartPart } from "@/bindings/knurl"
import { useApplication } from "@/state/application"
import { generateUniqueId } from "@/lib/utils"
import type { RequestContext, RequestEngine } from "@/request/pipeline"
import { type HttpResponseData, type ResponseState, zHttpResponseData, zResponseState } from "@/types"

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\\]/g, "\\$&")
}

export const HttpEngine: RequestEngine = {
  async execute(context: RequestContext): Promise<ResponseState> {
    const { request, authResult } = context

    // --- 1. Construct Final URL with Query Params ---
    let urlString = request.url
    // First, substitute path parameters in the URL
    if (request.pathParams) {
      for (const pathParam of Object.values(request.pathParams)) {
        if (pathParam.enabled && pathParam.name && pathParam.value) {
          const pattern = `{{${pathParam.name}}}`
          urlString = urlString.replace(new RegExp(escapeRegExp(pattern), "g"), pathParam.value)
        }
      }
    }

    const url = new URL(urlString)
    if (request.queryParams) {
      for (const param of Object.values(request.queryParams)) {
        if (param.enabled) {
          url.searchParams.append(param.name, param.value)
        }
      }
    }
    if (authResult?.query) {
      for (const [key, value] of Object.entries(authResult.query)) {
        // Policy: auth last-wins for duplicate keys
        url.searchParams.set(key, value as string)
      }
    }

    // --- 2. Construct Final Headers ---
    const headers: Record<string, string> = {}
    for (const header of Object.values(request.headers ?? {})) {
      if (header.enabled) {
        headers[header.name] = header.value
      }
    }
    // Merge cookieParams into Cookie header (before auth cookies)
    const cookieParams = request.cookieParams as
      | Record<string, { name: string; value: string; enabled: boolean }>
      | undefined
    if (cookieParams) {
      // Deduplicate by name: last-enabled wins
      const dedup = new Map<string, string>()
      for (const c of Object.values(cookieParams)) {
        if (c.enabled && c.name) {
          dedup.set(c.name, c.value)
        }
      }
      const cookieString = Array.from(dedup.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
      if (cookieString) {
        const existingKey = Object.keys(headers).find((k) => k.toLowerCase() === "cookie")
        if (!existingKey) {
          headers.Cookie = cookieString
        } else if (headers[existingKey]) {
          headers[existingKey] = `${headers[existingKey]}; ${cookieString}`
        }
      }
    }
    if (authResult?.headers) {
      for (const [key, value] of Object.entries(authResult.headers)) {
        const existingKey = Object.keys(headers).find((k) => k.toLowerCase() === key.toLowerCase())
        if (!existingKey) {
          headers[key] = value as string
        }
      }
    }
    if (authResult?.cookies) {
      const cookieString = Object.entries(authResult.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
      if (cookieString) {
        // Respect existing Cookie header (case-insensitive)
        const existingKey = Object.keys(headers).find((k) => k.toLowerCase() === "cookie")
        if (!existingKey) {
          headers.Cookie = cookieString
        } else if (headers[existingKey]) {
          headers[existingKey] = `${headers[existingKey]}; ${cookieString}`
        }
      }
    }

    // --- 3. Construct Final Body or multipart parts ---
    const authBodyEntries: Array<[string, string]> = authResult?.body
      ? Object.entries(authResult.body).map(([k, v]) => [k, String(v as unknown as string)])
      : []
    let bodyText: string | undefined
    let bodyBytes: Uint8Array | undefined
    let multipartParts: MultipartPart[] | undefined
    if (request.body?.type === "text") {
      if (authBodyEntries.length > 0) {
        throw new Error("Auth placement 'body' is only supported with form bodies (URL-encoded or Multipart)")
      }
      bodyText = request.body.content
      // Set Content-Type if missing based on language
      const existingCtKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type")
      if (!existingCtKey) {
        const lang = request.body.language ?? "text"
        const ctMap: Record<string, string> = {
          json: "application/json",
          yaml: "application/yaml",
          xml: "application/xml",
          html: "text/html",
          javascript: "application/javascript",
          css: "text/css",
          graphql: "application/json",
          text: "text/plain",
        }
        const inferred = ctMap[lang]
        if (inferred) {
          headers["Content-Type"] = inferred
        }
      }
    } else if (request.body?.type === "form") {
      const enc = request.body.encoding ?? "url"
      const entries = (Object.values(request.body.formData ?? {}) as import("@/types").FormField[]).filter(
        (f) => f.enabled,
      )
      if (enc === "url") {
        // Disallow file fields in urlencoded forms
        const hasFile = entries.some((f) => (f.kind ?? "text") === "file")
        if (hasFile) {
          throw new Error(
            "File fields are not supported with application/x-www-form-urlencoded. Use Multipart or Binary Body.",
          )
        }
        const form = new URLSearchParams()
        for (const field of entries) {
          form.append(field.key, field.value)
        }
        // Inject auth body fields last; set ensures last-wins for duplicates
        for (const [k, v] of authBodyEntries) {
          form.set(k, v)
        }
        bodyText = form.toString()
        // Set Content-Type if not already present (case-insensitive)
        const existingKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type")
        if (!existingKey) {
          headers["Content-Type"] = "application/x-www-form-urlencoded"
        }
      } else if (enc === "plain") {
        // Disallow file fields in plain encoding as well
        const hasFile = entries.some((f) => (f.kind ?? "text") === "file")
        if (hasFile) {
          throw new Error("File fields are not supported with text/plain form encoding. Use Multipart or Binary Body.")
        }
        if (authBodyEntries.length > 0) {
          throw new Error(
            "Auth placement 'body' is not supported with text/plain form encoding. Use URL-encoded or Multipart.",
          )
        }
        // Plain form: serialize as simple key=value lines (fallback)
        bodyText = entries.map((f) => `${f.key}=${f.value}`).join("\n")
        // Ensure text/plain if not provided
        const existingKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type")
        if (!existingKey) {
          headers["Content-Type"] = "text/plain"
        }
      } else if (enc === "multipart") {
        // Always delegate multipart assembly to backend (text and files)
        multipartParts = []
        for (const f of entries) {
          if (f.kind === "file") {
            if (f.filePath) {
              multipartParts.push({
                type: "file",
                name: f.key,
                filePath: f.filePath as string,
                fileName: f.fileName,
                contentType: f.contentType,
              })
            } else {
              // Skip file parts with no path; UI should surface warnings
            }
          } else {
            multipartParts.push({ type: "text", name: f.key, value: f.value })
          }
        }
        // Inject auth body fields as additional text parts
        for (const [k, v] of authBodyEntries) {
          multipartParts.push({ type: "text", name: k, value: v })
        }
        // Do not set Content-Type here; backend will ensure multipart header with boundary
      }
    } else if (request.body?.type === "binary") {
      const existingCtKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type")
      if (!existingCtKey && request.body.binaryContentType) {
        headers["Content-Type"] = request.body.binaryContentType
      }
      // Prefer backend to read the file at send time via bodyFilePath; bodyBytes/bodyText remain undefined
    }

    // --- 4. Send Request ---
    // Preview spill threshold must match UI setting; default 20MB
    const previewMaxBytes = (() => {
      try {
        return useApplication.getState().settingsState.requests.previewMaxBytes ?? 20 * 1024 * 1024
      } catch {
        return 20 * 1024 * 1024
      }
    })()

    const response = await sendHttpRequest({
      requestId: context.correlationId ?? generateUniqueId(),
      url: url.toString(),
      method: request.method,
      headers: headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? (bodyBytes ?? (bodyText != null ? new TextEncoder().encode(bodyText) : undefined))
          : undefined,
      bodyFilePath: request.body?.type === "binary" ? request.body.binaryPath : undefined,
      multipartParts,
      ...request.options,
      previewMaxBytes,
    })

    // --- 5. Parse Response ---
    let responseBody: string | undefined
    let responseBodyBase64: string | undefined
    const rawBytes = response.body ? new Uint8Array(response.body) : undefined
    if (rawBytes) {
      responseBody = new TextDecoder().decode(rawBytes)
    }

    const ctHeader = (response.headers ?? []).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? ""
    const ct = ctHeader.toLowerCase()
    const isBinary =
      ct.startsWith("image/") ||
      ct.startsWith("audio/") ||
      ct.startsWith("video/") ||
      ct.includes("application/pdf") ||
      ct.includes("application/octet-stream")
    // Size threshold for base64 preview (20MB)
    const maxPreviewBytes = (() => {
      try {
        return useApplication.getState().settingsState.requests.previewMaxBytes ?? 20 * 1024 * 1024
      } catch {
        return 20 * 1024 * 1024
      }
    })()
    if (isBinary && rawBytes && rawBytes.length <= maxPreviewBytes) {
      // Convert to base64 safely in chunks to avoid stack overflow
      let binary = ""
      const chunkSize = 0x8000
      for (let i = 0; i < rawBytes.length; i += chunkSize) {
        // biome-ignore lint/suspicious/noExplicitAny: OK for btoa
        binary += String.fromCharCode.apply(null as any, rawBytes.subarray(i, i + chunkSize) as unknown as number[])
      }
      responseBodyBase64 = btoa(binary)
    }

    // Sanitize incoming data before parsing
    const sanitizedTimestamp = (() => {
      try {
        return new Date(response.timestamp).toISOString()
      } catch {
        return response.timestamp
      }
    })()
    const sanitizedCookies = (response.cookies ?? []).map((cookie) => {
      if (!cookie.expires) {
        return { ...cookie, expires: undefined }
      }
      try {
        // Unconditionally parse and convert to ISO string
        return { ...cookie, expires: new Date(cookie.expires).toISOString() }
      } catch (_e) {
        // If parsing fails for any reason, treat it as undefined
        return { ...cookie, expires: undefined }
      }
    })

    const httpResponseData: HttpResponseData = zHttpResponseData.parse({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers ?? []),
      cookies: sanitizedCookies,
      body: responseBody,
      bodyBase64: responseBodyBase64,
      filePath: (response as unknown as { filePath?: string }).filePath,
    })

    return zResponseState.parse({
      requestId: response.requestId,
      responseTime: response.duration,
      responseSize: response.size,
      timestamp: sanitizedTimestamp,
      data: {
        type: "http",
        data: httpResponseData,
      },
    })
  },
}

import { sendHttpRequest } from "@/bindings/knurl"
import { prepareHttpRequest } from "@/lib/request/prepared-http"
import { generateUniqueId } from "@/lib/utils"
import { getSyncLogger } from "@/lib/logger"
import { useApplication } from "@/state/application"
import type { RequestContext, RequestEngine } from "@/request/pipeline"
import { type HttpResponseData, type ResponseState, zHttpResponseData, zResponseState } from "@/types"

const logger = getSyncLogger("HttpEngine")

export const HttpEngine: RequestEngine = {
  async execute(context: RequestContext): Promise<ResponseState> {
    const { request, authResult } = context
    const prepared = prepareHttpRequest({ request, authResult })

    // --- 1. Send Request ---
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
      url: prepared.url,
      method: prepared.method,
      headers: prepared.headers,
      body: (() => {
        if (prepared.body.mode === "none" || prepared.method === "GET" || prepared.method === "HEAD") {
          return undefined
        }
        if (prepared.body.mode === "text" || prepared.body.mode === "urlencoded") {
          return new TextEncoder().encode(prepared.body.value)
        }
        return undefined
      })(),
      bodyFilePath: prepared.body.mode === "binary" ? prepared.body.filePath : undefined,
      multipartParts: prepared.body.mode === "multipart" ? prepared.body.parts : undefined,
      ...prepared.options,
      previewMaxBytes,
    })

    // --- 2. Parse Response ---
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
      } catch (e) {
        logger.warn(`[HTTP_ENGINE] Failed to parse response timestamp "${response.timestamp}": ${e}`)
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
      } catch (e) {
        // If parsing fails for any reason, treat it as undefined
        logger.warn(`[HTTP_ENGINE] Failed to parse cookie expiry date "${cookie.expires}": ${e}`)
        return { ...cookie, expires: undefined }
      }
    })

    let httpResponseData: HttpResponseData
    try {
      httpResponseData = zHttpResponseData.parse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers ?? []),
        cookies: sanitizedCookies,
        body: responseBody,
        bodyBase64: responseBodyBase64,
        filePath: (response as unknown as { filePath?: string }).filePath,
      })
    } catch (e) {
      logger.error(`[HTTP_ENGINE] Failed to parse HTTP response data: ${e}`)
      throw e
    }

    try {
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
    } catch (e) {
      logger.error(`[HTTP_ENGINE] Failed to parse response state: ${e}`)
      throw e
    }
  },
}

import { z } from "zod"

export const zLogLevel = z.enum(["info", "debug", "trace", "error", "warning"])
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
  expires: z.string().datetime().optional(),
  maxAge: z.number().optional(),
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

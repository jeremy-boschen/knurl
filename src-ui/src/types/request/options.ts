import { z } from "zod"

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
   * Raw CA certificate text (PEM format) as alternative to caPath
   */
  caText: z.string().optional(),
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
  /**
   * Maximum number of bytes to log for request/response previews.
   */
  maxLogBytes: z.union([z.number().int(), z.string()]).optional(),
  /**
   * Whether to redact sensitive values from logs.
   */
  redactSensitive: z.boolean().optional(),
  /**
   * Whether to log request/response bodies.
   */
  logBodies: z.boolean().optional(),
})
export type ClientOptionsData = z.infer<typeof zClientOptionsData>

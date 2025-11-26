import { z } from "zod"

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

export const detectRequestBodyGrammar = (content: string | undefined): RequestBodyGrammar | undefined => {
  const trimmed = content?.trim() ?? ""
  if (!trimmed) {
    return undefined
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed)
      return "json"
    } catch (_) {
      // ignore
    }
  } else if (trimmed.includes("<?xml") || trimmed.includes("<")) {
    return "xml"
  } else if (trimmed.includes("query") || trimmed.includes("mutation")) {
    return "graphql"
  }

  return "text"
}

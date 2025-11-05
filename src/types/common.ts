import { z } from "zod"

export const zFileHeaderSchema = z.object({
  /**
   * Version of the index format
   */
  version: z.literal(1),
  /**
   * Last update timestamp
   */
  updated: z.iso.datetime(),
})

export type Some<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>

export type MethodNames<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: OK
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T]

// 2) build API but drop "api"
export type API<T, E extends string> = Pick<T, Exclude<MethodNames<T>, E>>

// Deep partial
export type Patch<T> = T extends object ? { [P in keyof T]?: Patch<T[P]> } : T

// Languages supported by the code editor/viewer and the formatter
export type CodeLanguage = "json" | "yaml" | "xml" | "html" | "graphql" | "javascript" | "text" | "css"

export const CodeLanguages: { language: CodeLanguage; title: string }[] = [
  { language: "json", title: "JSON" },
  { language: "yaml", title: "YAML" },
  { language: "xml", title: "XML" },
  { language: "html", title: "HTML" },
  { language: "graphql", title: "GraphQL" },
  { language: "javascript", title: "Javascript" },
  { language: "text", title: "Plain Text" },
  { language: "css", title: "CSS" },
]

import { z } from "zod"

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

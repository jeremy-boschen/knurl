import { z } from "zod"

import { zHttpMethod } from "./core"
import { zRequestBodyData } from "./body"
import { zRequestQueryParam, zRequestPathParam, zRequestHeader, zRequestCookieParam } from "./parameters"
import { zAuthConfig } from "./auth"
import { zClientOptionsData } from "./options"

// Patch schema must not inherit defaults from the base request schema,
// otherwise Zod will populate missing fields (e.g., autoSave: false) on load.
// Define it explicitly with all fields optional and without defaults.
export const zRequestPatch = z.object({
  order: z.number().int().optional(),
  name: z.string().optional(),
  collectionId: z.string().optional(),
  folderId: z.string().optional(),
  environmentId: z.string().optional(),
  autoSave: z.boolean().optional(),
  method: zHttpMethod.optional(),
  url: z.string().optional(),
  pathParams: z.record(z.string(), zRequestPathParam).optional(),
  queryParams: z.record(z.string(), zRequestQueryParam).optional(),
  headers: z.record(z.string(), zRequestHeader).optional(),
  cookieParams: z.record(z.string(), zRequestCookieParam).optional(),
  body: zRequestBodyData.partial().optional(),
  authentication: zAuthConfig.optional(),
  tests: z.string().optional(),
  options: zClientOptionsData.optional(),
})
export type RequestPatch = z.infer<typeof zRequestPatch>

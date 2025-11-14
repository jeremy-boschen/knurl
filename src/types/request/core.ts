// noinspection DuplicatedCode, JSUnusedGlobalSymbols

import { z } from "zod"

export const DefaultCollectionFolderId = "root" as const

/**
 * Schema & type defining valid HTTP methods
 */
export const zHttpMethod = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"])
export type HttpMethod = z.infer<typeof zHttpMethod>

export const zRequestOpenStatus = z.enum(["open", "closed"])
export type RequestOpenStatus = z.infer<typeof zRequestOpenStatus>

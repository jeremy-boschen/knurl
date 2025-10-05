import { z } from "zod"

import { type LogLevel, type RequestState, type ResponseState, zRequestState, zResponseState } from "@/types"

export const zRequestTabStatus = z.enum(["loading", "inactive", "active", "error"])
export type RequestTabStatus = z.infer<typeof zRequestTabStatus>

export const zRequestTabId = z.enum(["params", "headers", "body", "auth", "tests", "options"])
export type RequestTabId = z.infer<typeof zRequestTabId>

export const zRequestTabState = z.object({
  tabId: z.string(),

  order: z.number(),

  requestId: z.string(),
  collectionId: z.string(),

  activeTab: zRequestTabId.default("params"),

  /**
   * Whether a request send is active
   */
  sending: z.boolean().default(false),
  /**
   * Active correlation id for the in-flight request, if any
   */
  activeCorrelationId: z.string().optional(),

  /**
   * Pre-computed merged request (base and patch) for performance optimization
   */
  merged: zRequestState.optional(),

  /**
   * The environment selected for this request tab
   */
  selectedEnvironmentId: z.string().optional(),

  response: zResponseState.partial().default({}),
})

export type RequestTabState = z.infer<typeof zRequestTabState>

export interface RequestTab extends RequestTabState {}

export const zRequestTabsState = z.object({
  openTabs: z.record(zRequestTabState.shape.tabId, zRequestTabState),
  activeTab: zRequestTabState.shape.tabId.nullable(),
  orderedTabs: z.array(zRequestTabState).default([]),
})
export type RequestTabsState = z.infer<typeof zRequestTabsState>

export interface RequestTabsStateApi {
  getOpenTabs(): RequestTabState[]
  getOpenTab(collectionId: string, requestId: string): RequestTabState | null
  getActiveTab(): RequestTabState | null
  setActiveTab(tabId: string): void

  createRequestTab(collectionId?: string, request?: Partial<RequestState>): Promise<void>
  openRequestTab(collectionId: string, requestId: string): Promise<void>
  updateTab(tabId: string, patch: Partial<RequestTabState & RequestState>): void
  removeTab(tabId: string): Promise<void>
  closeAllTabs(): Promise<void>
  closeTabsToLeft(tabId: string): Promise<void>
  closeTabsToRight(tabId: string): Promise<void>
  saveTab(tabId: string): Promise<void>
  saveNewTab(tabId: string, collectionId: string, name: string, description?: string): Promise<void>

  updateTabRequest(tabId: string, patch: Partial<RequestState>): void
  updateTabResponse(tabId: string, patch: Partial<ResponseState>): void

  selectEnvironment(tabId: string, environmentId: string | undefined): void

  sendRequest(tabId: string, request: RequestState): Promise<void>
  cancelRequest(tabId: string): Promise<void>
  clearResponse(tabId: string): void
  setResponseLogFilter(tabId: string, levels: LogLevel[]): void
}

export interface RequestTabsStateSlice {
  requestTabsState: RequestTabsState
  requestTabsApi: RequestTabsStateApi
}

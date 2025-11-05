import {act, renderHook, waitFor} from "@testing-library/react"
import {beforeEach, describe, expect, it, vi} from "vitest"

const mockFormatWithPrettier = vi.hoisted(() =>
  vi.fn(async (code: string, _language: string) => `formatted:${code}`),
)
const mockWarmPrettier = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prettier", () => ({
  formatWithPrettier: mockFormatWithPrettier,
  warmPrettier: mockWarmPrettier,
}))

import {
  collectionsApi,
  useApplication,
  useRequestBody,
  useRequestCookies,
  useRequestHeaders,
  useRequestOptions,
  useRequestParameters,
  useRequestTab,
  useRequestsTabSummary,
} from "@/state/application"
import {resetApplicationStore} from "@/test/zustand"
import {isRequestDirty, toMergedRequest, type Cookie} from "@/types"

const getRequestState = (collectionId: string, requestId: string) =>
  useApplication.getState().collectionsState.cache[collectionId].requests[requestId]

const bootstrapTab = () => {
  const store = useApplication
  const {collectionsApi: colApi, requestTabsApi} = store.getState()
  const collection = colApi.addCollection("Test Collection", "Desc")
  colApi.getCollection(collection.id)
  const request = colApi.createRequest(collection.id, {
    name: "Sample Request",
    method: "GET",
    url: "https://example.test",
  } as any)
  colApi.getCollection(collection.id)
  requestTabsApi.openRequestTab(collection.id, request.id)
  colApi.discardRequestPatch(collection.id, request.id)
  const tab = requestTabsApi.getOpenTab(collection.id, request.id)
  expect(tab).not.toBeNull()
  return {collectionId: collection.id, requestId: request.id, tabId: tab!.tabId}
}

describe("application store (test env)", () => {
  beforeEach(() => {
    resetApplicationStore()
    mockFormatWithPrettier.mockClear()
  })

  it("initializes and allows basic API calls", () => {
    const store = useApplication
    const {settingsApi} = store.getState()
    settingsApi.setTheme("light")
    expect(store.getState().settingsState.appearance.theme).toBe("light")
  })

  it("useRequestTab returns active tab data", () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const {result} = renderHook(() => useRequestTab(tabId))
    expect(result.current?.state.activeTab.tabId).toBe(tabId)
    const request = getRequestState(collectionId, requestId)
    expect(result.current?.state.isDirty).toBe(isRequestDirty(request))
  })

  it("useRequestParameters mutates query and path params", () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const {result, rerender} = renderHook(() => useRequestParameters(tabId))

    act(() => {
      result.current.actions.addQueryParam()
      result.current.actions.addPathParam()
    })

    rerender()

    const request = getRequestState(collectionId, requestId)
    expect(Object.keys(request.patch?.queryParams ?? {})).toHaveLength(1)
    expect(Object.keys(request.patch?.pathParams ?? {})).toHaveLength(1)
  })

  it("useRequestCookies handles existing and new cookies", () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const api = collectionsApi()
    api.updateRequestPatchCookieParam(collectionId, requestId, "existing", {
      id: "existing",
      name: "session",
      value: "old",
      enabled: true,
    })

    const {result, rerender} = renderHook(() => useRequestCookies(tabId))

    const responseCookie: Cookie = {name: "session", value: "fresh"}
    const newCookie: Cookie = {name: "csrf", value: "token"}

    act(() => {
      result.current.actions.addCookieParam()
      result.current.actions.addCookieFromResponse(responseCookie)
      result.current.actions.addCookieFromResponse(newCookie)
    })

    rerender()

    const cookies = getRequestState(collectionId, requestId).patch?.cookieParams ?? {}
    const names = Object.values(cookies).map((c) => c?.name)

    expect(names).toContain("session")
    expect(names).toContain("csrf")
    expect(Object.values(cookies).some((c) => c?.value === "fresh")).toBe(true)
  })

  it("useRequestHeaders adds and removes headers", () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const {result, rerender} = renderHook(() => useRequestHeaders(tabId))

    act(() => result.current.actions.addHeader())
    rerender()
    const headerIds = Object.keys(getRequestState(collectionId, requestId).patch?.headers ?? {})
    expect(headerIds).toHaveLength(1)

    act(() => {
      result.current.actions.updateHeader(headerIds[0], {value: "2"})
      result.current.actions.removeHeader(headerIds[0])
    })

    rerender()
    const requestAfterRemove = getRequestState(collectionId, requestId)
    expect(requestAfterRemove.patch?.headers?.[headerIds[0]]).toBeUndefined()
  })

  it("useRequestBody formats and mutates content", async () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const {result, rerender} = renderHook(() => useRequestBody(tabId))

    act(() => {
      result.current.actions.updateBodyContent("{\"foo\":1}")
    })
    rerender()

    await act(async () => {
      await result.current.actions.formatContent()
    })

    rerender()
    expect(mockFormatWithPrettier).toHaveBeenCalled()
    const formatted = getRequestState(collectionId, requestId).patch?.body?.content
    expect(formatted).toBeDefined()
    expect(formatted?.startsWith("formatted:")).toBe(true)
  })

  it("useRequestOptions updates options and autoSave", () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const {result, rerender} = renderHook(() => useRequestOptions(tabId))

    act(() => {
      result.current.actions.updateClientOption({followRedirects: true} as any)
      result.current.actions.updateAutoSave(true)
    })

    rerender()
    const request = getRequestState(collectionId, requestId)
    expect(request.patch?.options?.followRedirects).toBe(true)
    expect(request.patch?.autoSave).toBe(true)
  })

  it("useRequestsTabSummary reflects merged state", async () => {
    const {collectionId, requestId, tabId} = bootstrapTab()
    const {result} = renderHook(() => useRequestsTabSummary(tabId))
    act(() => {
      const api = collectionsApi()
      api.setRequestName(collectionId, requestId, "Renamed")
    })
    act(() => {
      const request = getRequestState(collectionId, requestId)
      useApplication.getState().requestTabsApi.updateTab(tabId, {merged: toMergedRequest(request)})
    })

    await waitFor(() => expect(result.current.name).toBe("Renamed"))
    expect(result.current.requestId).toBe(requestId)
  })
})

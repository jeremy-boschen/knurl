import { describe, expect, it, vi, beforeEach } from "vitest"
import type { StoreApi } from "zustand"

import { requestTabsSliceCreator, escapeRegExp } from "./request-tabs"
import type { RequestTabState } from "@/types"

type TestApplication = any

vi.mock("@/state/application", () => ({
  useApplication: { loadAll: vi.fn(), getState: vi.fn(() => ({})) },
  collectionsApi: vi.fn(),
  settingsApi: vi.fn(),
  credentialsCacheApi: vi.fn(),
  environmentsApi: vi.fn(),
  utilitySheetsApi: vi.fn(),
}))

const baseCollection = {
  id: "col-1",
  name: "Default",
  description: "",
  encryption: { algorithm: "aes-gcm" },
  authentication: { type: "none" },
  folders: {},
  requestIndex: {},
  requests: {
    "req-1": {
      id: "req-1",
      name: "List",
      method: "GET",
      url: "https://example.com",
      authentication: { type: "none" },
      headers: [],
      query: [],
      body: { type: "json", value: "" },
      variables: [],
      patch: null,
      updated: "1",
    },
  },
  environments: {},
} as const

const createSlice = () => {
  const collectionsApi = {
    loadCollection: vi.fn(async () => baseCollection),
    createRequest: vi.fn(),
    getCollection: vi.fn(() => baseCollection),
    getRequest: vi.fn(() => baseCollection.requests["req-1"]),
    deleteRequest: vi.fn(),
    commitRequestPatch: vi.fn(),
    discardRequestPatch: vi.fn(),
    setRequestMethod: vi.fn(),
    setRequestUrl: vi.fn(),
    setRequestName: vi.fn(),
  }

  const initialTab: RequestTabState = {
    tabId: "tab-1",
    order: 0,
    collectionId: "col-1",
    requestId: "req-1",
    response: { logs: [], logFilterLevels: ["info", "error"] },
  }

  const state: any = {
    collectionsState: {
      cache: {
        "col-1": structuredClone(baseCollection),
      },
      index: [{ id: "col-1", name: "Default", count: 1, open: false, order: 0, opened: [] }],
    },
    collectionsApi,
    requestTabsState: {
      openTabs: { [initialTab.tabId]: structuredClone(initialTab) },
      activeTab: initialTab.tabId,
      orderedTabs: [],
    },
  }

  const set = (updater: (draft: any) => void) => {
    updater(state)
  }

  const get = () => state as TestApplication

  const storeApi = {
    getState: () => state as TestApplication,
    subscribe: vi.fn(() => () => {}),
    registerPostHydrate: vi.fn(),
  } as unknown as StoreApi<TestApplication>

  const slice = requestTabsSliceCreator(set, get as () => TestApplication, storeApi)
  Object.assign(state, slice)
  state.requestTabsState = {
    openTabs: { [initialTab.tabId]: structuredClone(initialTab) },
    activeTab: initialTab.tabId,
    orderedTabs: [structuredClone(initialTab)],
  }

  return { api: slice.requestTabsApi, state, collectionsApi }
}

describe("requestTabsSliceCreator helpers", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    ;(window.requestAnimationFrame as unknown as { mockRestore?: () => void }).mockRestore?.()
  })

  it("selectEnvironment normalizes 'none' to undefined", () => {
    const { api, state } = createSlice()
    api.selectEnvironment("tab-1", "env-1")
    expect(state.requestTabsState.openTabs["tab-1"].selectedEnvironmentId).toBe("env-1")

    api.selectEnvironment("tab-1", "none")
    expect(state.requestTabsState.openTabs["tab-1"].selectedEnvironmentId).toBeUndefined()
  })

  it("updates response log filters immutably", () => {
    const { api, state } = createSlice()
    api.setResponseLogFilter("tab-1", ["debug", "warn"])

    expect(state.requestTabsState.openTabs["tab-1"].response?.logFilterLevels).toEqual(["debug", "warn"])
  })
})

describe("escapeRegExp", () => {
  it("escapes characters used in regular expressions", () => {
    const input = "price.(usd)+?"
    expect(escapeRegExp(input)).toBe("price\\.\\(usd\\)\\+\\?")
  })
})

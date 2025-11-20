import { describe, expect, it, vi, beforeEach } from "vitest"
import type { StoreApi } from "zustand"

import { requestTabsSliceCreator, escapeRegExp } from "./request-tabs"
import { eventBus } from "@/lib/event-emitter"
import { ScratchCollectionId } from "@/state/collections"
import type { LogEntry, RequestTabState, ResponseState } from "@/types"

type TestApplication = any

vi.mock("@/state/application", () => ({
  useApplication: { loadAll: vi.fn(), getState: vi.fn(() => ({})) },
  collectionsApi: vi.fn(),
  settingsApi: vi.fn(),
  credentialsCacheApi: vi.fn(),
  environmentsApi: vi.fn(),
  utilitySheetsApi: vi.fn(),
}))

const bindingMocks = vi.hoisted(() => ({
  cancelHttpRequest: vi.fn(),
  deleteFile: vi.fn(),
  getAuthenticationResult: vi.fn(),
}))

vi.mock("@/bindings/knurl", () => bindingMocks)

const tauriMocks = vi.hoisted(() => ({
  listen: vi.fn(),
}))

vi.mock("@tauri-apps/api/event", () => tauriMocks)

const pipelineMocks = vi.hoisted(() => ({
  createAuthPhase: vi.fn(() => ({ phase: "auth" })),
  runPipeline: vi.fn(),
}))

vi.mock("@/request/pipeline", () => ({
  createAuthPhase: pipelineMocks.createAuthPhase,
  resolveVariablesPhase: { phase: "resolve" },
  protocolDispatchPhase: { phase: "dispatch" },
  runPipeline: pipelineMocks.runPipeline,
}))

vi.mock("@/lib/environments", () => ({
  resolveRequestVariables: vi.fn((request) => request),
}))

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils")
  return {
    ...actual,
    generateUniqueId: vi.fn(() => "request-123"),
  }
})

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
  let state: TestApplication
  const collectionsApi = {
    loadCollection: vi.fn(async (collectionId: string) => state.collectionsState.cache[collectionId]),
    createRequest: vi.fn((collectionId: string, payload: { name: string }) => {
      const collection = state.collectionsState.cache[collectionId]
      const requestId = payload.name ?? `req-${Object.keys(collection.requests).length + 1}`
      const newRequest = {
        id: requestId,
        name: payload.name,
        method: "GET",
        url: "https://example.com",
        authentication: { type: "none" },
      }
      collection.requests[requestId] = newRequest
      return { ...newRequest, collectionId }
    }),
    getCollection: vi.fn((collectionId: string) => state.collectionsState.cache[collectionId]),
    getRequest: vi.fn((collectionId: string, requestId: string) => {
      return state.collectionsState.cache[collectionId].requests[requestId]
    }),
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

  state = {
    collectionsState: {
      cache: {
        "col-1": structuredClone(baseCollection),
        [ScratchCollectionId]: {
          ...structuredClone(baseCollection),
          id: ScratchCollectionId,
          requests: {},
        },
      },
      index: [
        { id: "col-1", name: "Default", count: 1, open: false, order: 0, opened: [] },
        { id: ScratchCollectionId, name: "Scratch", count: 0, open: false, order: 1, opened: [] },
      ],
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

describe("requestTabsApi behaviors", () => {
  beforeEach(() => {
    bindingMocks.deleteFile.mockClear()
    bindingMocks.cancelHttpRequest.mockClear()
    bindingMocks.getAuthenticationResult.mockClear()
    tauriMocks.listen.mockReset()
    tauriMocks.listen.mockResolvedValue(vi.fn())
    pipelineMocks.runPipeline.mockReset()
    pipelineMocks.createAuthPhase.mockClear()
  })

  it("removes active tab, reassigns next neighbor, and discards non-scratch patches", () => {
    const { api, state, collectionsApi } = createSlice()
    const tab2: RequestTabState = {
      tabId: "tab-2",
      order: 1,
      collectionId: "col-1",
      requestId: "req-2",
      response: { logs: [], logFilterLevels: ["info"] },
    }
    const tab3: RequestTabState = {
      tabId: "tab-3",
      order: 2,
      collectionId: "col-1",
      requestId: "req-3",
      response: { logs: [], logFilterLevels: ["info"] },
    }

    const baseRequest = state.collectionsState.cache["col-1"].requests["req-1"]
    Object.assign(state.collectionsState.cache["col-1"].requests, {
      "req-2": { ...structuredClone(baseRequest), id: "req-2", autoSave: false },
      "req-3": { ...structuredClone(baseRequest), id: "req-3", autoSave: true },
    })

    state.requestTabsState.openTabs = {
      "tab-1": state.requestTabsState.openTabs["tab-1"],
      [tab2.tabId]: tab2,
      [tab3.tabId]: tab3,
    }
    state.requestTabsState.activeTab = tab2.tabId
    state.requestTabsState.orderedTabs = [state.requestTabsState.openTabs["tab-1"], tab2, tab3]
    state.collectionsState.index[0].opened = ["req-1", "req-2", "req-3"]

    api.removeTab(tab2.tabId)

    expect(state.requestTabsState.activeTab).toBe(tab3.tabId)
    expect(state.collectionsState.index[0].opened).toEqual(["req-1", "req-3"])
    expect(collectionsApi.discardRequestPatch).toHaveBeenCalledWith("col-1", "req-2")
    expect(collectionsApi.commitRequestPatch).not.toHaveBeenCalledWith("col-1", "req-2")

    api.removeTab(tab3.tabId)
    expect(collectionsApi.commitRequestPatch).toHaveBeenCalledWith("col-1", "req-3")
  })

  it("cleans up scratch tabs and temp response files when removing", () => {
    const { api, state, collectionsApi } = createSlice()
    const scratchRequest = {
      ...structuredClone(state.collectionsState.cache["col-1"].requests["req-1"]),
      id: "scratch-req",
    }
    state.collectionsState.cache[ScratchCollectionId].requests["scratch-req"] = scratchRequest
    const scratchTab: RequestTabState = {
      tabId: "scratch-tab",
      order: 5,
      collectionId: ScratchCollectionId,
      requestId: "scratch-req",
      response: {
        logFilterLevels: ["info"],
        logs: [],
        data: { type: "http", data: { filePath: "/tmp/response.bin" } } as any,
      },
    }
    state.requestTabsState.openTabs[scratchTab.tabId] = scratchTab
    state.requestTabsState.orderedTabs.push(scratchTab)

    api.removeTab(scratchTab.tabId)

    expect(bindingMocks.deleteFile).toHaveBeenCalledWith("/tmp/response.bin")
    expect(collectionsApi.deleteRequest).toHaveBeenCalledWith(ScratchCollectionId, "scratch-req")
  })

  it("updates request fields and rejects unsupported attributes", () => {
    const { api, collectionsApi } = createSlice()

    api.updateTabRequest("tab-1", {
      method: "PUT",
      url: "https://api.example.org",
      name: "Updated Request",
    })

    expect(collectionsApi.setRequestMethod).toHaveBeenCalledWith("col-1", "req-1", "PUT")
    expect(collectionsApi.setRequestUrl).toHaveBeenCalledWith("col-1", "req-1", "https://api.example.org")
    expect(collectionsApi.setRequestName).toHaveBeenCalledWith("col-1", "req-1", "Updated Request")

    expect(() =>
      api.updateTabRequest("tab-1", {
        body: { type: "json", value: "{}" } as any,
      }),
    ).toThrow(/unsupported/i)
  })

  it("reuses existing tabs without emitting events and marks collection open", () => {
    const { api, state } = createSlice()
    const emitSpy = vi.spyOn(eventBus, "emit")
    state.collectionsState.index[0].open = false

    api.openRequestTab("col-1", "req-1")

    expect(state.requestTabsState.activeTab).toBe("tab-1")
    expect(state.collectionsState.index[0].open).toBe(true)
    expect(emitSpy).not.toHaveBeenCalled()
    emitSpy.mockRestore()
  })

  it("opens new tabs, emits request events, and tracks opened ids", () => {
    const { api, state } = createSlice()
    const emitSpy = vi.spyOn(eventBus, "emit")
    state.collectionsState.cache["col-1"].requests["req-2"] = {
      ...structuredClone(state.collectionsState.cache["col-1"].requests["req-1"]),
      id: "req-2",
      name: "Second",
    }
    state.collectionsState.index[0].opened = []

    api.openRequestTab("col-1", "req-2")

    const createdTab = Object.values(state.requestTabsState.openTabs).find((tab) => tab.requestId === "req-2")
    expect(createdTab).toBeTruthy()
    expect(createdTab?.merged).toBeDefined()
    expect(state.collectionsState.index[0].opened).toContain("req-2")
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "opened", requestId: "req-2", collectionId: "col-1" }),
    )
    emitSpy.mockRestore()
  })

  it("closes tabs to the left of a target and reassigns active tab", () => {
    const { api, state } = createSlice()
    const base = state.requestTabsState.openTabs["tab-1"]
    state.collectionsState.cache["col-1"].requests["req-2"] = {
      ...structuredClone(baseCollection.requests["req-1"]),
      id: "req-2",
    }
    state.collectionsState.cache["col-1"].requests["req-3"] = {
      ...structuredClone(baseCollection.requests["req-1"]),
      id: "req-3",
    }
    const tab2: RequestTabState = { ...structuredClone(base), tabId: "tab-2", order: 1, requestId: "req-2" }
    const tab3: RequestTabState = { ...structuredClone(base), tabId: "tab-3", order: 2, requestId: "req-3" }
    state.requestTabsState.openTabs = { "tab-1": base, [tab2.tabId]: tab2, [tab3.tabId]: tab3 }
    state.requestTabsState.orderedTabs = [base, tab2, tab3]
    state.requestTabsState.activeTab = tab3.tabId
    state.collectionsState.index[0].opened = ["req-1", "req-2", "req-3"]

    api.closeTabsToLeft("tab-2")

    expect(state.requestTabsState.openTabs["tab-1"]).toBeUndefined()
    expect(state.requestTabsState.activeTab).toBe("tab-2")
    expect(state.collectionsState.index[0].opened).toEqual(["req-2", "req-3"])
  })

  it("closes tabs to the right of a target and retains the target tab", () => {
    const { api, state } = createSlice()
    const base = state.requestTabsState.openTabs["tab-1"]
    state.collectionsState.cache["col-1"].requests["req-2"] = {
      ...structuredClone(baseCollection.requests["req-1"]),
      id: "req-2",
    }
    state.collectionsState.cache["col-1"].requests["req-3"] = {
      ...structuredClone(baseCollection.requests["req-1"]),
      id: "req-3",
    }
    const tab2: RequestTabState = { ...structuredClone(base), tabId: "tab-2", order: 1, requestId: "req-2" }
    const tab3: RequestTabState = { ...structuredClone(base), tabId: "tab-3", order: 2, requestId: "req-3" }
    state.requestTabsState.openTabs = { "tab-1": base, [tab2.tabId]: tab2, [tab3.tabId]: tab3 }
    state.requestTabsState.orderedTabs = [base, tab2, tab3]
    state.collectionsState.index[0].opened = ["req-1", "req-2", "req-3"]

    api.closeTabsToRight("tab-2")

    expect(Object.keys(state.requestTabsState.openTabs)).toEqual(["tab-1", "tab-2"])
    expect(state.collectionsState.index[0].opened).toEqual(["req-1", "req-2"])
  })

  it("updates tab ordering metadata when order changes", () => {
    const { api, state } = createSlice()
    const tab = state.requestTabsState.openTabs["tab-1"]
    const tabB: RequestTabState = {
      ...structuredClone(tab),
      tabId: "tab-2",
      order: 1,
      requestId: "req-2",
    }
    state.collectionsState.cache["col-1"].requests["req-2"] = {
      ...structuredClone(baseCollection.requests["req-1"]),
      id: "req-2",
    }
    state.requestTabsState.openTabs[tabB.tabId] = tabB
    state.requestTabsState.orderedTabs = [tab, tabB]

    api.updateTab("tab-1", { order: 5 })

    expect(state.requestTabsState.orderedTabs[1]).toMatchObject({ tabId: "tab-1", order: 5 })
  })

  it("creates and merges tab responses immutably", () => {
    const { api, state } = createSlice()
    const logEntry = {
      requestId: "req-1",
      timestamp: new Date().toISOString(),
      level: "info" as const,
      message: "ok",
    }
    const tab = state.requestTabsState.openTabs["tab-1"]
    delete tab.response

    api.updateTabResponse("tab-1", { logs: [logEntry] })
    expect(tab.response?.logs).toHaveLength(1)

    api.updateTabResponse("tab-1", { logFilterLevels: ["error"] })
    expect(tab.response?.logFilterLevels).toEqual(["error"])
  })

  it("saves tabs by committing request patches", () => {
    const { api, collectionsApi } = createSlice()
    api.saveTab("tab-1")
    expect(collectionsApi.commitRequestPatch).toHaveBeenCalledWith("col-1", "req-1")
  })

  it("sends requests, streams logs, and clears transient state when pipeline succeeds", async () => {
    let capturedHandler: ((event: { payload: LogEntry }) => void) | null = null
    tauriMocks.listen.mockImplementation(async (_event, handler) => {
      capturedHandler = handler
      return vi.fn(() => {
        capturedHandler = null
      })
    })
    pipelineMocks.runPipeline.mockImplementation(async (_phases, context, notifier) => {
      notifier.onStart?.()
      capturedHandler?.({
        payload: {
          requestId: "other-request",
          timestamp: new Date().toISOString(),
          level: "info",
          message: "skip",
        } as LogEntry,
      })
      capturedHandler?.({
        payload: {
          requestId: context.correlationId,
          timestamp: new Date().toISOString(),
          level: "info",
          message: "tauri log",
        } as LogEntry,
      })
      notifier.onSuccess?.({
        logs: [],
        data: { type: "http", data: { status: 200, statusText: "OK", headers: {}, cookies: [] } },
      } as unknown as ResponseState)
    })

    const { api, state } = createSlice()
    const request = state.collectionsState.cache["col-1"].requests["req-1"]

    await api.sendRequest("tab-1", request)

    const tab = state.requestTabsState.openTabs["tab-1"]
    expect(tab.sending).toBe(false)
    expect(tab.activeCorrelationId).toBeUndefined()
    expect(tab.response?.logs?.some((log) => log.message === "tauri log")).toBe(true)
    expect(tauriMocks.listen).toHaveBeenCalledWith("http-request-log", expect.any(Function))
  })

  it("appends error logs when pipeline reports failure", async () => {
    pipelineMocks.runPipeline.mockImplementation(async (_phases, _ctx, notifier) => {
      notifier.onStart?.()
      notifier.onError?.(Object.assign(new Error("boom"), { appError: { code: "ERR" } }))
    })
    tauriMocks.listen.mockResolvedValue(vi.fn())

    const { api, state } = createSlice()
    const request = state.collectionsState.cache["col-1"].requests["req-1"]
    await api.sendRequest("tab-1", request)

    const tab = state.requestTabsState.openTabs["tab-1"]
    expect(tab.response?.logs?.at(-1)?.message).toBe("boom")
    expect(tab.response?.logs?.at(-1)?.details).toEqual({ code: "ERR" })
  })

  it("cancels active requests and resets correlation ids", async () => {
    const { api, state } = createSlice()
    const tab = state.requestTabsState.openTabs["tab-1"]
    tab.activeCorrelationId = "request-123"
    tab.sending = true

    await api.cancelRequest("tab-1")

    expect(bindingMocks.cancelHttpRequest).toHaveBeenCalledWith("request-123")
    expect(tab.sending).toBe(false)
    expect(tab.activeCorrelationId).toBeUndefined()
  })

  it("no-ops when closing tabs to the left of the first tab", () => {
    const { api, state } = createSlice()
    const before = Object.keys(state.requestTabsState.openTabs)
    api.closeTabsToLeft("tab-1")
    expect(Object.keys(state.requestTabsState.openTabs)).toEqual(before)
  })

  it("no-ops when closing tabs to the right of the last tab", () => {
    const { api, state } = createSlice()
    api.closeTabsToRight("tab-1")
    expect(Object.keys(state.requestTabsState.openTabs)).toEqual(["tab-1"])
  })

  it("removes all tabs when closeAllTabs is invoked", () => {
    const { api, state } = createSlice()
    const base = state.requestTabsState.openTabs["tab-1"]
    const extra: RequestTabState = { ...structuredClone(base), tabId: "tab-2", order: 1, requestId: "req-2" }
    state.collectionsState.cache["col-1"].requests["req-2"] = {
      ...structuredClone(baseCollection.requests["req-1"]),
      id: "req-2",
    }
    state.requestTabsState.openTabs[extra.tabId] = extra
    state.collectionsState.index[0].opened = ["req-1", "req-2"]

    api.closeAllTabs()

    expect(state.requestTabsState.openTabs).toEqual({})
    expect(state.collectionsState.index[0].opened).toEqual([])
  })

  it("ignores removeTab calls for unknown ids", () => {
    const { api, state } = createSlice()
    const before = { ...state.requestTabsState.openTabs }
    api.removeTab("missing-tab")
    expect(state.requestTabsState.openTabs).toEqual(before)
  })

  it("clears response data but preserves log filters", () => {
    const { api, state } = createSlice()
    state.requestTabsState.openTabs["tab-1"].response = {
      logFilterLevels: ["info"],
      logs: [{ requestId: "req-1", timestamp: "2024", level: "info", message: "old" }],
    } as ResponseState

    api.clearResponse("tab-1")

    expect(state.requestTabsState.openTabs["tab-1"].response).toEqual({
      logFilterLevels: ["info"],
      logs: [],
    })
  })

  it("runs auth-only flow and stores credentials when auth is configured", async () => {
    const { api, state } = createSlice()
    const tab = state.requestTabsState.openTabs["tab-1"]
    const merged = {
      ...structuredClone(baseCollection.requests["req-1"]),
      authentication: { type: "oauth2", oauth2: { clientId: "abc", tokenUrl: "https://token" } },
    }
    merged.collectionId = "col-1"
    tab.merged = merged
    tab.selectedEnvironmentId = "env-1"
    state.collectionsState.cache["col-1"].environments = {
      "env-1": { id: "env-1", name: "Env", variables: {} },
    }
    state.credentialsCacheApi = {
      generateCacheKey: vi.fn(() => "cache-key"),
      set: vi.fn(),
      get: vi.fn(),
    }
    tauriMocks.listen.mockImplementation(async (_event, handler) => {
      handler({
        payload: {
          requestId: "other-request",
          timestamp: new Date().toISOString(),
          level: "info",
          message: "skip",
        } as LogEntry,
      })
      handler({
        payload: {
          requestId: "request-123",
          timestamp: new Date().toISOString(),
          level: "info",
          message: "auth log",
        } as LogEntry,
      })
      return vi.fn()
    })
    bindingMocks.getAuthenticationResult.mockResolvedValue({ headers: { Authorization: "Bearer fresh" } })

    await api.runAuthOnly("tab-1")

    expect(bindingMocks.getAuthenticationResult).toHaveBeenCalled()
    expect(state.credentialsCacheApi.set).toHaveBeenCalledWith("cache-key", { headers: { Authorization: "Bearer fresh" } })
    expect(state.requestTabsState.openTabs["tab-1"].sending).toBe(false)
    expect(state.requestTabsState.openTabs["tab-1"].response?.logs?.some((log) => log.message === "auth log")).toBe(true)
  })

  it("skips auth-only flow when the request has no authentication configured", async () => {
    const { api, state } = createSlice()
    const tab = state.requestTabsState.openTabs["tab-1"]
    tab.merged = {
      ...structuredClone(baseCollection.requests["req-1"]),
      authentication: { type: "none" },
    }
    tab.merged.collectionId = "col-1"
    state.credentialsCacheApi = {
      generateCacheKey: vi.fn(() => "cache-key"),
      set: vi.fn(),
      get: vi.fn(),
    }

    await api.runAuthOnly("tab-1")

    expect(bindingMocks.getAuthenticationResult).not.toHaveBeenCalled()
    expect(state.credentialsCacheApi.set).not.toHaveBeenCalled()
  })
})

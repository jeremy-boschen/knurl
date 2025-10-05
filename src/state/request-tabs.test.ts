// Consolidated test suite for src/state/request-tabs.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useApplication } from "@/state/application"
import { RootCollectionFolderId } from "@/types"

// ------- from request-tabs.cancel.test.ts -------
vi.mock("@/bindings/knurl", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    cancelHttpRequest: vi.fn(async () => {}),
  }
})
import { cancelHttpRequest } from "@/bindings/knurl"
describe("requestTabsApi.cancelRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useApplication.setState((s) => {
      s.requestTabsState.openTabs = {
        t1: {
          tabId: "t1",
          order: 0,
          requestId: "req-1",
          collectionId: "col-1",
          activeTab: "params",
          sending: true,
          activeCorrelationId: "RID-123",
          response: {},
        } as any,
      }
      s.requestTabsState.activeTab = "t1"
      s.requestTabsState.orderedTabs = Object.values(s.requestTabsState.openTabs) as any
    })
  })

  it("calls cancelHttpRequest and clears sending/activeCorrelationId", async () => {
    const { requestTabsApi } = useApplication.getState()
    await requestTabsApi.cancelRequest("t1")
    expect(cancelHttpRequest).toHaveBeenCalledWith("RID-123")
    const tab = useApplication.getState().requestTabsState.openTabs.t1
    expect(tab.sending).toBe(false)
    expect(tab.activeCorrelationId).toBeUndefined()
  })
})

// ------- from request-tabs.remove-tab.test.ts -------
describe("requestTabsApi.removeTab", () => {
  beforeEach(() => {
    useApplication.setState((s) => {
      s.collectionsState.index = [{ id: "col-1", name: "C1", count: 1 } as any]
      s.collectionsState.cache["col-1"] = {
        id: "col-1",
        name: "C1",
        updated: new Date().toISOString(),
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {
          "req-1": {
            id: "req-1",
            name: "R1",
            collectionId: "col-1",
            folderId: RootCollectionFolderId,
            autoSave: false,
            method: "GET",
            url: "https://example.com",
            pathParams: {},
            queryParams: {},
            headers: {},
            body: { type: "none" },
            authentication: { type: "none" },
            patch: {},
            updated: 0,
          } as any,
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "Root",
            parentId: null,
            order: 0,
            childFolderIds: [],
            requestIds: ["req-1"],
          },
        },
        requestIndex: {
          "req-1": {
            folderId: RootCollectionFolderId,
            ancestry: [RootCollectionFolderId],
          },
        },
        authentication: { type: "none" },
      } as any
      s.requestTabsState.openTabs = {
        t1: {
          tabId: "t1",
          order: 0,
          requestId: "req-1",
          collectionId: "col-1",
          activeTab: "params",
          sending: false,
          response: {},
        } as any,
      }
      s.requestTabsState.activeTab = "t1"
      s.requestTabsState.orderedTabs = Object.values(s.requestTabsState.openTabs) as any
    })
  })

  it("does not delete a persisted request when autoSave is false; discards patch", async () => {
    const { requestTabsApi, collectionsApi } = useApplication.getState()
    useApplication.setState((s) => {
      ;(s.collectionsState.cache["col-1"].requests["req-1"].patch as any) = { name: "Changed" }
    })
    await requestTabsApi.removeTab("t1")
    const request = await collectionsApi.getRequest("col-1", "req-1")
    expect(request).toBeTruthy()
    expect(request.patch).toEqual({})
    expect(request.name).toBe("R1")
  })

  it("commits patch when autoSave is true", async () => {
    const { requestTabsApi, collectionsApi } = useApplication.getState()
    useApplication.setState((s) => {
      s.collectionsState.cache["col-1"].requests["req-1"].autoSave = true as any
      ;(s.collectionsState.cache["col-1"].requests["req-1"].patch as any) = { name: "Saved Name" }
    })
    await requestTabsApi.removeTab("t1")
    const request = await collectionsApi.getRequest("col-1", "req-1")
    expect(request.name).toBe("Saved Name")
    expect(request.patch).toEqual({})
  })

  it("commits patch when autoSave is true in patch (base false)", async () => {
    const { requestTabsApi, collectionsApi } = useApplication.getState()
    useApplication.setState((s) => {
      s.collectionsState.cache["col-1"].requests["req-1"].autoSave = false as any
      ;(s.collectionsState.cache["col-1"].requests["req-1"].patch as any) = { autoSave: true, name: "Saved Patch Name" }
    })
    await requestTabsApi.removeTab("t1")
    const request = await collectionsApi.getRequest("col-1", "req-1")
    expect(request.name).toBe("Saved Patch Name")
    expect(request.patch).toEqual({})
    expect(request.autoSave).toBe(true)
  })

  it("commits only autoSave toggle and clears patch when patch has autoSave only", async () => {
    const { requestTabsApi, collectionsApi } = useApplication.getState()
    useApplication.setState((s) => {
      s.collectionsState.cache["col-1"].requests["req-1"].autoSave = false as any
      ;(s.collectionsState.cache["col-1"].requests["req-1"].patch as any) = { autoSave: true }
    })
    await requestTabsApi.removeTab("t1")
    const request = await collectionsApi.getRequest("col-1", "req-1")
    expect(request.autoSave).toBe(true)
    expect(request.patch).toEqual({})
    expect(request.name).toBe("R1") // unchanged
  })

  it("does not commit when base autoSave is true but patch sets autoSave false; discards patch", async () => {
    const { requestTabsApi, collectionsApi } = useApplication.getState()
    useApplication.setState((s) => {
      s.collectionsState.cache["col-1"].requests["req-1"].autoSave = true as any
      ;(s.collectionsState.cache["col-1"].requests["req-1"].patch as any) = { autoSave: false, name: "Should Not Save" }
    })
    await requestTabsApi.removeTab("t1")
    const request = await collectionsApi.getRequest("col-1", "req-1")
    expect(request.autoSave).toBe(true) // unchanged
    expect(request.name).toBe("R1") // not saved
    expect(request.patch).toEqual({}) // discarded
  })
})

describe("requestTabsApi bulk close helpers", () => {
  beforeEach(() => {
    useApplication.setState((s) => {
      const now = new Date().toISOString()
      s.collectionsState.index = [{ id: "col-1", name: "C1", count: 3 } as any]
      s.collectionsState.cache["col-1"] = {
        id: "col-1",
        name: "C1",
        updated: now,
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {
          "req-1": {
            id: "req-1",
            name: "R1",
            collectionId: "col-1",
            folderId: RootCollectionFolderId,
            autoSave: false,
            method: "GET",
            url: "https://example.com/1",
            pathParams: {},
            queryParams: {},
            headers: {},
            body: { type: "none" },
            authentication: { type: "none" },
            patch: {},
            updated: 0,
          } as any,
          "req-2": {
            id: "req-2",
            name: "R2",
            collectionId: "col-1",
            folderId: RootCollectionFolderId,
            autoSave: false,
            method: "GET",
            url: "https://example.com/2",
            pathParams: {},
            queryParams: {},
            headers: {},
            body: { type: "none" },
            authentication: { type: "none" },
            patch: {},
            updated: 0,
          } as any,
          "req-3": {
            id: "req-3",
            name: "R3",
            collectionId: "col-1",
            folderId: RootCollectionFolderId,
            autoSave: false,
            method: "GET",
            url: "https://example.com/3",
            pathParams: {},
            queryParams: {},
            headers: {},
            body: { type: "none" },
            authentication: { type: "none" },
            patch: {},
            updated: 0,
          } as any,
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "Root",
            parentId: null,
            order: 0,
            childFolderIds: [],
            requestIds: ["req-1", "req-2", "req-3"],
          },
        },
        requestIndex: {
          "req-1": { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] },
          "req-2": { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] },
          "req-3": { folderId: RootCollectionFolderId, ancestry: [RootCollectionFolderId] },
        },
        authentication: { type: "none" },
      } as any

      s.requestTabsState.openTabs = {
        t1: {
          tabId: "t1",
          order: 0,
          requestId: "req-1",
          collectionId: "col-1",
          activeTab: "params",
          sending: false,
          response: {},
        } as any,
        t2: {
          tabId: "t2",
          order: 1,
          requestId: "req-2",
          collectionId: "col-1",
          activeTab: "params",
          sending: false,
          response: {},
        } as any,
        t3: {
          tabId: "t3",
          order: 2,
          requestId: "req-3",
          collectionId: "col-1",
          activeTab: "params",
          sending: false,
          response: {},
        } as any,
      }
      s.requestTabsState.activeTab = "t2"
      s.requestTabsState.orderedTabs = Object.values(s.requestTabsState.openTabs)
        .sort((a: any, b: any) => a.order - b.order) as any
    })
  })

  it("closeAllTabs removes every tab", async () => {
    const { requestTabsApi } = useApplication.getState()
    await requestTabsApi.closeAllTabs()
    const state = useApplication.getState().requestTabsState
    expect(Object.keys(state.openTabs).length).toBe(0)
    expect(state.activeTab).toBeNull()
  })

  it("closeTabsToLeft removes tabs before the target", async () => {
    const { requestTabsApi } = useApplication.getState()
    await requestTabsApi.closeTabsToLeft("t2")
    const state = useApplication.getState().requestTabsState
    expect(state.openTabs.t1).toBeUndefined()
    expect(state.openTabs.t2).toBeDefined()
    expect(state.openTabs.t3).toBeDefined()
    expect(state.activeTab).toBe("t2")
  })

  it("closeTabsToRight removes tabs after the target", async () => {
    const { requestTabsApi } = useApplication.getState()
    await requestTabsApi.closeTabsToRight("t2")
    const state = useApplication.getState().requestTabsState
    expect(state.openTabs.t3).toBeUndefined()
    expect(state.openTabs.t2).toBeDefined()
    expect(state.openTabs.t1).toBeDefined()
    expect(state.activeTab).toBe("t2")
  })
})

// ------- from request-tabs.misc.test.ts -------
import type { LogLevel } from "@/types"
describe("request-tabs misc APIs", () => {
  it("clearResponse empties response and setResponseLogFilter sets levels", () => {
    useApplication.setState((s) => {
      s.requestTabsState.openTabs = {
        t1: {
          tabId: "t1",
          order: 0,
          requestId: "req-1",
          collectionId: "col-1",
          activeTab: "params",
          sending: false,
          response: { logs: [{ requestId: "x", message: "m", level: "info" as LogLevel }], logFilterLevels: ["info"] },
        } as any,
      }
      s.requestTabsState.activeTab = "t1"
      s.requestTabsState.orderedTabs = Object.values(s.requestTabsState.openTabs) as any
    })
    const { requestTabsApi } = useApplication.getState()
    requestTabsApi.clearResponse("t1")
    let tab = useApplication.getState().requestTabsState.openTabs.t1
    expect(tab.response?.logs?.length ?? 0).toBe(0)
    requestTabsApi.setResponseLogFilter("t1", ["error", "warn"])
    tab = useApplication.getState().requestTabsState.openTabs.t1
    expect(tab.response?.logFilterLevels).toEqual(["error", "warn"])
  })
})

// ------- from request-tabs.send.test.ts -------
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}))
vi.mock("@/request/pipeline", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    runPipeline: vi.fn(async (_phases, _ctx, notifier) => {
      notifier.onStart()
      notifier.onSuccess({ requestId: "RID", status: 200 } as any)
    }),
  }
})
describe("requestTabsApi.sendRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useApplication.setState((s) => {
      s.collectionsState.index = [{ id: "col-1", name: "C1", count: 1 } as any]
      s.collectionsState.cache["col-1"] = {
        id: "col-1",
        name: "C1",
        updated: new Date().toISOString(),
        encryption: { algorithm: "aes-gcm" },
        environments: {},
        requests: {
          "req-1": {
            id: "req-1",
            name: "R1",
            collectionId: "col-1",
            folderId: RootCollectionFolderId,
            autoSave: false,
            method: "GET",
            url: "https://example.com",
            pathParams: {},
            queryParams: {},
            headers: {},
            body: { type: "none" },
            authentication: { type: "none" },
            patch: {},
            updated: 0,
          } as any,
        },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "Root",
            parentId: null,
            order: 0,
            childFolderIds: [],
            requestIds: ["req-1"],
          },
        },
        requestIndex: {
          "req-1": {
            folderId: RootCollectionFolderId,
            ancestry: [RootCollectionFolderId],
          },
        },
        authentication: { type: "none" },
      } as any
      s.requestTabsState.openTabs = {
        t1: {
          tabId: "t1",
          order: 0,
          requestId: "req-1",
          collectionId: "col-1",
          activeTab: "params",
          sending: false,
          response: {},
        } as any,
      }
      s.requestTabsState.activeTab = "t1"
    })
  })

  it("sets sending state, assigns correlation id, and clears after success", async () => {
    const { requestTabsApi, collectionsApi } = useApplication.getState()
    await collectionsApi.getCollection("col-1")
    const req = await collectionsApi.getRequest("col-1", "req-1")
    await requestTabsApi.sendRequest("t1", req)
    const tab = useApplication.getState().requestTabsState.openTabs.t1
    expect(tab.sending).toBe(false)
    expect(tab.activeCorrelationId).toBeUndefined()
    expect(tab.response).toBeTruthy()
  })
})

import React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

import type { DragEndEvent } from "@dnd-kit/core"
import { RootCollectionFolderId } from "@/types"

const dndHandlers: {
  onDragStart?: (event: any) => void
  onDragOver?: (event: any) => void
  onDragEnd?: (event: any) => void
  onDragCancel?: () => void
} = {}

const mockRenameDialog = vi.fn()
const mockDeleteDialog = vi.fn()
const collectionMenuHandlers: Record<string, (payload: any) => void> = {}
const folderMenuHandlers: Record<string, (payload: any) => void> = {}
const requestMenuHandlers: Record<string, (payload: any) => void> = {}

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core")
  return {
    ...actual,
    DndContext: ({ onDragStart, onDragOver, onDragEnd, onDragCancel, children }: any) => {
      dndHandlers.onDragStart = onDragStart
      dndHandlers.onDragOver = onDragOver
      dndHandlers.onDragEnd = onDragEnd
      dndHandlers.onDragCancel = onDragCancel
      return <div data-test-id="mock-dnd-context">{children}</div>
    },
  }
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing element with data-test-id=${id}`)
  }
  return el as HTMLElement
}

vi.mock("@/components/ui/knurl/rename-dialog", () => ({
  __esModule: true,
  default: (props: any) => {
    mockRenameDialog(props)
    return (
      <div data-test-id="mock-rename-dialog">
        <span>{props.title}</span>
        <span>{props.description}</span>
      </div>
    )
  },
}))

vi.mock("@/components/shared/delete-dialog", () => ({
  __esModule: true,
  default: (props: any) => {
    mockDeleteDialog(props)
    return (
      <div data-test-id="mock-delete-dialog">
        <span>{props.title}</span>
        <span>{props.description}</span>
      </div>
    )
  },
}))

vi.mock("@/components/ui/knurl/collection-menu", () => ({
  CollectionMenuContent: ({ onAction, collection }: any) => {
    collectionMenuHandlers[collection.id] = onAction
    return <div data-test-id={`mock-collection-menu:${collection.id}`} />
  },
}))

vi.mock("@/components/ui/knurl/folder-menu", () => ({
  FolderMenuContent: ({ onAction, collectionId, folder }: any) => {
    folderMenuHandlers[folder.id] = onAction
    return <div data-test-id={`mock-folder-menu:${folder.id}`} />
  },
}))

vi.mock("@/components/ui/knurl/request-menu", () => ({
  RequestMenuContent: ({ onAction, requestId }: any) => {
    requestMenuHandlers[requestId] = onAction
    return <div data-test-id={`mock-request-menu:${requestId}`} />
  },
}))

const stateMocks = vi.hoisted(() => {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
  const mockCollectionsApi = {
    reorderCollections: vi.fn(),
    moveFolder: vi.fn(),
    moveRequestToFolder: vi.fn(),
    deleteFolder: vi.fn(),
    createFolder: vi.fn(),
    loadCollection: vi.fn(async () => {}),
    duplicateRequest: vi.fn(),
    getRequest: vi.fn(),
    updateCollection: vi.fn(),
    updateRequest: vi.fn(),
    renameFolder: vi.fn(),
    deleteRequest: vi.fn(),
    removeCollection: vi.fn(),
    clearScratchCollection: vi.fn(),
  }

  const mockRequestTabsApi = {
    getOpenTab: vi.fn(),
    removeTab: vi.fn(),
    loadTab: vi.fn(),
    openRequestTab: vi.fn(),
    createRequestTab: vi.fn(),
    setResponseLogFilter: vi.fn(),
  }

  const mockUtilitySheetsApi = {
    openSheet: vi.fn(),
  }

  const rootId = "root"

  const baseCollectionsById = {
    "col-1": {
      id: "col-1",
      name: "Alpha",
      description: "",
      encryption: { algorithm: "aes-gcm" },
      authentication: { type: "none" },
      folders: {
        [rootId]: {
          id: rootId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: ["folder-1", "folder-2"],
          requestIds: [],
        },
        "folder-1": {
          id: "folder-1",
          name: "Folder One",
          parentId: rootId,
          order: 0,
          childFolderIds: [],
          requestIds: ["req-1", "req-target"],
        },
        "folder-2": {
          id: "folder-2",
          name: "Folder Two",
          parentId: rootId,
          order: 1,
          childFolderIds: [],
          requestIds: [],
        },
      },
      requests: {
        "req-1": {
          id: "req-1",
          name: "List Users",
          method: "GET",
          url: "https://api.example.com/users",
          authentication: { type: "none" },
          headers: [],
          query: [],
          body: { type: "json", value: "" },
          variables: [],
          patch: null,
        },
        "req-target": {
          id: "req-target",
          name: "Get Target",
          method: "POST",
          url: "https://api.example.com/target",
          authentication: { type: "none" },
          headers: [],
          query: [],
          body: { type: "json", value: "" },
          variables: [],
          patch: null,
        },
      },
    },
    "col-2": {
      id: "col-2",
      name: "Beta",
      description: "",
      encryption: { algorithm: "aes-gcm" },
      authentication: { type: "none" },
      folders: {
        [rootId]: {
          id: rootId,
          name: "Root",
          parentId: null,
          order: 0,
          childFolderIds: [],
          requestIds: [],
        },
      },
      requests: {},
    },
  }

  const baseCollectionsIndex = [
    { id: "col-1", name: "Alpha", order: 0 },
    { id: "col-2", name: "Beta", order: 1 },
  ]

  const state = {
    mockCollectionsApi,
    mockRequestTabsApi,
    mockUtilitySheetsApi,
    collectionsById: {} as typeof baseCollectionsById,
    collectionsIndex: [] as typeof baseCollectionsIndex,
    mockUseApplication: undefined as any,
    sidebarCollapsed: false,
    expandSidebarMock: vi.fn(),
    reset: () => {
      state.collectionsById = clone(baseCollectionsById)
      state.collectionsIndex = clone(baseCollectionsIndex)
      state.sidebarCollapsed = false
      state.expandSidebarMock = vi.fn()
    },
  }

  state.reset()

  const mockUseApplication: any = vi.fn((selector?: (state: any) => unknown) => {
    const current = { collectionsState: { cache: state.collectionsById } }
    return typeof selector === "function" ? selector(current) : current
  })
  mockUseApplication.getState = () => ({ collectionsState: { cache: state.collectionsById } })
  state.mockUseApplication = mockUseApplication

  return state
})

vi.mock("@/state", () => ({
  useCollections: () => ({
    state: { collectionsIndex: stateMocks.collectionsIndex },
    actions: { collectionsApi: () => stateMocks.mockCollectionsApi },
  }),
  useSidebar: () => ({
    state: { isCollapsed: stateMocks.sidebarCollapsed },
    actions: { expandSidebar: stateMocks.expandSidebarMock },
  }),
  useOpenTabs: () => ({
    actions: { requestTabsApi: stateMocks.mockRequestTabsApi },
  }),
  useUtilitySheets: () => ({
    actions: { utilitySheetsApi: stateMocks.mockUtilitySheetsApi },
  }),
  utilitySheetsApi: () => stateMocks.mockUtilitySheetsApi,
  useCollection: (collectionId: string) => ({
    state: { collection: stateMocks.collectionsById[collectionId as keyof typeof stateMocks.collectionsById] },
  }),
  useCollectionFromCache: (collectionId: string) => ({
    state: { collection: stateMocks.collectionsById[collectionId as keyof typeof stateMocks.collectionsById] },
    actions: { collectionsApi: () => stateMocks.mockCollectionsApi },
  }),
  useApplication: stateMocks.mockUseApplication,
  isScratchCollection: () => false,
}))

import { CollectionTree } from "./collection-tree"

describe("CollectionTree", () => {
  beforeEach(() => {
    stateMocks.reset()
    vi.clearAllMocks()
    mockRenameDialog.mockClear()
    mockDeleteDialog.mockClear()
    Object.keys(collectionMenuHandlers).forEach((key) => delete collectionMenuHandlers[key])
    Object.keys(folderMenuHandlers).forEach((key) => delete folderMenuHandlers[key])
    Object.keys(requestMenuHandlers).forEach((key) => delete requestMenuHandlers[key])
    // minimal clipboard stub for copy action
    // @ts-expect-error test shim
    global.navigator = {
      ...(global.navigator ?? {}),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    } as any
  })

  it("renders and captures DnD handlers", () => {
    render(<CollectionTree searchTerm="" />)
    expect(dndHandlers.onDragEnd).toBeTruthy()
  })

  it("reorders collections when dragging collections", () => {
    render(<CollectionTree searchTerm="" />)
    dndHandlers.onDragEnd?.({
      active: { id: "col-1", data: { current: { type: "collection" } } },
      over: { id: "col-2", data: { current: { type: "collection" } } },
    } as DragEndEvent)

    expect(stateMocks.mockCollectionsApi.reorderCollections).toHaveBeenCalledWith(["col-2", "col-1"])
  })

  it("moves folders to the root when dropped on a collection", () => {
    render(<CollectionTree searchTerm="" />)
    dndHandlers.onDragEnd?.({
      active: {
        id: "folder-1",
        data: { current: { type: "folder-item", collectionId: "col-1", folderId: "folder-1" } },
      },
      over: { id: "col-1", data: { current: { type: "collection" } } },
    } as DragEndEvent)

    expect(stateMocks.mockCollectionsApi.moveFolder).toHaveBeenCalledWith("col-1", "folder-1", RootCollectionFolderId)
  })

  it("moves requests into folders when dropped over a folder", () => {
    render(<CollectionTree searchTerm="" />)
    dndHandlers.onDragEnd?.({
      active: {
        id: "req-1",
        data: {
          current: {
            type: "request-item",
            collectionId: "col-1",
            requestId: "req-1",
            folderId: "folder-1",
            siblings: ["req-1"],
          },
        },
      },
      over: {
        id: "folder-2",
        data: { current: { type: "folder-item", collectionId: "col-1", folderId: "folder-2" } },
      },
    } as DragEndEvent)

    expect(stateMocks.mockCollectionsApi.moveRequestToFolder).toHaveBeenCalledWith("col-1", "req-1", "folder-2")
  })

  it("derives action payloads from dataset when clicking a collection row", async () => {
    const user = userEvent.setup()
    render(<CollectionTree searchTerm="" />)
    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }))

    expect(stateMocks.mockCollectionsApi.loadCollection).toHaveBeenCalledWith("col-1")
    expect(await screen.findByText("Folder One")).toBeInTheDocument()
  })

  const triggerCollectionAction = async (collectionId: string, payload: any) => {
    await waitFor(() => expect(collectionMenuHandlers[collectionId]).toBeDefined())
    await act(async () => {
      collectionMenuHandlers[collectionId]?.(payload)
    })
  }

  const triggerFolderAction = async (folderId: string, payload: any) => {
    await waitFor(() => expect(folderMenuHandlers[folderId]).toBeDefined())
    await act(async () => {
      folderMenuHandlers[folderId]?.(payload)
    })
  }

  const triggerRequestAction = async (requestId: string, payload: any) => {
    await waitFor(() => expect(requestMenuHandlers[requestId]).toBeDefined())
    await act(async () => {
      requestMenuHandlers[requestId]?.(payload)
    })
  }

  it("opens rename dialog when collection rename action is triggered", async () => {
    render(<CollectionTree searchTerm="" />)

    await triggerCollectionAction("col-1", {
      actionId: "rename",
      kind: "collection",
      collectionId: "col-1",
      name: "Alpha",
    })

    expect(mockRenameDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Rename Collection",
        name: "Alpha",
      }),
    )
  })

  it("opens folder-create dialog when creating a new folder", async () => {
    render(<CollectionTree searchTerm="" />)

    await triggerCollectionAction("col-1", {
      actionId: "new-folder",
      kind: "collection",
      collectionId: "col-1",
    })

    expect(mockRenameDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        submitLabel: "Create",
        title: "Create Folder",
      }),
    )
  })

  it("shows delete confirmation when invoking clear scratch action", async () => {
    render(<CollectionTree searchTerm="" />)

    await triggerCollectionAction("col-1", {
      actionId: "clear-scratch",
      kind: "collection",
      collectionId: "col-1",
      name: "Alpha",
    })

    expect(mockDeleteDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Clear All Requests",
      }),
    )
  })

  it("opens folder delete dialog via folder menu action", async () => {
    const user = userEvent.setup()
    render(<CollectionTree searchTerm="" />)

    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }))
    await triggerFolderAction("folder-1", {
      actionId: "folder:delete",
      kind: "folder",
      collectionId: "col-1",
      name: "Folder One",
      folderId: "folder-1",
    })

    expect(mockDeleteDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete Folder",
        context: expect.objectContaining({ folderId: "folder-1" }),
      }),
    )
  })

  const triggerRequestDragOver = (overId: string, pointerY: number, overHeight = 90) => {
    dndHandlers.onDragOver?.({
      active: {
        id: "req-1",
        data: {
          current: {
            type: "request-item",
            collectionId: "col-1",
            requestId: "req-1",
            folderId: "folder-1",
            siblings: ["req-1"],
          },
        },
        rect: {
          current: {
            translated: {
              top: pointerY,
              height: 10,
            },
          },
        },
      },
      over: {
        id: overId,
        data: {
          current: {
            type: "collection",
          },
        },
        rect: {
          top: 0,
          height: overHeight,
        },
      },
    })
  }

  it("shows middle drop indicator when dragging a request over a collection", async () => {
    render(<CollectionTree searchTerm="" />)
    await act(async () => {
      triggerRequestDragOver("col-2", 45)
    })
    const row = screen.getByRole("treeitem", { name: /Beta/ })
    expect(row.className).toContain("bg-primary/10")
  })

  it("shows top indicator when pointer is near top of target row", async () => {
    render(<CollectionTree searchTerm="" />)
    await act(async () => {
      dndHandlers.onDragOver?.({
        active: {
          id: "col-1",
          data: { current: { type: "collection" } },
          rect: { current: { translated: { top: 0, height: 10 } } },
        },
        over: {
          id: "col-2",
          data: { current: { type: "collection" } },
          rect: { top: 0, height: 90 },
        },
      })
    })
    const row = screen.getByRole("treeitem", { name: /Beta/ })
    const wrapper = row.closest(".mb-2") as HTMLElement | null
    const indicators = Array.from(wrapper?.querySelectorAll("div") ?? [])
    const topIndicator = indicators.find((node) => {
      const cls = node.getAttribute("class") ?? ""
      return cls.includes("top-0") && cls.includes("bg-primary")
    })
    expect(topIndicator).toBeTruthy()
  })

  it("shows bottom indicator when pointer is near the bottom of target row", async () => {
    render(<CollectionTree searchTerm="" />)
    await act(async () => {
      dndHandlers.onDragOver?.({
        active: {
          id: "col-1",
          data: { current: { type: "collection" } },
          rect: { current: { translated: { top: 400, height: 10 } } },
        },
        over: {
          id: "col-2",
          data: { current: { type: "collection" } },
          rect: { top: 0, height: 90 },
        },
      })
    })
    const row = screen.getByRole("treeitem", { name: /Beta/ })
    const wrapper = row.closest(".mb-2") as HTMLElement | null
    const indicators = Array.from(wrapper?.querySelectorAll("div") ?? [])
    const bottomIndicator = indicators.find((node) => {
      const cls = node.getAttribute("class") ?? ""
      return cls.includes("bottom-0") && cls.includes("bg-primary")
    })
    expect(bottomIndicator).toBeTruthy()
  })

  it("renders collapsed summary buttons and triggers sidebar expansion", async () => {
    const user = userEvent.setup()
    stateMocks.sidebarCollapsed = true
    stateMocks.collectionsIndex = Array.from({ length: 12 }, (_, index) => ({
      id: `col-${index + 1}`,
      name: `Collection ${index + 1}`,
      order: index,
    }))

    render(<CollectionTree searchTerm="" />)

    const collapsedButtons = document.querySelectorAll(
      '[data-test-id^="collection-tree:collapsed-collection-button:"]',
    )
    expect(collapsedButtons).toHaveLength(10)

    await user.click(collapsedButtons[0] as HTMLButtonElement)
    expect(stateMocks.expandSidebarMock).toHaveBeenCalled()
  })

  it("filters collections and requests when search is provided", () => {
    render(<CollectionTree searchTerm="users" />)

    expect(screen.getByRole("treeitem", { name: /Alpha/ })).toBeInTheDocument()
    expect(screen.queryByRole("treeitem", { name: /Beta/ })).toBeNull()

    const requestRow = getByDataId("collection-tree:request-row:req-1")
    expect(requestRow).toHaveTextContent("List Users")
  })

  it("reorders requests when dropping above a sibling", async () => {
    render(<CollectionTree searchTerm="" />)

    await act(async () => {
      dndHandlers.onDragOver?.({
        active: {
          id: "req-1",
          data: {
            current: {
              type: "request-item",
              collectionId: "col-1",
              requestId: "req-1",
              folderId: "folder-1",
              siblings: ["req-1", "req-target"],
            },
          },
          rect: { current: { translated: { top: 0, height: 10 } } },
        },
        over: {
          id: "req-target",
          data: {
            current: {
              type: "request-item",
              collectionId: "col-1",
              requestId: "req-target",
              folderId: "folder-1",
              siblings: ["req-1", "req-target"],
            },
          },
          rect: { top: 0, height: 90 },
        },
      })
    })

    await act(async () => {
      dndHandlers.onDragEnd?.({
        active: {
          id: "req-1",
          data: {
            current: {
              type: "request-item",
              collectionId: "col-1",
              requestId: "req-1",
              folderId: "folder-1",
              siblings: ["req-1", "req-target"],
            },
          },
        },
        over: {
          id: "req-target",
          data: {
            current: {
              type: "request-item",
              collectionId: "col-1",
              requestId: "req-target",
              folderId: "folder-1",
              siblings: ["req-1", "req-target"],
            },
          },
        },
      } as DragEndEvent)
    })

    expect(stateMocks.mockCollectionsApi.moveRequestToFolder).toHaveBeenCalledWith("col-1", "req-1", "folder-1", 1)
  })

  it("moves requests into root when dropped on collection row", () => {
    render(<CollectionTree searchTerm="" />)

    dndHandlers.onDragEnd?.({
      active: {
        id: "req-1",
        data: {
          current: {
            type: "request-item",
            collectionId: "col-1",
            requestId: "req-1",
            folderId: "folder-1",
            siblings: ["req-1"],
          },
        },
      },
      over: {
        id: "col-2",
        data: { current: { type: "collection", collectionId: "col-2" } },
      },
    } as DragEndEvent)

    expect(stateMocks.mockCollectionsApi.moveRequestToFolder).toHaveBeenCalledWith("col-1", "req-1", RootCollectionFolderId)
  })

  it("opens manage settings sheet from collection menu action", async () => {
    render(<CollectionTree searchTerm="" />)

    await triggerCollectionAction("col-1", {
      actionId: "manage-settings",
      kind: "collection",
      collectionId: "col-1",
    })

    expect(stateMocks.mockUtilitySheetsApi.openSheet).toHaveBeenCalledWith({
      type: "collection-settings",
      context: { collectionId: "col-1" },
    })
  })

  it("copies request JSON to clipboard via request menu action", async () => {
    stateMocks.mockCollectionsApi.getRequest.mockReturnValue({ id: "req-1", name: "List Users" })
    render(<CollectionTree searchTerm="" />)

    await triggerCollectionAction("col-1", {
      actionId: "select",
      kind: "collection",
      collectionId: "col-1",
    })

    await triggerRequestAction("req-1", {
      actionId: "copy",
      kind: "request",
      collectionId: "col-1",
      requestId: "req-1",
      name: "List Users",
    })

    expect(stateMocks.mockRequestTabsApi.loadTab).toHaveBeenCalledWith("col-1", "req-1")
    expect(stateMocks.mockCollectionsApi.getRequest).toHaveBeenCalledWith("col-1", "req-1")
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("List Users"))
  })

  it("creates a request in a folder via request:new action", async () => {
    const user = userEvent.setup()
    render(<CollectionTree searchTerm="" />)
    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }))

    await triggerFolderAction("folder-1", {
      actionId: "request:new",
      kind: "folder",
      collectionId: "col-1",
      folderId: "folder-1",
    })

    expect(stateMocks.mockRequestTabsApi.createRequestTab).toHaveBeenCalledWith("col-1", { folderId: "folder-1" })
  })

  it("reorders a folder relative to a sibling using top indicator", async () => {
    render(<CollectionTree searchTerm="" />)

    await act(async () => {
      dndHandlers.onDragOver?.({
        active: {
          id: "folder-2",
          data: {
            current: {
              type: "folder-item",
              collectionId: "col-1",
              folderId: "folder-2",
              parentId: "root",
              siblings: ["folder-1", "folder-2"],
              childFolderIds: [],
            },
          },
          rect: { current: { translated: { top: 0, height: 10 } } },
        },
        over: {
          id: "folder-1",
          data: {
            current: {
              type: "folder-item",
              collectionId: "col-1",
              folderId: "folder-1",
              parentId: "root",
              siblings: ["folder-1", "folder-2"],
              childFolderIds: [],
            },
          },
          rect: { top: 0, height: 90 },
        },
      })
    })

    await act(async () => {
      dndHandlers.onDragEnd?.({
        active: {
          id: "folder-2",
          data: {
            current: {
              type: "folder-item",
              collectionId: "col-1",
              folderId: "folder-2",
              parentId: "root",
              siblings: ["folder-1", "folder-2"],
              childFolderIds: [],
            },
          },
        },
        over: {
          id: "folder-1",
          data: {
            current: {
              type: "folder-item",
              collectionId: "col-1",
              folderId: "folder-1",
              parentId: "root",
              siblings: ["folder-1", "folder-2"],
              childFolderIds: [],
            },
          },
        },
      } as DragEndEvent)
    })

    expect(stateMocks.mockCollectionsApi.moveFolder).toHaveBeenCalledWith("col-1", "folder-2", "root", 0)
  })
})

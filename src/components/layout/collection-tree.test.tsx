import React from "react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import type { DragEndEvent } from "@dnd-kit/core"
import { RootCollectionFolderId } from "@/types"

const dndHandlers: {
  onDragStart?: (event: any) => void
  onDragOver?: (event: any) => void
  onDragEnd?: (event: any) => void
  onDragCancel?: () => void
} = {}

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

const stateMocks = vi.hoisted(() => {
  const mockCollectionsApi = {
    reorderCollections: vi.fn(),
    moveFolder: vi.fn(),
    moveRequestToFolder: vi.fn(),
    deleteFolder: vi.fn(),
    createFolder: vi.fn(),
  }

  const mockRequestTabsApi = {
    getOpenTab: vi.fn(),
    removeTab: vi.fn(),
  }

  const mockUtilitySheetsApi = {
    openSheet: vi.fn(),
  }

  const rootId = "root"

  const collectionsById = {
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
          requestIds: ["req-1"],
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

  const collectionsIndex = [
    { id: "col-1", name: "Alpha", order: 0 },
    { id: "col-2", name: "Beta", order: 1 },
  ]

  const mockUseApplication: any = vi.fn(() => ({ collectionsState: { cache: collectionsById } }))
  mockUseApplication.getState = () => ({ collectionsState: { cache: collectionsById } })

  return {
    mockCollectionsApi,
    mockRequestTabsApi,
    mockUtilitySheetsApi,
    collectionsById,
    collectionsIndex,
    mockUseApplication,
  }
})

vi.mock("@/state", () => ({
  useCollections: () => ({
    state: { collectionsIndex: stateMocks.collectionsIndex },
    actions: { collectionsApi: () => stateMocks.mockCollectionsApi },
  }),
  useSidebar: () => ({
    state: { isCollapsed: false },
    actions: { expandSidebar: vi.fn() },
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
  useApplication: stateMocks.mockUseApplication,
  isScratchCollection: () => false,
}))

import { CollectionTree } from "./collection-tree"

describe("CollectionTree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

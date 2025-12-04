import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => {
  const RootCollectionFolderId = "root"
  const baseCollection = {
    id: "col-1",
    name: "Alpha",
    description: "",
    encryption: { algorithm: "aes-gcm" as const },
    authentication: { type: "none" },
    folders: {
      [RootCollectionFolderId]: {
        id: RootCollectionFolderId,
        name: "Root",
        parentId: null,
        order: 0,
        childFolderIds: ["folder-1"],
        requestIds: ["req-1"],
      },
      "folder-1": {
        id: "folder-1",
        name: "Folder One",
        parentId: RootCollectionFolderId,
        order: 0,
        childFolderIds: [],
        requestIds: ["req-2"],
      },
    },
    requests: {
      "req-1": {
        id: "req-1",
        name: "Root Request",
        method: "GET",
        url: "/root",
        authentication: { type: "none" },
        headers: [],
        query: [],
        body: { type: "json", value: "" },
        variables: [],
        patch: null,
        folderId: RootCollectionFolderId,
      },
      "req-2": {
        id: "req-2",
        name: "Child Request",
        method: "POST",
        url: "/child",
        authentication: { type: "none" },
        headers: [],
        query: [],
        body: { type: "json", value: "" },
        variables: [],
        patch: null,
        folderId: "folder-1",
      },
    },
    requestIndex: {
      "req-1": { folderId: RootCollectionFolderId, ancestry: [] },
      "req-2": { folderId: "folder-1", ancestry: [RootCollectionFolderId, "folder-1"] },
    },
    environments: {},
  }

  const reset = () => ({
    collections: {
      "col-1": structuredClone(baseCollection),
      "col-2": {
        id: "col-2",
        name: "Beta",
        description: "",
        encryption: { algorithm: "aes-gcm" as const },
        authentication: { type: "none" },
        folders: {
          [RootCollectionFolderId]: {
            id: RootCollectionFolderId,
            name: "Root",
            parentId: null,
            order: 0,
            childFolderIds: [],
            requestIds: [],
          },
        },
        requests: {},
        requestIndex: {},
        environments: {},
      },
    },
    collectionsIndex: [
      { id: "col-1", name: "Alpha", order: 0 },
      { id: "col-2", name: "Beta", order: 1 },
    ],
    collectionTree: {
      searchTerm: "",
      expandedIds: { "col-1": true, "folder-1": true },
    },
    actions: {
      toggleExpanded: vi.fn(),
      setExpanded: vi.fn(),
      setSearchTerm: vi.fn(),
      clearSearch: vi.fn(),
    },
    requestTabsApi: {
      openRequestTab: vi.fn(),
    },
  })

  let current = reset()

  return {
    get current() {
      return current
    },
    reset: () => {
      current = reset()
    },
  }
})

vi.mock("@/components/ui/knurl", () => ({
  Clickable: ({ children, onClick, onKeyDown, ...props }: any) => (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} {...props}>
      {children}
    </div>
  ),
  HttpBadge: ({ method }: { method: string }) => <span data-testid="http-badge">{method}</span>,
}))

vi.mock("@/state", () => ({
  useCollections: () => ({ state: { collectionsIndex: state.current.collectionsIndex } }),
  useCollection: (collectionId: string) => ({ state: { collection: state.current.collections[collectionId] } }),
  useCollectionFromCache: (collectionId: string) => ({ state: { collection: state.current.collections[collectionId] } }),
  useCollectionTree: () => ({
    state: {
      searchTerm: state.current.collectionTree.searchTerm,
      expandedIds: state.current.collectionTree.expandedIds,
    },
    actions: state.current.actions,
  }),
  getRequestTabsApi: () => state.current.requestTabsApi,
}))

vi.mock("@/components/layout/collection-tree/context-menu", () => ({
  CollectionContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu-wrapper">{children}</div>
  ),
}))

let CollectionTree: typeof import("./collection-tree")["CollectionTree"]

beforeAll(async () => {
  ;({ CollectionTree } = await import("./collection-tree"))
})

beforeEach(() => {
  state.reset()
})

describe("CollectionTree", () => {
  it("renders expanded collections with folders and requests", () => {
    render(<CollectionTree />)

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Folder One")).toBeInTheDocument()
    expect(screen.getByText("Root Request")).toBeInTheDocument()
    expect(screen.getByText("Child Request")).toBeInTheDocument()
  })

  it("invokes toggleExpanded when clicking a collection row", async () => {
    const user = userEvent.setup()
    state.current.collectionTree.expandedIds = {}

    render(<CollectionTree />)

    await user.click(screen.getByRole("button", { name: /Alpha/ }))

    expect(state.current.actions.toggleExpanded).toHaveBeenCalledWith("col-1")
  })

  it("opens a request tab when a request row is clicked", async () => {
    const user = userEvent.setup()
    render(<CollectionTree />)

    const requestRow = screen.getByText("Child Request").closest('[data-kind="request"]')
    expect(requestRow).toBeTruthy()
    await user.click(requestRow as Element)

    expect(state.current.requestTabsApi.openRequestTab).toHaveBeenCalledWith("col-1", "req-2")
  })

  it("filters requests using the search term", () => {
    state.current.collectionTree.searchTerm = "child"

    render(<CollectionTree />)

    expect(screen.getByText("Child Request")).toBeInTheDocument()
    expect(screen.queryByText("Root Request")).toBeNull()
  })
})

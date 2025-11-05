import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Breadcrumbs } from "./breadcrumbs"
import { RootCollectionFolderId } from "@/types"

// Mock hooks
const mockCollection = {
  id: "col1",
  name: "Test Collection",
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
}

const mockCollectionsApi = {
  duplicateRequest: vi.fn(),
  moveRequestToFolder: vi.fn(),
  updateRequest: vi.fn(),
  renameFolder: vi.fn(),
  createFolder: vi.fn(),
  deleteRequest: vi.fn(),
  deleteFolder: vi.fn(),
}

vi.mock("@/state", () => ({
  useRequestTab: vi.fn(() => ({
    state: {
      activeTab: { collectionId: "col1", tabId: "tab-1" },
      request: { id: "req-1", name: "Test Request", collectionId: "col1" },
      original: { id: "req-1" },
      isDirty: false,
    },
    actions: { requestTabsApi: { setActiveTab: vi.fn() } },
  })),
  useCollection: vi.fn(() => ({
    state: { collection: mockCollection },
    actions: { collectionsApi: () => mockCollectionsApi },
  })),
  useCollections: vi.fn(() => ({
    state: { collectionsIndex: [] },
    actions: { collectionsApi: () => mockCollectionsApi },
  })),
  useOpenTabs: vi.fn(() => ({
    state: { openTabs: [] },
    actions: {
      requestTabsApi: {
        createRequestTab: vi.fn(),
        loadTab: vi.fn(),
        getOpenTab: vi.fn(() => undefined),
        removeTab: vi.fn(),
      },
    },
  })),
  isScratchCollection: vi.fn(() => false),
}))

// Mock shared components
vi.mock("@/components/ui/knurl/collection-menu", () => ({
  CollectionMenuContent: ({ collection, exclude }: { collection: any; exclude: string[] }) => (
    <div data-testid="collection-menu-content">
      <p>{collection.name}</p>
      <p>{exclude.join(",")}</p>
    </div>
  ),
}))
vi.mock("@/components/ui/knurl/folder-menu", () => ({
  FolderMenuContent: () => <div data-testid="folder-menu-content" />,
}))
vi.mock("@/components/ui/knurl/request-menu", () => ({
  RequestMenuContent: () => <div data-testid="request-menu-content" />,
}))

describe("Breadcrumbs", () => {
  it("renders collection and request names", async () => {
    render(<Breadcrumbs />)
    const cols = await screen.findAllByText("Test Collection")
    expect(cols.length).toBeGreaterThan(0)
    expect(screen.getByText("Test Request")).toBeInTheDocument()
  })

  it("renders the collection name as a dropdown trigger", async () => {
    render(<Breadcrumbs />)
    const trigger = await screen.findByRole("button", { name: "Test Collection" })
    expect(trigger).toBeInTheDocument()
  })

  it("opens the collection menu and passes the correct props", async () => {
    render(<Breadcrumbs />)
    const trigger = await screen.findByRole("button", { name: "Test Collection" })
    fireEvent.click(trigger)

    const menu = await screen.findByTestId("collection-menu-content")
    expect(menu).toBeInTheDocument()
    // Scope assertions within the menu content to avoid duplicate matches
    const { getByText } = require("@testing-library/react").within(menu)
    expect(getByText("Test Collection")).toBeInTheDocument()
    expect(getByText("delete,clear-scratch")).toBeInTheDocument()
  })
})

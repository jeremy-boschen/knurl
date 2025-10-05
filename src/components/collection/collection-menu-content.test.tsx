import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { CollectionState } from "@/types"
import { RootCollectionFolderId } from "@/types"
import { CollectionMenuContent, type CollectionAction } from "./collection-menu-content"

const mockCollectionsApi = {
  clearScratchCollection: vi.fn(),
  removeCollection: vi.fn(),
  createFolder: vi.fn(async () => ({ id: "f1", name: "New", parentId: "root", order: 1, childFolderIds: [], requestIds: [] })),
}
const mockRequestsTabsApi = {
  createRequestTab: vi.fn(),
}
const mockSheetsApi = {
  openSheet: vi.fn(),
}
const mockUseNavigate = vi.fn()

vi.mock("@/state", () => ({
  useCollections: () => ({
    state: { collectionsIndex: [] },
    actions: { collectionsApi: () => mockCollectionsApi },
  }),
  useOpenTabs: () => ({
    state: { openTabs: [] },
    actions: { requestTabsApi: mockRequestsTabsApi },
  }),
  utilitySheetsApi: () => mockSheetsApi,
  useNavigate: () => mockUseNavigate,
  isScratchCollection: (id: string) => id === "scratch-col",
}))

const mockCollection: CollectionState = {
  id: "col1",
  name: "Test Collection",
  authentication: { type: "none" },
  environments: {},
  requests: {},
  updated: "",
  encryption: { algorithm: "aes-gcm" },
}

const mockScratchCollection: CollectionState = {
  ...mockCollection,
  id: "scratch-col",
  name: "Scratch Pad",
}

const TestProvider = ({
  collection,
  exclude,
}: {
  collection: CollectionState
  exclude?: CollectionAction[]
}) => (
  <DropdownMenu open={true}>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <CollectionMenuContent collection={collection} exclude={exclude} />
  </DropdownMenu>
)

describe("CollectionMenuContent", () => {
  it("renders all standard menu items for a regular collection", () => {
    render(<TestProvider collection={mockCollection} />)
    expect(screen.getByText("New Request")).toBeInTheDocument()
    expect(screen.getByText("New Folder")).toBeInTheDocument()
    expect(screen.getByText("Rename")).toBeInTheDocument()
    expect(screen.getByText("Manage Settings")).toBeInTheDocument()
    expect(screen.getByText("Export")).toBeInTheDocument()
    expect(screen.getByText("Delete")).toBeInTheDocument()
    expect(screen.queryByText("Clear All")).not.toBeInTheDocument()
  })

  it("renders 'Clear All' instead of 'Delete' for the scratch collection", () => {
    render(<TestProvider collection={mockScratchCollection} />)
    expect(screen.getByText("Clear All")).toBeInTheDocument()
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
    expect(screen.queryByText("New Folder")).not.toBeInTheDocument()
  })

  it("excludes specified actions", () => {
    render(<TestProvider collection={mockCollection} exclude={["delete", "export", "new-folder"]} />)
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
    expect(screen.queryByText("Export")).not.toBeInTheDocument()
    expect(screen.queryByText("New Folder")).not.toBeInTheDocument()
    expect(screen.getByText("New Request")).toBeInTheDocument()
  })

  it("calls the correct API when 'New Request' is clicked", () => {
    render(<TestProvider collection={mockCollection} />)
    fireEvent.click(screen.getByText("New Request"))
    expect(mockRequestsTabsApi.createRequestTab).toHaveBeenCalledWith("col1")
  })

  it("calls the correct API when 'Manage Settings' is clicked", () => {
    render(<TestProvider collection={mockCollection} />)
    fireEvent.click(screen.getByText("Manage Settings"))
    expect(mockSheetsApi.openSheet).toHaveBeenCalledWith({
      type: "collection-settings",
      context: { collectionId: "col1" },
    })
  })

  it("calls the correct API when 'New Folder' is clicked", () => {
    render(<TestProvider collection={mockCollection} />)
    fireEvent.click(screen.getByText("New Folder"))
    expect(mockCollectionsApi.createFolder).toHaveBeenCalledWith("col1", RootCollectionFolderId, "New Folder")
  })

  it("calls the correct API when 'Delete' is clicked", () => {
    render(<TestProvider collection={mockCollection} />)
    fireEvent.click(screen.getByText("Delete"))
    expect(mockCollectionsApi.removeCollection).toHaveBeenCalledWith("col1")
  })

  it("calls the correct API when 'Clear All' is clicked", () => {
    render(<TestProvider collection={mockScratchCollection} />)
    fireEvent.click(screen.getByText("Clear All"))
    expect(mockCollectionsApi.clearScratchCollection).toHaveBeenCalled()
  })
})

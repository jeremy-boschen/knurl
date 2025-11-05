import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import {describe, expect, it, vi} from "vitest"

import {DropdownMenu, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import type {Collection} from "@/types"
import {RootCollectionFolderId} from "@/types"
import {type CollectionAction, CollectionMenuContent} from "./collection-menu"

const mockCollectionsApi = {
  clearScratchCollection: vi.fn(),
  removeCollection: vi.fn(),
  createFolder: vi.fn(() => ({
    id: "f1",
    name: "New",
    parentId: "root",
    order: 1,
    childFolderIds: [],
    requestIds: [],
  })),
  loadCollection: vi.fn(async () => mockCollection),
  getCollection: vi.fn(() => mockCollection),
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
    state: {collectionsIndex: []},
    actions: {collectionsApi: () => mockCollectionsApi},
  }),
  useOpenTabs: () => ({
    state: {openTabs: []},
    actions: {requestTabsApi: mockRequestsTabsApi},
  }),
  utilitySheetsApi: () => mockSheetsApi,
  useNavigate: () => mockUseNavigate,
  isScratchCollection: (id: string) => id === "scratch-col",
}))

const mockCollection: Collection = {
  id: "col1",
  name: "Test Collection",
  authentication: {type: "none"},
  environments: {},
  requests: {},
  updated: "",
  encryption: {algorithm: "aes-gcm"},
}

const mockScratchCollection: Collection = {
  ...mockCollection,
  id: "scratch-col",
  name: "Scratch Pad",
}

const TestProvider = ({
                        collection,
                        exclude,
                      }: {
  collection: Collection
  exclude?: CollectionAction[]
}) => (
  <DropdownMenu open={true}>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <CollectionMenuContent collection={collection} exclude={exclude}/>
  </DropdownMenu>
)

describe("CollectionMenuContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders all standard menu items for a regular collection", () => {
    render(<TestProvider collection={mockCollection}/>)
    expect(screen.getByText("New Request")).toBeInTheDocument()
    expect(screen.getByText("New Folder")).toBeInTheDocument()
    expect(screen.getByText("Rename")).toBeInTheDocument()
    expect(screen.getByText("Manage Settings")).toBeInTheDocument()
    expect(screen.getByText("Export")).toBeInTheDocument()
    expect(screen.getByText("Delete")).toBeInTheDocument()
    expect(screen.queryByText("Clear All")).not.toBeInTheDocument()
  })

  it("renders 'Clear All' instead of 'Delete' for the scratch collection", () => {
    render(<TestProvider collection={mockScratchCollection}/>)
    expect(screen.getByText("Clear All")).toBeInTheDocument()
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
    expect(screen.queryByText("New Folder")).not.toBeInTheDocument()
  })

  it("excludes specified actions", () => {
    render(<TestProvider collection={mockCollection} exclude={["delete", "export", "new-folder"]}/>)
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
    expect(screen.queryByText("Export")).not.toBeInTheDocument()
    expect(screen.queryByText("New Folder")).not.toBeInTheDocument()
    expect(screen.getByText("New Request")).toBeInTheDocument()
  })

  it("calls the correct API when 'New Request' is clicked", () => {
    render(<TestProvider collection={mockCollection}/>)
    fireEvent.click(screen.getByText("New Request"))
    return waitFor(() => expect(mockRequestsTabsApi.createRequestTab).toHaveBeenCalledWith("col1"))
  })

  it("loads the collection before exporting", () => {
    render(<TestProvider collection={mockCollection}/>)
    fireEvent.click(screen.getByText("Export"))
    return waitFor(() => {
      expect(mockSheetsApi.openSheet).toHaveBeenCalledWith({
        type: "export",
        context: {collectionId: "col1"},
      })
      expect(mockCollectionsApi.getCollection).not.toHaveBeenCalled()
    })
  })

  it("calls the correct API when 'Manage Settings' is clicked", () => {
    render(<TestProvider collection={mockCollection}/>)
    fireEvent.click(screen.getByText("Manage Settings"))
    return waitFor(() => {
      expect(mockSheetsApi.openSheet).toHaveBeenCalledWith({
        type: "collection-settings",
        context: {collectionId: "col1"},
      })
      expect(mockCollectionsApi.getCollection).not.toHaveBeenCalled()
    })
  })

  it("calls the correct API when 'New Folder' is clicked", () => {
    render(<TestProvider collection={mockCollection}/>)
    fireEvent.click(screen.getByText("New Folder"))
    return waitFor(() =>
      expect(mockCollectionsApi.createFolder).toHaveBeenCalledWith("col1", RootCollectionFolderId, "New Folder"),
    )
  })

  it("calls the correct API when 'Delete' is clicked", () => {
    render(<TestProvider collection={mockCollection}/>)
    fireEvent.click(screen.getByText("Delete"))
    return waitFor(() => expect(mockCollectionsApi.removeCollection).toHaveBeenCalledWith("col1"))
  })

  it("calls the correct API when 'Clear All' is clicked", () => {
    render(<TestProvider collection={mockScratchCollection}/>)
    fireEvent.click(screen.getByText("Clear All"))
    return waitFor(() => expect(mockCollectionsApi.clearScratchCollection).toHaveBeenCalled())
  })
})

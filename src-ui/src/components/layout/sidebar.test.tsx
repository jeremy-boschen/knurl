import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const hoisted = vi.hoisted(() => ({
  useSidebar: vi.fn(),
  useTheme: vi.fn(),
  utilitySheetsApi: vi.fn(),
  useCollectionTree: vi.fn(),
  useCollections: vi.fn(),
  windowApi: {
    isMaximized: vi.fn().mockResolvedValue(false),
    isMinimized: vi.fn().mockResolvedValue(false),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
  },
  getCurrentWindow: vi.fn(),
}))

vi.mock("@/state", () => ({
  useSidebar: hoisted.useSidebar,
  useTheme: hoisted.useTheme,
  utilitySheetsApi: hoisted.utilitySheetsApi,
  useCollectionTree: hoisted.useCollectionTree,
  useCollections: hoisted.useCollections,
}))

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: hoisted.getCurrentWindow,
}))

vi.mock("./collection-tree", () => ({
  CollectionTree: () => <div data-testid="collection-tree" />,
  CollectionTreeCollapsed: () => <div data-testid="collection-tree-collapsed" />,
}))
vi.mock("@/components/collection/new-collection-dialog", () => ({
  NewCollectionDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="new-collection-dialog" /> : null),
}))

import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import Sidebar from "./sidebar"

type SidebarConfig = {
  isCollapsed?: boolean
  searchTerm?: string
}

const setupMocks = (config: SidebarConfig = {}) => {
  const collapseSidebar = vi.fn()
  const expandSidebar = vi.fn()
  hoisted.useSidebar.mockReturnValue({
    state: { isCollapsed: config.isCollapsed ?? false },
    actions: { collapseSidebar, expandSidebar },
  })

  const setTheme = vi.fn()
  hoisted.useTheme.mockReturnValue({ state: { theme: "light" }, actions: { setTheme } })

  const openSheet = vi.fn()
  hoisted.utilitySheetsApi.mockReturnValue({ openSheet })

  let searchTermState = config.searchTerm ?? ""
  const setSearchTerm = vi.fn((term: string) => {
    searchTermState = term
  })
  const clearSearch = vi.fn(() => {
    searchTermState = ""
  })
  const toggleExpanded = vi.fn()
  hoisted.useCollectionTree.mockImplementation(() => ({
    state: { searchTerm: searchTermState, expandedIds: {} },
    actions: { setSearchTerm, clearSearch, toggleExpanded },
  }))

  hoisted.useCollections.mockReturnValue({
    state: { collectionsIndex: [] },
  })

  hoisted.getCurrentWindow.mockResolvedValue(hoisted.windowApi)

  return { collapseSidebar, expandSidebar, setTheme, openSheet, setSearchTerm, clearSearch }
}

const findByTestId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Element ${id} not found`)
  }
  return el as HTMLElement
}

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("collapses via the header button", async () => {
    const user = userEvent.setup()
    const { collapseSidebar } = setupMocks()
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    await user.click(findByTestId("sidebar:collapse-button"))
    expect(collapseSidebar).toHaveBeenCalledTimes(1)
  })

  it("expands when collapsed header button is used", async () => {
    const user = userEvent.setup()
    const { expandSidebar } = setupMocks({ isCollapsed: true })
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    await user.click(findByTestId("sidebar:expand-button"))
    expect(expandSidebar).toHaveBeenCalledTimes(1)
  })

  it("invokes utility sheets for import/settings actions", async () => {
    const user = userEvent.setup()
    const { openSheet } = setupMocks()
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    await user.click(findByTestId("sidebar:import-collection-button"))
    await user.click(findByTestId("sidebar:settings-button"))

    expect(openSheet).toHaveBeenNthCalledWith(1, { type: "import" })
    expect(openSheet).toHaveBeenNthCalledWith(2, { type: "settings" })
  })

  it("clears the search input and hides the clear button", async () => {
    const user = userEvent.setup()
    const { clearSearch } = setupMocks({ searchTerm: "foo" })
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    const searchInput = findByTestId("sidebar:search-input") as HTMLInputElement
    expect(searchInput.value).toBe("foo")

    await user.click(findByTestId("sidebar:clear-search-button"))
    expect(clearSearch).toHaveBeenCalled()
  })

  it("clears search when Escape is pressed", async () => {
    const user = userEvent.setup()
    const { clearSearch } = setupMocks({ searchTerm: "query" })
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    const searchInput = findByTestId("sidebar:search-input") as HTMLInputElement
    searchInput.focus()
    await user.keyboard("{Escape}")
    expect(clearSearch).toHaveBeenCalled()
  })

  it("collapsed footer new collection button expands sidebar for dialog flow", async () => {
    const user = userEvent.setup()
    const { expandSidebar } = setupMocks({ isCollapsed: true })
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    await user.click(findByTestId("sidebar:new-collection-button-collapsed"))
    expect(expandSidebar).toHaveBeenCalled()
  })

  it("opens the new collection dialog when header button is used", async () => {
    const user = userEvent.setup()
    setupMocks()
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    await user.click(findByTestId("sidebar:new-collection-button"))
    expect(screen.getByTestId("new-collection-dialog")).toBeInTheDocument()
  })

  it("toggles theme through ModeToggle", async () => {
    const user = userEvent.setup()
    const { setTheme } = setupMocks()
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    const toggle = findByTestId("sidebar:mode-toggle-button")
    await user.click(toggle)
    expect(setTheme).toHaveBeenCalled()
  })
})

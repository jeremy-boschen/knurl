import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const hoisted = vi.hoisted(() => ({
  useSidebar: vi.fn(),
  useTheme: vi.fn(),
  utilitySheetsApi: vi.fn(),
}))

vi.mock("@/state", () => ({
  useSidebar: hoisted.useSidebar,
  useTheme: hoisted.useTheme,
  utilitySheetsApi: hoisted.utilitySheetsApi,
}))

vi.mock("./collection-tree", () => ({ CollectionTree: () => <div data-testid="collection-tree" /> }))
vi.mock("@/components/collection/new-collection-dialog", () => ({
  NewCollectionDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="new-collection-dialog" /> : null),
}))

import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import Sidebar from "./sidebar"

type SidebarConfig = {
  isCollapsed?: boolean
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

  return { collapseSidebar, expandSidebar, setTheme, openSheet }
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
    setupMocks()
    render(
      <TooltipProvider>
        <Sidebar />
      </TooltipProvider>,
    )

    const searchInput = findByTestId("sidebar:search-input") as HTMLInputElement
    await user.type(searchInput, "foo")
    expect(searchInput.value).toBe("foo")

    const clearButton = findByTestId("sidebar:clear-search-button")
    await user.click(clearButton)
    expect(searchInput.value).toBe("")
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

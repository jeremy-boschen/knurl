import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

const sidebarMocks = vi.hoisted(() => ({
  useSidebar: vi.fn(),
  useActiveTabId: vi.fn(),
}))

const panelMocks = vi.hoisted(() => ({ panelProps: [] as Array<Record<string, any>> }))

vi.mock("@/state", () => ({
  useSidebar: sidebarMocks.useSidebar,
  useActiveTabId: sidebarMocks.useActiveTabId,
}))

vi.mock("@/components/utility-sheets/utility-sheet-host", () => ({
  UtilitySheetHost: () => <div data-testid="utility-sheet-host" />,
}))

vi.mock("./sidebar", () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar" />,
}))

vi.mock("./app-header", () => ({
  AppHeader: () => <div data-testid="app-header" />,
}))

const requestWorkspaceRender = vi.fn()

vi.mock("@/components/request/request-workspace", () => ({
  __esModule: true,
  default: ({ tabId }: { tabId: string }) => {
    requestWorkspaceRender(tabId)
    return (
      <div data-testid="request-workspace">{tabId}</div>
    )
  },
}))

vi.mock("@jeremy-boschen/react-adjustable-panels", () => {
  const PanelGroup = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{ direction: string }>>(
    ({ children }, ref) => {
      if (typeof ref === "function") {
        ref({ panelGroup: true } as any)
      } else if (ref) {
        ;(ref as React.MutableRefObject<any>).current = { panelGroup: true }
      }
      return (
        <div data-testid="panel-group">
          {children}
        </div>
      )
    },
  )

  const Panel = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    panelMocks.panelProps.push(props)
    return <div data-testid="panel">{children}</div>
  }

  const ResizeHandle = ({ children }: React.PropsWithChildren) => <div data-testid="resize-handle">{children}</div>

  return { PanelGroup, Panel, ResizeHandle }
})

import AppLayout from "./app-layout"

const setupSidebar = (options: { isCollapsed?: boolean } = {}) => {
  const collapseSidebar = vi.fn()
  const expandSidebar = vi.fn()
  const setPanelGroupApi = vi.fn()
  sidebarMocks.useSidebar.mockReturnValue({
    state: { isCollapsed: options.isCollapsed ?? false },
    actions: { collapseSidebar, expandSidebar, setPanelGroupApi },
  })
  return { collapseSidebar, expandSidebar, setPanelGroupApi }
}

describe("AppLayout", () => {
  beforeEach(() => {
    sidebarMocks.useActiveTabId?.mockReset?.()
    sidebarMocks.useSidebar.mockReset()
    panelMocks.panelProps.length = 0
    requestWorkspaceRender.mockClear()
  })

  it("shows empty state when no tab is active", () => {
    setupSidebar()
    sidebarMocks.useActiveTabId.mockReturnValue(undefined)
    const { container } = render(<AppLayout />)
    expect(container.querySelector("[data-test-id='app-layout:empty-state']")).toBeInTheDocument()
  })

  it("renders request workspace when a tab is active", () => {
    setupSidebar()
    sidebarMocks.useActiveTabId.mockReturnValue("tab-123")
    render(<AppLayout />)
    expect(screen.getByTestId("request-workspace")).toHaveTextContent("tab-123")
    expect(requestWorkspaceRender).toHaveBeenCalledWith("tab-123")
  })

  it("invokes collapse/expand handlers based on sidebar panel events", async () => {
    const { collapseSidebar, expandSidebar } = setupSidebar()
    sidebarMocks.useActiveTabId.mockReturnValue("tab-1")
    render(<AppLayout />)
    const sidebarPanel = panelMocks.panelProps[0]
    await act(async () => {
      sidebarPanel.onCollapse?.(true)
    })
    expect(collapseSidebar).toHaveBeenCalled()
    await act(async () => {
      sidebarPanel.onCollapse?.(false)
    })
    expect(expandSidebar).toHaveBeenCalled()
  })

  it("registers the panel group API through the sidebar action", () => {
    const { setPanelGroupApi } = setupSidebar()
    sidebarMocks.useActiveTabId.mockReturnValue(undefined)
    render(<AppLayout />)
    expect(setPanelGroupApi).toHaveBeenCalledWith(expect.objectContaining({ panelGroup: true }))
  })
})

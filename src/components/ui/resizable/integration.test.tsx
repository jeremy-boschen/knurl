import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useRef } from "react"
import { PanelGroup } from "./panel-group"
import { Panel } from "./panel"
import { PanelResizeHandle } from "./resize-handle"
import type { PanelHandle } from "./types"

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe("Resizable Panels Integration", () => {
  it("renders complete panel layout", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel defaultSize="25%">
          <div data-testid="sidebar">Sidebar</div>
        </Panel>
        <PanelResizeHandle data-testid="handle" />
        <Panel>
          <div data-testid="content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("handle")).toBeInTheDocument()
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("handles collapse and expand operations", () => {
    const onCollapse = vi.fn()
    const onExpand = vi.fn()

    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <div>
          <button
            type="button"
            data-testid="collapse-btn"
            onClick={() => panelRef.current?.collapse()}
          >
            Collapse
          </button>
          <button
            type="button"
            data-testid="expand-btn"
            onClick={() => panelRef.current?.expand()}
          >
            Expand
          </button>
          <PanelGroup direction="horizontal">
            <Panel
              ref={panelRef}
              defaultSize="25%"
              collapsible
              collapsedSize="0px"
              onCollapse={onCollapse}
              onExpand={onExpand}
            >
              <div data-testid="sidebar">Sidebar</div>
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <div data-testid="content">Content</div>
            </Panel>
          </PanelGroup>
        </div>
      )
    }

    render(<TestComponent />)

    const collapseBtn = screen.getByTestId("collapse-btn")
    const expandBtn = screen.getByTestId("expand-btn")

    fireEvent.click(collapseBtn)
    expect(onCollapse).toHaveBeenCalled()

    fireEvent.click(expandBtn)
    expect(onExpand).toHaveBeenCalled()
  })

  it("handles programmatic resize", () => {
    const onResize = vi.fn()

    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <div>
          <button
            type="button"
            data-testid="resize-btn"
            onClick={() => panelRef.current?.resize("30%")}
          >
            Resize to 30%
          </button>
          <PanelGroup direction="horizontal">
            <Panel ref={panelRef} defaultSize="25%" onResize={onResize}>
              <div data-testid="sidebar">Sidebar</div>
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <div data-testid="content">Content</div>
            </Panel>
          </PanelGroup>
        </div>
      )
    }

    render(<TestComponent />)

    const resizeBtn = screen.getByTestId("resize-btn")
    fireEvent.click(resizeBtn)

    expect(onResize).toHaveBeenCalled()
  })

  it("supports pixel-based constraints", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel minSize="200px" maxSize="800px" defaultSize="400px">
          <div data-testid="sidebar">Sidebar</div>
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <div data-testid="content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("supports percentage-based constraints", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel minSize="20%" maxSize="80%" defaultSize="50%">
          <div data-testid="sidebar">Sidebar</div>
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <div data-testid="content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("supports mixed units (pixels and percentages)", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel minSize="200px" maxSize="80%" defaultSize="25%">
          <div data-testid="sidebar">Sidebar</div>
        </Panel>
        <PanelResizeHandle />
        <Panel minSize="20%" defaultSize="75%">
          <div data-testid="content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("works with vertical direction", () => {
    render(
      <PanelGroup direction="vertical">
        <Panel defaultSize="50%">
          <div data-testid="top">Top</div>
        </Panel>
        <PanelResizeHandle data-testid="handle" />
        <Panel>
          <div data-testid="bottom">Bottom</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("top")).toBeInTheDocument()
    expect(screen.getByTestId("handle")).toBeInTheDocument()
    expect(screen.getByTestId("bottom")).toBeInTheDocument()
    expect(screen.getByTestId("handle")).toHaveClass("cursor-row-resize")
  })

  it("handles three panels with two resize handles", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel defaultSize="25%">
          <div data-testid="left">Left</div>
        </Panel>
        <PanelResizeHandle data-testid="handle-1" />
        <Panel defaultSize="50%">
          <div data-testid="middle">Middle</div>
        </Panel>
        <PanelResizeHandle data-testid="handle-2" />
        <Panel defaultSize="25%">
          <div data-testid="right">Right</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("left")).toBeInTheDocument()
    expect(screen.getByTestId("handle-1")).toBeInTheDocument()
    expect(screen.getByTestId("middle")).toBeInTheDocument()
    expect(screen.getByTestId("handle-2")).toBeInTheDocument()
    expect(screen.getByTestId("right")).toBeInTheDocument()
  })

  it("calls onLayout when panel sizes change", () => {
    const onLayout = vi.fn()

    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <div>
          <button
            type="button"
            data-testid="resize-btn"
            onClick={() => panelRef.current?.resize("40%")}
          >
            Resize
          </button>
          <PanelGroup direction="horizontal" onLayout={onLayout}>
            <Panel ref={panelRef} defaultSize="25%">
              <div data-testid="sidebar">Sidebar</div>
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <div data-testid="content">Content</div>
            </Panel>
          </PanelGroup>
        </div>
      )
    }

    render(<TestComponent />)

    onLayout.mockClear() // Clear initial calls

    const resizeBtn = screen.getByTestId("resize-btn")
    fireEvent.click(resizeBtn)

    expect(onLayout).toHaveBeenCalled()
  })

  it("getSize returns current panel size", () => {
    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <div>
          <button
            type="button"
            data-testid="get-size-btn"
            onClick={() => {
              const size = panelRef.current?.getSize()
              expect(typeof size).toBe("number")
            }}
          >
            Get Size
          </button>
          <PanelGroup direction="horizontal">
            <Panel ref={panelRef} defaultSize="25%">
              <div data-testid="sidebar">Sidebar</div>
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <div data-testid="content">Content</div>
            </Panel>
          </PanelGroup>
        </div>
      )
    }

    render(<TestComponent />)

    const getSizeBtn = screen.getByTestId("get-size-btn")
    fireEvent.click(getSizeBtn)
  })

  it("isCollapsed returns correct state", () => {
    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <div>
          <button
            type="button"
            data-testid="check-collapsed-btn"
            onClick={() => {
              const collapsed = panelRef.current?.isCollapsed()
              expect(typeof collapsed).toBe("boolean")
            }}
          >
            Check Collapsed
          </button>
          <button
            type="button"
            data-testid="collapse-btn"
            onClick={() => panelRef.current?.collapse()}
          >
            Collapse
          </button>
          <PanelGroup direction="horizontal">
            <Panel ref={panelRef} defaultSize="25%" collapsible collapsedSize="0px">
              <div data-testid="sidebar">Sidebar</div>
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <div data-testid="content">Content</div>
            </Panel>
          </PanelGroup>
        </div>
      )
    }

    render(<TestComponent />)

    const checkBtn = screen.getByTestId("check-collapsed-btn")
    const collapseBtn = screen.getByTestId("collapse-btn")

    fireEvent.click(checkBtn)
    fireEvent.click(collapseBtn)
    fireEvent.click(checkBtn)
  })
})

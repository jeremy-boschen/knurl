import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useRef } from "react"
import { Panel } from "./panel"
import { PanelGroup } from "./panel-group"
import type { PanelHandle } from "./types"

describe("Panel", () => {
  it("renders children correctly", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-content")).toBeInTheDocument()
    expect(screen.getByTestId("panel-content")).toHaveTextContent("Content")
  })

  it("applies className prop", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel className="custom-class">
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    const panel = screen.getByTestId("panel-content").parentElement
    expect(panel).toHaveClass("custom-class")
  })

  it("sets data-panel-id attribute", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel id="test-panel">
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    const panel = screen.getByTestId("panel-content").parentElement
    expect(panel).toHaveAttribute("data-panel-id", "test-panel")
  })

  it("generates ID if not provided", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    const panel = screen.getByTestId("panel-content").parentElement
    expect(panel).toHaveAttribute("data-panel-id")
    expect(panel?.getAttribute("data-panel-id")).toMatch(/^panel-\d+$/)
  })

  it("exposes imperative handle methods", () => {
    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <PanelGroup direction="horizontal">
          <Panel ref={panelRef} defaultSize="50%">
            <button
              type="button"
              onClick={() => {
                expect(panelRef.current).toBeTruthy()
                expect(panelRef.current?.collapse).toBeInstanceOf(Function)
                expect(panelRef.current?.expand).toBeInstanceOf(Function)
                expect(panelRef.current?.resize).toBeInstanceOf(Function)
                expect(panelRef.current?.getSize).toBeInstanceOf(Function)
                expect(panelRef.current?.isCollapsed).toBeInstanceOf(Function)
              }}
            >
              Test
            </button>
          </Panel>
        </PanelGroup>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole("button")
    button.click()
  })

  it("calls onCollapse callback", () => {
    const onCollapse = vi.fn()

    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <PanelGroup direction="horizontal">
          <Panel ref={panelRef} collapsible onCollapse={onCollapse} collapsedSize="0px">
            <button
              type="button"
              onClick={() => {
                panelRef.current?.collapse()
              }}
            >
              Collapse
            </button>
          </Panel>
        </PanelGroup>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole("button")
    button.click()

    expect(onCollapse).toHaveBeenCalled()
  })

  it("calls onExpand callback", () => {
    const onExpand = vi.fn()

    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <PanelGroup direction="horizontal">
          <Panel ref={panelRef} onExpand={onExpand} defaultSize="50%">
            <button
              type="button"
              onClick={() => {
                panelRef.current?.expand()
              }}
            >
              Expand
            </button>
          </Panel>
        </PanelGroup>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole("button")
    button.click()

    expect(onExpand).toHaveBeenCalled()
  })

  it("calls onResize callback when resizing", () => {
    const onResize = vi.fn()

    function TestComponent() {
      const panelRef = useRef<PanelHandle>(null)

      return (
        <PanelGroup direction="horizontal">
          <Panel ref={panelRef} onResize={onResize} defaultSize="50%">
            <button
              type="button"
              onClick={() => {
                panelRef.current?.resize("30%")
              }}
            >
              Resize
            </button>
          </Panel>
        </PanelGroup>
      )
    }

    render(<TestComponent />)
    const button = screen.getByRole("button")
    button.click()

    expect(onResize).toHaveBeenCalled()
  })

  it("accepts pixel-based sizes", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel minSize="200px" maxSize="800px" defaultSize="400px">
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-content")).toBeInTheDocument()
  })

  it("accepts percentage-based sizes", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel minSize="20%" maxSize="80%" defaultSize="50%">
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-content")).toBeInTheDocument()
  })

  it("accepts numeric sizes (as percentages)", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel minSize={20} maxSize={80} defaultSize={50}>
          <div data-testid="panel-content">Content</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-content")).toBeInTheDocument()
  })
})

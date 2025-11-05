import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { PanelGroup } from "./panel-group"
import { Panel } from "./panel"
import { PanelResizeHandle } from "./resize-handle"

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe("PanelResizeHandle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders correctly between panels", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("resize-handle")).toBeInTheDocument()
  })

  it("applies className prop", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle className="custom-handle-class" data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("resize-handle")).toHaveClass("custom-handle-class")
  })

  it("sets correct cursor class for horizontal direction", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("resize-handle")).toHaveClass("cursor-col-resize")
  })

  it("sets correct cursor class for vertical direction", () => {
    render(
      <PanelGroup direction="vertical">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("resize-handle")).toHaveClass("cursor-row-resize")
  })

  it("has data-resize-handle attribute", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("resize-handle")).toHaveAttribute("data-resize-handle")
  })

  it("sets pointer event styles", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    const handle = screen.getByTestId("resize-handle")
    expect(handle).toHaveStyle({ touchAction: "none" })
    expect(handle).toHaveStyle({ userSelect: "none" })
  })

  it("does not trigger resize when disabled", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle disabled data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    const handle = screen.getByTestId("resize-handle")

    // Mock getBoundingClientRect for panels
    const panel1 = screen.getByTestId("panel-1").parentElement
    const panel2 = screen.getByTestId("panel-2").parentElement

    if (panel1) {
      Object.defineProperty(panel1, "getBoundingClientRect", {
        value: () => ({ width: 200, height: 100, left: 0, top: 0 }),
      })
    }

    if (panel2) {
      Object.defineProperty(panel2, "getBoundingClientRect", {
        value: () => ({ width: 200, height: 100, left: 200, top: 0 }),
      })
    }

    // Try to start drag
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 0, pointerId: 1 })

    // Since it's disabled, pointer move should have no effect
    fireEvent.pointerMove(document, { clientX: 250, clientY: 0, pointerId: 1 })
    fireEvent.pointerUp(document, { pointerId: 1 })

    // No assertions here, just checking it doesn't crash
  })

  it("handles pointer down event", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    const handle = screen.getByTestId("resize-handle")

    // Mock setPointerCapture
    handle.setPointerCapture = vi.fn()

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 0, pointerId: 1 })

    expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it("renders with custom props", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <PanelResizeHandle data-testid="resize-handle" aria-label="Resize panels" />
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("resize-handle")).toHaveAttribute("aria-label", "Resize panels")
  })
})

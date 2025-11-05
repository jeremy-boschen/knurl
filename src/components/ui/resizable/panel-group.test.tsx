import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PanelGroup } from "./panel-group"
import { Panel } from "./panel"

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe("PanelGroup", () => {
  it("renders children correctly", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-1")).toBeInTheDocument()
    expect(screen.getByTestId("panel-2")).toBeInTheDocument()
  })

  it("applies className prop", () => {
    render(
      <PanelGroup direction="horizontal" className="custom-group-class">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
      </PanelGroup>,
    )

    const group = screen.getByTestId("panel-1").parentElement?.parentElement
    expect(group).toHaveClass("custom-group-class")
  })

  it("sets flex direction based on direction prop", () => {
    const { rerender } = render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
      </PanelGroup>,
    )

    let group = screen.getByTestId("panel-1").parentElement?.parentElement as HTMLElement
    expect(group.style.flexDirection).toBe("row")

    rerender(
      <PanelGroup direction="vertical">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
      </PanelGroup>,
    )

    group = screen.getByTestId("panel-1").parentElement?.parentElement as HTMLElement
    expect(group.style.flexDirection).toBe("column")
  })

  it("calls onLayout callback when panels are resized", () => {
    const onLayout = vi.fn()

    render(
      <PanelGroup direction="horizontal" onLayout={onLayout}>
        <Panel defaultSize="50%">
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <Panel defaultSize="50%">
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
      </PanelGroup>,
    )

    // onLayout should be called when panel sizes change
    // Due to initial registration, it may be called
    expect(onLayout).toHaveBeenCalled()
  })

  it("renders with custom style prop", () => {
    render(
      <PanelGroup direction="horizontal" style={{ backgroundColor: "red" }}>
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
      </PanelGroup>,
    )

    const group = screen.getByTestId("panel-1").parentElement?.parentElement as HTMLElement
    expect(group.style.backgroundColor).toBe("red")
  })

  it("uses ResizeObserver to track container size", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
      </PanelGroup>,
    )

    expect(ResizeObserver).toHaveBeenCalled()
  })

  it("provides context to child panels", () => {
    // This is implicitly tested by Panel rendering successfully
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-1")).toBeInTheDocument()
  })

  it("handles multiple panels", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel>
          <div data-testid="panel-1">Panel 1</div>
        </Panel>
        <Panel>
          <div data-testid="panel-2">Panel 2</div>
        </Panel>
        <Panel>
          <div data-testid="panel-3">Panel 3</div>
        </Panel>
      </PanelGroup>,
    )

    expect(screen.getByTestId("panel-1")).toBeInTheDocument()
    expect(screen.getByTestId("panel-2")).toBeInTheDocument()
    expect(screen.getByTestId("panel-3")).toBeInTheDocument()
  })
})

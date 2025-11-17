import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import RequestTab from "./request-tab"

const stateMocks = vi.hoisted(() => ({
  useRequestsTabSummary: vi.fn(),
}))

vi.mock("@/state", () => ({
  useRequestsTabSummary: stateMocks.useRequestsTabSummary,
}))

vi.mock("@/components/ui/knurl", () => ({
  HttpBadge: ({ method }: { method: string }) => <span data-testid="http-badge">{method}</span>,
}))

vi.mock("@/components/ui/knurl/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("RequestTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stateMocks.useRequestsTabSummary.mockReturnValue({
      isActive: true,
      name: "Fetch Users",
      method: "GET",
      isDirty: true,
      requestId: "req-1",
    })
  })

  it("renders tab meta and dirty indicator", () => {
    render(<RequestTab tabId="tab-1" onSelectTab={vi.fn()} onCloseTab={vi.fn()} />)
    expect(screen.getByText("Fetch Users")).toBeInTheDocument()
    expect(screen.getByTestId("http-badge")).toHaveTextContent("GET")
    expect(getByDataId("request-tab:tab-1").dataset.state).toBe("active")
    expect(screen.getByText(/•/)).toBeInTheDocument()
  })

  it("invokes selection handlers on click and keyboard", () => {
    const onSelectTab = vi.fn()
    render(<RequestTab tabId="tab-2" onSelectTab={onSelectTab} onCloseTab={vi.fn()} />)
    const tab = getByDataId("request-tab:tab-2")
    fireEvent.click(tab)
    expect(onSelectTab).toHaveBeenCalled()
    fireEvent.keyDown(tab, { key: "Enter" })
    expect(onSelectTab).toHaveBeenCalledTimes(2)
  })

  it("passes datasets to close handler and optional context menu", () => {
    stateMocks.useRequestsTabSummary.mockReturnValue({
      isActive: false,
      name: "Submit",
      method: "POST",
      isDirty: false,
      requestId: "req-9",
    })
    const onCloseTab = vi.fn()
    const onContextMenu = vi.fn()
    render(<RequestTab tabId="tab-close" onSelectTab={vi.fn()} onCloseTab={onCloseTab} onContextMenu={onContextMenu} />)

    const closeButton = getByDataId("request-tab:close-button:tab-close")
    fireEvent.click(closeButton)
    expect(onCloseTab).toHaveBeenCalled()

    fireEvent.contextMenu(getByDataId("request-tab:tab-close"))
    expect(onContextMenu).toHaveBeenCalled()
  })
})

const getByDataId = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-test-id="${id}"]`)
  if (!el) {
    throw new Error(`Missing ${id}`)
  }
  return el as HTMLElement
}

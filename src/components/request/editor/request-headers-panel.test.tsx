import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import { RequestHeadersPanel } from "./request-headers-panel"

vi.mock("@/state", () => ({
  useRequestHeaders: vi.fn(),
}))

import { useRequestHeaders } from "@/state"

describe("RequestHeadersPanel", () => {
  const tabId = "tab-x"
  const actions = {
    updateHeader: vi.fn(),
    removeHeader: vi.fn(),
    addHeader: vi.fn(),
    addCookieHeader: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWith = (headers: any, original: any) => {
    vi.mocked(useRequestHeaders).mockReturnValue({
      state: { headers, original },
      actions,
    } as any)
    return render(
      <TooltipProvider>
        <RequestHeadersPanel tabId={tabId} />
      </TooltipProvider>,
    )
  }

  it("renders headers section title without inline add button", () => {
    renderWith({}, {})
    expect(screen.getByText(/request headers/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add header/i })).not.toBeInTheDocument()
  })

  it("updates header name/value and removes header", async () => {
    const user = userEvent.setup()
    const h = { id: "h1", name: "X-Test", value: "1", enabled: true, secure: false }
    renderWith({ [h.id]: h }, { [h.id]: h })

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "X-Updated" } })
    expect(actions.updateHeader).toHaveBeenCalledWith("h1", { name: "X-Updated" })

    fireEvent.change(screen.getByPlaceholderText("Value"), { target: { value: "2" } })
    expect(actions.updateHeader).toHaveBeenCalledWith("h1", { value: "2" })

    // Click the last button in the row (delete)
    const buttons = screen.getAllByRole("button")
    await user.click(buttons[buttons.length - 1])
    expect(actions.removeHeader).toHaveBeenCalledWith("h1")
  })

  it("toggles enabled and secure state, marks unsaved when changed", async () => {
    const user = userEvent.setup()
    const h = { id: "h2", name: "Auth", value: "secret", enabled: false, secure: false }
    // Original has enabled=false, secure=false so toggling should mark unsaved
    const { container } = renderWith({ [h.id]: h }, { [h.id]: h })

    const enabled = container.querySelector(
      '[data-test-id="request-headers-panel:enabled-checkbox:h2"]',
    ) as HTMLElement
    await user.click(enabled)
    expect(actions.updateHeader).toHaveBeenCalledWith("h2", { enabled: true })

    const secureToggle = container.querySelector(
      '[data-test-id="request-headers-panel:secure-toggle:h2"]',
    ) as HTMLElement
    await user.click(secureToggle)
    expect(actions.updateHeader).toHaveBeenCalledWith("h2", { secure: true })
  })

  it("renders empty state when no headers exist", () => {
    const { container } = renderWith({}, {})
    expect(container.querySelector('[data-test-id="request-headers-panel:empty-state"]')).toBeInTheDocument()
  })

  it("marks unsaved changes and masks secure values", () => {
    const h = { id: "h3", name: "Auth", value: "secret", enabled: true, secure: true }
    renderWith({ [h.id]: h }, { [h.id]: { ...h, value: "old", secure: false } })

    const valueInput = document.querySelector(
      '[data-test-id="request-headers-panel:value-input:h3"]',
    ) as HTMLInputElement
    expect(valueInput.type).toBe("password")
    expect(valueInput.className).toContain("unsaved-changes")
  })
})

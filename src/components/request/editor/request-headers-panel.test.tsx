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
})

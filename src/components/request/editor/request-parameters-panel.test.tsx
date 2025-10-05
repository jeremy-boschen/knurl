import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import { RequestParametersPanel } from "./request-parameters-panel"

vi.mock("@/state", () => ({
  useRequestParameters: vi.fn(),
}))
import { useRequestParameters } from "@/state"

describe("RequestParametersPanel", () => {
  const actions = {
    addPathParam: vi.fn(),
    updatePathParam: vi.fn(),
    removePathParam: vi.fn(),
    addQueryParam: vi.fn(),
    updateQueryParam: vi.fn(),
    removeQueryParam: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  const renderWith = (pathParams: any, queryParams: any, original: any) => {
    vi.mocked(useRequestParameters).mockReturnValue({
      state: { pathParams, queryParams, cookieParams: {}, original },
      actions,
    } as any)
    return render(
      <TooltipProvider>
        <RequestParametersPanel tabId="t" />
      </TooltipProvider>,
    )
  }

  it("renders parameter sections without inline add buttons", () => {
    renderWith({}, {}, {})
    expect(screen.getByRole("heading", { name: /path parameters/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /query parameters/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add path parameter/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add query parameter/i })).not.toBeInTheDocument()
  })

  it("edits and removes a query param row", async () => {
    const user = userEvent.setup()
    const qp = { id: "q1", name: "a", value: "1", enabled: true, secure: false }
    renderWith({}, { [qp.id]: qp }, { queryParams: { [qp.id]: qp } })

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "b" } })
    expect(actions.updateQueryParam).toHaveBeenCalledWith("q1", { name: "b" })

    fireEvent.change(screen.getByPlaceholderText("Value"), { target: { value: "2" } })
    expect(actions.updateQueryParam).toHaveBeenCalledWith("q1", { value: "2" })

    // Delete is the last button in the row
    const buttons = screen.getAllByRole("button")
    await user.click(buttons[buttons.length - 1])
    expect(actions.removeQueryParam).toHaveBeenCalledWith("q1")
  })
})

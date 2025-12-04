import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
    updateCookieParam: vi.fn(),
    removeCookieParam: vi.fn(),
    reorderPathParams: vi.fn(),
    reorderQueryParams: vi.fn(),
    reorderCookieParams: vi.fn(),
    addCookieParam: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  const queryByDataTestId = (id: string) => document.querySelector(`[data-test-id="${id}"]`) as HTMLElement | null

  const renderWith = (pathParams: any, queryParams: any, original: any, cookieParams?: any) => {
    vi.mocked(useRequestParameters).mockReturnValue({
      state: { pathParams, queryParams, cookieParams, original },
      actions,
    } as any)
    return render(
      <TooltipProvider>
        <RequestParametersPanel tabId="t" />
      </TooltipProvider>,
    )
  }

  it("renders parameter sections with add buttons", () => {
    renderWith({}, {}, {})
    expect(screen.getByRole("heading", { name: /path parameters/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /query parameters/i })).toBeInTheDocument()
    expect(queryByDataTestId("request-parameters-panel:add-path-param-button")).not.toBeNull()
    expect(queryByDataTestId("request-parameters-panel:add-query-param-button")).not.toBeNull()
  })

  it("edits and removes a query param row", async () => {
    const user = userEvent.setup()
    const qp = { id: "q1", name: "a", value: "1", enabled: true, secure: false }
    renderWith({}, { [qp.id]: qp }, { queryParams: { [qp.id]: qp } })

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "b" } })
    expect(actions.updateQueryParam).toHaveBeenCalledWith("q1", { name: "b" })

    fireEvent.change(screen.getByPlaceholderText("Value"), { target: { value: "2" } })
    expect(actions.updateQueryParam).toHaveBeenCalledWith("q1", { value: "2" })

    // Click the menu button to open dropdown
    const menuButton = queryByDataTestId("field-row:menu-button") as HTMLElement
    await user.click(menuButton)

    // Click the delete item in the menu
    const deleteItem = (await waitFor(() => queryByDataTestId("field-row:menu-delete"))) as HTMLElement
    await user.click(deleteItem)
    expect(actions.removeQueryParam).toHaveBeenCalledWith("q1")
  })

  it("shows empty states when no params exist", () => {
    renderWith({}, {}, {}, {})
    expect(screen.getByText(/No path parameters added yet/i)).toBeInTheDocument()
    expect(screen.getByText(/No query parameters added yet/i)).toBeInTheDocument()
    expect(screen.getByText(/No cookies added yet/i)).toBeInTheDocument()
  })

  it("hides cookies section when cookieParams is undefined", () => {
    renderWith({}, {}, {}, undefined)
    expect(screen.queryByRole("heading", { name: /cookies/i })).toBeNull()
  })

  it("marks unsaved fields and toggles secure for query params", async () => {
    const user = userEvent.setup()
    const qp = { id: "q1", name: "secret", value: "a", enabled: true, secure: false }
    renderWith({}, { [qp.id]: qp }, { queryParams: { [qp.id]: { ...qp, value: "b" } } })

    const valueInput = document.querySelector(
      '[data-test-id="request-parameters-panel:query-param-value-input:q1"]',
    ) as HTMLInputElement | null
    expect(valueInput).not.toBeNull()
    expect(valueInput!.className).toContain("unsaved-changes")

    const menuButton = queryByDataTestId("field-row:menu-button") as HTMLElement
    await user.click(menuButton)

    const sensitiveItem = (await waitFor(() => queryByDataTestId("field-row:menu-sensitive"))) as HTMLElement
    await user.click(sensitiveItem)
    expect(actions.updateQueryParam).toHaveBeenCalledWith("q1", { secure: true })
  })

  it("marks unsaved name and toggles secure for cookies", async () => {
    const user = userEvent.setup()
    const cookieParam = { id: "c1", name: "session", value: "abc", enabled: true, secure: false }
    renderWith(
      {},
      {},
      { cookieParams: { [cookieParam.id]: { ...cookieParam, name: "old-session" } } },
      { [cookieParam.id]: cookieParam },
    )

    const nameInput = document.querySelector('[data-test-id="field-row:name-input"]') as HTMLInputElement | null
    expect(nameInput).not.toBeNull()
    expect(nameInput!.className).toContain("unsaved-changes")

    const menuButton = queryByDataTestId("field-row:menu-button") as HTMLElement
    await user.click(menuButton)

    const sensitiveItem = (await waitFor(() => queryByDataTestId("field-row:menu-sensitive"))) as HTMLElement
    await user.click(sensitiveItem)
    expect(actions.updateCookieParam).toHaveBeenCalledWith("c1", { secure: true })
  })

  it("toggles path params and updates cookies", async () => {
    const user = userEvent.setup()
    const pathParam = { id: "p1", name: "id", value: "123", enabled: true, secure: false }
    const cookieParam = { id: "c1", name: "session", value: "abc", enabled: true, secure: false }
    renderWith(
      { [pathParam.id]: pathParam },
      {},
      { pathParams: { [pathParam.id]: pathParam }, cookieParams: { [cookieParam.id]: cookieParam } },
      { [cookieParam.id]: cookieParam },
    )

    const rows = Array.from(document.querySelectorAll('[data-test-id="field-row"]')) as HTMLElement[]
    const pathRow = rows[0]
    const enabledToggle = pathRow.querySelector('[data-test-id="field-row:enabled-checkbox"]') as HTMLElement
    await user.click(enabledToggle)
    expect(actions.updatePathParam).toHaveBeenCalledWith("p1", { enabled: false })

    const menuButton = pathRow.querySelector('[data-test-id="field-row:menu-button"]') as HTMLElement
    await user.click(menuButton)

    const sensitiveItem = (await waitFor(() => queryByDataTestId("field-row:menu-sensitive"))) as HTMLElement
    await user.click(sensitiveItem)
    expect(actions.updatePathParam).toHaveBeenCalledWith("p1", { secure: true })

    const pathValueInput = document.querySelector(
      '[data-test-id="request-parameters-panel:path-param-value-input:p1"]',
    ) as HTMLInputElement
    fireEvent.change(pathValueInput, { target: { value: "999" } })
    expect(actions.updatePathParam).toHaveBeenCalledWith("p1", { value: "999" })

    const cookieInput = document.querySelector(
      '[data-test-id="request-parameters-panel:cookie-param-value-input:c1"]',
    ) as HTMLInputElement
    fireEvent.change(cookieInput, { target: { value: "token" } })
    expect(actions.updateCookieParam).toHaveBeenCalledWith("c1", { value: "token" })

    const cookieRow = rows[1]
    const cookieMenuButton = cookieRow.querySelector('[data-test-id="field-row:menu-button"]') as HTMLElement
    await user.click(cookieMenuButton)
    const deleteButton = (await waitFor(() => queryByDataTestId("field-row:menu-delete"))) as HTMLElement
    await user.click(deleteButton)
    expect(actions.removeCookieParam).toHaveBeenCalledWith("c1")
  })
})

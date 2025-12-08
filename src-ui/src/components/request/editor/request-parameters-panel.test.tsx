import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import { RequestParametersPanel } from "./request-parameters-panel"

vi.mock("@/state", () => ({
  useRequestParameters: vi.fn(),
  useRequestHeaders: vi.fn(),
}))
import { useRequestHeaders, useRequestParameters } from "@/state"

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
    vi.mocked(useRequestHeaders).mockReturnValue({
      state: { headers: {}, original: {} },
      actions: {
        updateHeader: vi.fn(),
        removeHeader: vi.fn(),
        addHeader: vi.fn(),
        reorderHeaders: vi.fn(),
      },
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
    const menuButton = queryByDataTestId("request-parameters-panel:query:menu-button:q1") as HTMLElement
    await user.click(menuButton)

    // Click the delete item in the menu
    const deleteItem = (await waitFor(
      () => queryByDataTestId("request-parameters-panel:query:menu-delete:q1"),
    )) as HTMLElement
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
      '[data-test-id="request-parameters-panel:query:value:q1"]',
    ) as HTMLInputElement | null
    expect(valueInput).not.toBeNull()
    expect(valueInput!.className).toContain("unsaved-changes")

    const menuButton = queryByDataTestId("request-parameters-panel:query:menu-button:q1") as HTMLElement
    await user.click(menuButton)

    const sensitiveItem = (await waitFor(
      () => queryByDataTestId("request-parameters-panel:query:menu-sensitive:q1"),
    )) as HTMLElement
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

    const nameInput = document.querySelector(
      '[data-test-id="request-parameters-panel:cookie:name:c1"]',
    ) as HTMLInputElement | null
    expect(nameInput).not.toBeNull()
    expect(nameInput!.className).toContain("unsaved-changes")

    const menuButton = queryByDataTestId("request-parameters-panel:cookie:menu-button:c1") as HTMLElement
    await user.click(menuButton)

    const sensitiveItem = (await waitFor(
      () => queryByDataTestId("request-parameters-panel:cookie:menu-sensitive:c1"),
    )) as HTMLElement
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

    const pathRow = queryByDataTestId("request-parameters-panel:path:row:p1") as HTMLElement
    const enabledToggle = queryByDataTestId("request-parameters-panel:path:enabled:p1") as HTMLElement
    await user.click(enabledToggle)
    expect(actions.updatePathParam).toHaveBeenCalledWith("p1", { enabled: false })

    const menuButton = queryByDataTestId("request-parameters-panel:path:menu-button:p1") as HTMLElement
    await user.click(menuButton)

    const sensitiveItem = (await waitFor(
      () => queryByDataTestId("request-parameters-panel:path:menu-sensitive:p1"),
    )) as HTMLElement
    await user.click(sensitiveItem)
    expect(actions.updatePathParam).toHaveBeenCalledWith("p1", { secure: true })

    const pathValueInput = document.querySelector(
      '[data-test-id="request-parameters-panel:path:value:p1"]',
    ) as HTMLInputElement
    fireEvent.change(pathValueInput, { target: { value: "999" } })
    expect(actions.updatePathParam).toHaveBeenCalledWith("p1", { value: "999" })

    const cookieInput = document.querySelector(
      '[data-test-id="request-parameters-panel:cookie:value:c1"]',
    ) as HTMLInputElement
    fireEvent.change(cookieInput, { target: { value: "token" } })
    expect(actions.updateCookieParam).toHaveBeenCalledWith("c1", { value: "token" })

    const cookieMenuButton = queryByDataTestId("request-parameters-panel:cookie:menu-button:c1") as HTMLElement
    await user.click(cookieMenuButton)
    const deleteButton = (await waitFor(
      () => queryByDataTestId("request-parameters-panel:cookie:menu-delete:c1"),
    )) as HTMLElement
    await user.click(deleteButton)
    expect(actions.removeCookieParam).toHaveBeenCalledWith("c1")
  })

  it("adds new params when add buttons are clicked", async () => {
    renderWith({}, {}, {}, {})

    const pathButton = queryByDataTestId("request-parameters-panel:add-path-param-button")
    const queryButton = queryByDataTestId("request-parameters-panel:add-query-param-button")
    const cookieButton = queryByDataTestId("request-parameters-panel:add-cookie-param-button")

    expect(pathButton).not.toBeNull()
    expect(queryButton).not.toBeNull()
    expect(cookieButton).not.toBeNull()

    fireEvent.click(pathButton as HTMLElement)
    fireEvent.click(queryButton as HTMLElement)
    fireEvent.click(cookieButton as HTMLElement)

    expect(actions.addPathParam).toHaveBeenCalled()
    expect(actions.addQueryParam).toHaveBeenCalled()
    expect(actions.addCookieParam).toHaveBeenCalled()
  })

  it("reorders parameters via menu move actions", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })
    const pathParams = {
      p1: { id: "p1", name: "first", value: "1", enabled: true, secure: false },
      p2: { id: "p2", name: "second", value: "2", enabled: true, secure: false },
    }
    const queryParams = {
      q1: { id: "q1", name: "a", value: "1", enabled: true, secure: false },
      q2: { id: "q2", name: "b", value: "2", enabled: true, secure: false },
    }

    renderWith(pathParams, queryParams, { pathParams, queryParams }, {})

    // path param p1 move down
    await user.click(queryByDataTestId("request-parameters-panel:path:menu-button:p1") as HTMLElement)
    const moveDown = await waitFor(
      () => queryByDataTestId("request-parameters-panel:path:menu-move-down:p1") as HTMLElement,
    )
    await user.click(moveDown!)
    expect(actions.reorderPathParams).toHaveBeenCalledWith(["p2", "p1"])

    // query param q2 move up (menu index 3 because path rows first)
    await user.click(queryByDataTestId("request-parameters-panel:query:menu-button:q2") as HTMLElement)
    const moveUp = await waitFor(
      () => queryByDataTestId("request-parameters-panel:query:menu-move-up:q2") as HTMLElement,
    )
    await user.click(moveUp!)
    expect(actions.reorderQueryParams).toHaveBeenCalledWith(["q2", "q1"])
  })

  it("flags unsaved enabled/name/secure states", async () => {
    const user = userEvent.setup()
    const pathParam = { id: "p1", name: "id", value: "1", enabled: true, secure: true }
    const original = { pathParams: { p1: { ...pathParam, enabled: false, name: "old-id", secure: false } } }

    renderWith({ [pathParam.id]: pathParam }, {}, original, {})

    const enabled = document.querySelector(
      '[data-test-id="request-parameters-panel:path:enabled:p1"]',
    ) as HTMLElement
    const nameInput = document.querySelector(
      '[data-test-id="request-parameters-panel:path:name:p1"]',
    ) as HTMLInputElement
    expect(enabled.className).toContain("unsaved-changes")
    expect(nameInput.className).toContain("unsaved-changes")

    const menuButton = queryByDataTestId("request-parameters-panel:path:menu-button:p1") as HTMLElement
    await user.click(menuButton)
    const sensitiveItem = (await waitFor(
      () => queryByDataTestId("request-parameters-panel:path:menu-sensitive:p1"),
    )) as HTMLElement
    expect(sensitiveItem.className).toContain("unsaved-changes")
  })
})

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/knurl/tooltip"
import { RequestHeadersPanel } from "./request-headers-panel"

vi.mock("@/state", () => ({
  useRequestHeaders: vi.fn(),
  useRequestParameters: vi.fn(),
}))

import { useRequestHeaders, useRequestParameters } from "@/state"

describe("RequestHeadersPanel", () => {
  const tabId = "tab-x"
  const actions = {
    updateHeader: vi.fn(),
    removeHeader: vi.fn(),
    addHeader: vi.fn(),
    addCookieHeader: vi.fn(),
    reorderHeaders: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWith = (headers: any, original: any) => {
    vi.mocked(useRequestHeaders).mockReturnValue({
      state: { headers, original },
      actions,
    } as any)
    vi.mocked(useRequestParameters).mockReturnValue({
      state: { queryParams: {}, pathParams: {}, cookieParams: {}, original: {} },
      actions: {
        updatePathParam: vi.fn(),
        updateQueryParam: vi.fn(),
        updateCookieParam: vi.fn(),
        removePathParam: vi.fn(),
        removeQueryParam: vi.fn(),
        removeCookieParam: vi.fn(),
        reorderPathParams: vi.fn(),
        reorderQueryParams: vi.fn(),
        reorderCookieParams: vi.fn(),
        addPathParam: vi.fn(),
        addQueryParam: vi.fn(),
        addCookieParam: vi.fn(),
      },
    } as any)
    return render(
      <TooltipProvider>
        <RequestHeadersPanel tabId={tabId} />
      </TooltipProvider>,
    )
  }

  const queryByDataTestId = (id: string) => document.querySelector(`[data-test-id="${id}"]`) as HTMLElement | null

  it("renders headers section title and add button", () => {
    renderWith({}, {})
    expect(screen.getByText(/request headers/i)).toBeInTheDocument()
    expect(queryByDataTestId("request-headers-panel:add-header-button")).not.toBeNull()
  })

  it("updates header name/value and removes header", async () => {
    const user = userEvent.setup()
    const h = { id: "h1", name: "X-Test", value: "1", enabled: true, secure: false }
    renderWith({ [h.id]: h }, { [h.id]: h })

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "X-Updated" } })
    expect(actions.updateHeader).toHaveBeenCalledWith("h1", { name: "X-Updated" })

    fireEvent.change(screen.getByPlaceholderText("Value"), { target: { value: "2" } })
    expect(actions.updateHeader).toHaveBeenCalledWith("h1", { value: "2" })

    // Click the menu button to open the dropdown
    const menuButton = queryByDataTestId("request-headers-panel:menu-button:h1") as HTMLElement
    await user.click(menuButton)

    // Click the delete item in the menu
    const deleteItem = await screen.findByText("Delete")
    await user.click(deleteItem)
    expect(actions.removeHeader).toHaveBeenCalledWith("h1")
  })

  it("toggles enabled and secure state, marks unsaved when changed", async () => {
    const user = userEvent.setup()
    const h = { id: "h2", name: "Auth", value: "secret", enabled: false, secure: false }
    renderWith({ [h.id]: h }, { [h.id]: h })

    const enabled = queryByDataTestId("request-headers-panel:enabled:h2") as HTMLElement
    await user.click(enabled)
    expect(actions.updateHeader).toHaveBeenCalledWith("h2", { enabled: true })

    // Click the menu button to open dropdown
    const menuButton = queryByDataTestId("request-headers-panel:menu-button:h2") as HTMLElement
    await user.click(menuButton)

    // Click the Sensitive checkbox item
    const sensitiveItem = (await waitFor(
      () => queryByDataTestId("request-headers-panel:menu-sensitive:h2"),
    )) as HTMLElement
    await user.click(sensitiveItem)
    expect(actions.updateHeader).toHaveBeenCalledWith("h2", { secure: true })
  })

  it("renders empty state when no headers exist", () => {
    const { container } = renderWith({}, {})
    expect(container.querySelector('[data-test-id="request-headers-panel:empty-state"]')).toBeInTheDocument()
  })

  it("marks unsaved changes and masks secure values", () => {
    const h = { id: "h3", name: "Auth", value: "secret", enabled: true, secure: true }
    renderWith({ [h.id]: h }, { [h.id]: { ...h, value: "old", secure: false } })

    const valueInput = document.querySelector('[data-test-id="request-headers-panel:value:h3"]') as HTMLInputElement
    expect(valueInput.type).toBe("password")
    expect(valueInput.className).toContain("unsaved-changes")
  })

  it("shows unsaved marker on secure toggle when original differs", async () => {
    const h = { id: "h4", name: "X", value: "v", enabled: true, secure: true }
    renderWith({ [h.id]: h }, { [h.id]: { ...h, secure: false } })

    const menuButton = queryByDataTestId("request-headers-panel:menu-button:h4") as HTMLElement
    await userEvent.click(menuButton)

    const sensitiveRadioItem = (await waitFor(
      () => queryByDataTestId("request-headers-panel:menu-sensitive:h4"),
    )) as HTMLElement
    expect(sensitiveRadioItem.className).toContain("unsaved-changes")
  })

  it("reorders headers via move up/down menu actions", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const h1 = { id: "h1", name: "A", value: "1", enabled: true, secure: false }
    const h2 = { id: "h2", name: "B", value: "2", enabled: true, secure: false }
    renderWith({ h1, h2 }, { h1, h2 })

    // Move second header up
    await user.click(queryByDataTestId("request-headers-panel:menu-button:h2") as HTMLElement)
    await user.click(queryByDataTestId("request-headers-panel:menu-move-up:h2") as HTMLElement)

    // Move first header down
    await user.click(queryByDataTestId("request-headers-panel:menu-button:h1") as HTMLElement)
    await user.click(queryByDataTestId("request-headers-panel:menu-move-down:h1") as HTMLElement)

    expect(actions.reorderHeaders).toHaveBeenCalledTimes(2)
    const calls = actions.reorderHeaders.mock.calls.map(([ids]) => ids)
    expect(calls.every((ids) => ids.includes("h1") && ids.includes("h2"))).toBe(true)
  })

  it("disables move controls at list edges", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const h1 = { id: "h1", name: "Top", value: "1", enabled: true, secure: false }
    const h2 = { id: "h2", name: "Bottom", value: "2", enabled: true, secure: false }
    renderWith({ h1, h2 }, { h1, h2 })

    await user.click(queryByDataTestId("request-headers-panel:menu-button:h1") as HTMLElement)
    const moveUpDisabled = queryByDataTestId("request-headers-panel:menu-move-up:h1")
    expect(moveUpDisabled?.hasAttribute("data-disabled") || moveUpDisabled?.getAttribute("aria-disabled") === "true").toBe(true)

    await user.click(queryByDataTestId("request-headers-panel:menu-button:h2") as HTMLElement)
    const moveDownDisabled = queryByDataTestId("request-headers-panel:menu-move-down:h2")
    expect(moveDownDisabled?.hasAttribute("data-disabled") || moveDownDisabled?.getAttribute("aria-disabled") === "true").toBe(true)
  })

  it("adds a new header from the toolbar action", async () => {
    const user = userEvent.setup()
    renderWith({}, {})

    await user.click(queryByDataTestId("request-headers-panel:add-header-button") as HTMLElement)
    expect(actions.addHeader).toHaveBeenCalled()
  })
})

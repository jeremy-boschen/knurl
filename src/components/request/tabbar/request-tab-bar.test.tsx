import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

import RequestTabBar from "./request-tab-bar"

const hoisted = vi.hoisted(() => ({
  useOpenTabs: vi.fn(),
  collectionsApi: vi.fn(),
}))

const originalConsoleError = console.error

vi.mock("@/state", () => ({
  useOpenTabs: hoisted.useOpenTabs,
  collectionsApi: hoisted.collectionsApi,
  ScratchCollectionId: "scratch",
}))

const tabRegistry = new Map<string, any>()

vi.mock("./request-tab", () => ({
  __esModule: true,
  default: (props: any) => {
    tabRegistry.set(props.tabId, props)
    return (
      <div
        data-test-id={`mock-tab:${props.tabId}`}
        data-tab-key={props.tabId}
        onClick={props.onSelectTab}
        onKeyDown={props.onSelectTab}
        onContextMenu={props.onContextMenu}
      >
        <button
          type="button"
          data-test-id={`mock-tab-close:${props.tabId}`}
          data-tab-key={props.tabId}
          onClick={props.onCloseTab}
        >
          ×
        </button>
      </div>
    )
  },
}))

beforeAll(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0))
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
  vi.spyOn(console, "error").mockImplementation((message?: unknown, ...args: unknown[]) => {
    if (typeof message === "string" && message.includes("cannot be a descendant")) {
      return
    }
    originalConsoleError.call(console, message, ...args)
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  console.error = originalConsoleError
})

describe("RequestTabBar", () => {
  const loadCollection = vi.fn()
  const createRequestTab = vi.fn()
  const setActiveTab = vi.fn()
  const removeTab = vi.fn()
  const closeAllTabs = vi.fn()
  const closeTabsToLeft = vi.fn()
  const closeTabsToRight = vi.fn()

  const buildHook = (openTabs: any[]) => {
    const requestTabsApi = {
      setActiveTab,
      createRequestTab,
      removeTab,
      closeAllTabs,
      closeTabsToLeft,
      closeTabsToRight,
    }
    hoisted.useOpenTabs.mockReturnValue({
      state: { openTabs },
      actions: { requestTabsApi },
    })
    hoisted.collectionsApi.mockReturnValue({
      loadCollection,
    })
  }

  const openTabs = [
    { tabId: "tab-1", requestId: "req-1", collectionId: "col-1" },
    { tabId: "tab-2", requestId: "req-2", collectionId: "col-1" },
    { tabId: "tab-3", requestId: "req-3", collectionId: "col-2" },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    tabRegistry.clear()
    buildHook(openTabs)
    loadCollection.mockResolvedValue({})
  })

  it("returns null without open tabs", () => {
    buildHook([])
    const { container } = render(<RequestTabBar />)
    expect(container.firstChild).toBeNull()
  })

  it("creates a new tab via toolbar button", async () => {
    render(<RequestTabBar />)
    const user = userEvent.setup()
    await user.click(getByDataId("request-tab-bar:new-request-button"))
    expect(loadCollection).toHaveBeenCalledWith("scratch")
    expect(createRequestTab).toHaveBeenCalled()
  })

  it("selects and closes tabs via handlers", () => {
    render(<RequestTabBar />)
    fireEvent.click(getByDataId("mock-tab:tab-1"))
    expect(setActiveTab).toHaveBeenCalledWith("tab-1")

    fireEvent.click(getByDataId("mock-tab-close:tab-2"))
    expect(removeTab).toHaveBeenCalledWith("tab-2")
  })

  it("opens context menu and performs actions", async () => {
    render(<RequestTabBar />)
    fireEvent.contextMenu(getByDataId("mock-tab:tab-2"))

    const menu = await findByDataId("request-tab-bar:context-menu")
    expect(menu).toBeInTheDocument()

    const closeButton = getByDataId("request-tab-bar:context-menu:close")
    await userEvent.click(closeButton)
    expect(removeTab).toHaveBeenCalledWith("tab-2")
  })

  it("disables close-left and close-right appropriately", async () => {
    render(<RequestTabBar />)
    fireEvent.contextMenu(getByDataId("mock-tab:tab-1"))
    const closeLeftFirst = await findByDataId("request-tab-bar:context-menu:close-left")
    expect(closeLeftFirst).toBeDisabled()

    fireEvent.contextMenu(getByDataId("mock-tab:tab-3"))
    const closeRightLast = await findByDataId("request-tab-bar:context-menu:close-right")
    expect(closeRightLast).toBeDisabled()
  })

  it("runs bulk close actions for left/right/all", async () => {
    render(<RequestTabBar />)
    fireEvent.contextMenu(getByDataId("mock-tab:tab-2"))
    const closeAllButton = await findByDataId("request-tab-bar:context-menu:close-all")
    await userEvent.click(closeAllButton)
    expect(closeAllTabs).toHaveBeenCalled()

    fireEvent.contextMenu(getByDataId("mock-tab:tab-2"))
    const closeLeftButton = await findByDataId("request-tab-bar:context-menu:close-left")
    await userEvent.click(closeLeftButton)
    expect(closeTabsToLeft).toHaveBeenCalledWith("tab-2")

    fireEvent.contextMenu(getByDataId("mock-tab:tab-2"))
    const closeRightButton = await findByDataId("request-tab-bar:context-menu:close-right")
    await userEvent.click(closeRightButton)
    expect(closeTabsToRight).toHaveBeenCalledWith("tab-2")
  })
})
  const getByDataId = (id: string): HTMLElement => {
    const el = document.querySelector(`[data-test-id="${id}"]`)
    if (!el) {
      throw new Error(`Missing ${id}`)
    }
    return el as HTMLElement
  }

  const findByDataId = async (id: string): Promise<HTMLElement> => {
    await waitFor(() => {
      if (!document.querySelector(`[data-test-id="${id}"]`)) {
        throw new Error(`Missing ${id}`)
      }
    })
    return getByDataId(id)
  }

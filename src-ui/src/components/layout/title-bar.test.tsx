import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import * as State from "@/state"
import type { RequestTabsApi } from "@/types"

const getCurrentWindow = vi.fn()

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow,
}))

vi.mock("./breadcrumbs", () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs" />,
}))

vi.mock("./environment-selector", () => ({
  EnvironmentSelector: () => <div data-testid="environment-selector" />,
}))

describe("TitleBar", () => {
  let TitleBar: (typeof import("./title-bar"))["TitleBar"]
  const requestTabSpy = vi.spyOn(State, "useRequestTab")
  const openTabsSpy = vi.spyOn(State, "useOpenTabs")
  const collectionsApiSpy = vi.spyOn(State, "useCollectionsApi")

  beforeAll(async () => {
    ;({ TitleBar } = await import("./title-bar"))
  })

  beforeEach(() => {
    requestTabSpy.mockReset()
    openTabsSpy.mockReset()
    collectionsApiSpy.mockReset()
    getCurrentWindow.mockReset()
  })

  const setupState = (options: { hasActiveTab: boolean }) => {
    const requestTabsApi = { createRequestTab: vi.fn() } as unknown as RequestTabsApi
    openTabsSpy.mockReturnValue({
      state: { openTabs: [] },
      actions: { requestTabsApi },
    })

    const loadCollection = vi.fn().mockResolvedValue(undefined)
    const collectionsApi = { loadCollection }
    collectionsApiSpy.mockReturnValue(() => collectionsApi)

    requestTabSpy.mockReturnValue(options.hasActiveTab ? ({} as unknown) : null)

    const windowApi = {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
    }
    getCurrentWindow.mockReturnValue(windowApi)

    return { requestTabsApi, loadCollection, windowApi }
  }

  it("renders breadcrumbs + environment selector when a tab is active", () => {
    setupState({ hasActiveTab: true })
    render(<TitleBar />)

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument()
    expect(screen.getByTestId("environment-selector")).toBeInTheDocument()
    expect(document.querySelector('[data-test-id="titlebar:new-request-button"]')).toBeNull()
  })

  it("loads the scratch collection and opens a new tab when no request is active", async () => {
    const { loadCollection, requestTabsApi } = setupState({ hasActiveTab: false })
    render(<TitleBar />)

    const newRequestButton = document.querySelector('[data-test-id="titlebar:new-request-button"]') as HTMLButtonElement
    expect(newRequestButton).toBeTruthy()
    fireEvent.click(newRequestButton)

    await waitFor(() => {
      expect(loadCollection).toHaveBeenCalledWith(State.ScratchCollectionId)
      expect(requestTabsApi.createRequestTab).toHaveBeenCalledTimes(1)
    })
  })

  it("delegates window controls to the Tauri window handle", () => {
    const { windowApi } = setupState({ hasActiveTab: true })
    render(<TitleBar />)

    const minimizeButton = document.querySelector('[data-test-id="title-bar:minimize-button"]') as HTMLButtonElement
    const maximizeButton = document.querySelector('[data-test-id="title-bar:maximize-button"]') as HTMLButtonElement
    const closeButton = document.querySelector('[data-test-id="title-bar:close-button"]') as HTMLButtonElement

    fireEvent.click(minimizeButton)
    fireEvent.click(maximizeButton)
    fireEvent.click(closeButton)

    expect(windowApi.minimize).toHaveBeenCalledTimes(1)
    expect(windowApi.toggleMaximize).toHaveBeenCalledTimes(1)
    expect(windowApi.close).toHaveBeenCalledTimes(1)
    expect(getCurrentWindow).toHaveBeenCalledTimes(3)
  })
})

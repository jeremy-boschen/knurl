import {act, fireEvent, render, screen, waitFor} from "@testing-library/react"
import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest"

import * as State from "@/state"
import type {CollectionsApi, RequestTabsApi} from "@/types"

const windowApi = {
  isMaximized: vi.fn().mockResolvedValue(false),
  minimize: vi.fn(),
  maximize: vi.fn(),
  unmaximize: vi.fn(),
  close: vi.fn(),
}
const getCurrentWindow = vi.fn().mockReturnValue(windowApi)

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow,
}))

vi.mock("./breadcrumbs", () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs"/>,
}))

vi.mock("./environment-selector", () => ({
  EnvironmentSelector: () => <div data-testid="environment-selector"/>,
}))

describe("TitleBar", () => {
  let TitleBar: (typeof import("./title-bar"))["TitleBar"]
  const requestTabSpy = vi.spyOn(State, "useRequestTab")
  const openTabsSpy = vi.spyOn(State, "useOpenTabs")
  const collectionsApiSpy = vi.spyOn(State, "useCollectionsApi")

  beforeAll(async () => {
    ;({TitleBar} = await import("./title-bar"))
  })

  beforeEach(() => {
    requestTabSpy.mockReset()
    openTabsSpy.mockReset()
    collectionsApiSpy.mockReset()
    getCurrentWindow.mockReset()
    getCurrentWindow.mockReturnValue(windowApi)
    Object.values(windowApi).forEach((fn) => {
      if (typeof fn === "function" && "mockReset" in fn) {
        ;(fn as any).mockReset()
      }
    })
  })

  const setupState = (options: { hasActiveTab: boolean }) => {
    const requestTabsApi = {createRequestTab: vi.fn()} as unknown as RequestTabsApi
    openTabsSpy.mockReturnValue({
      state: {openTabs: []},
      actions: {requestTabsApi},
    })

    const loadCollection = vi.fn().mockResolvedValue(undefined)
    const collectionsApi = {loadCollection}
    collectionsApiSpy.mockReturnValue(() => collectionsApi as unknown as CollectionsApi)

    requestTabSpy.mockReturnValue(options.hasActiveTab ? ({} as any) : null)

    return {requestTabsApi, loadCollection, windowApi}
  }

  it("renders breadcrumbs + environment selector when a tab is active", async () => {
    setupState({hasActiveTab: true})
    await act(async () => {
      render(<TitleBar/>)
    })

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument()
    expect(screen.getByTestId("environment-selector")).toBeInTheDocument()
    expect(document.querySelector('[data-test-id="titlebar:new-request-button"]')).toBeNull()
  })

  it("loads the scratch collection and opens a new tab when no request is active", async () => {
    const {loadCollection, requestTabsApi} = setupState({hasActiveTab: false})
    await act(async () => {
      render(<TitleBar/>)
    })

    const newRequestButton = document.querySelector('[data-test-id="titlebar:new-request-button"]') as HTMLButtonElement
    expect(newRequestButton).toBeTruthy()
    fireEvent.click(newRequestButton)

    await waitFor(() => {
      expect(loadCollection).toHaveBeenCalledWith(State.ScratchCollectionId)
      expect(requestTabsApi.createRequestTab).toHaveBeenCalledTimes(1)
    })
  })

  it("delegates window controls to the Tauri window handle", async () => {
    const {windowApi} = setupState({hasActiveTab: true})
    await act(async () => {
      render(<TitleBar/>)
    })

    const minimizeButton = document.querySelector('[data-test-id="title-bar:minimize-button"]') as HTMLButtonElement
    const maximizeButton = document.querySelector('[data-test-id="title-bar:maximize-button"]') as HTMLButtonElement
    const closeButton = document.querySelector('[data-test-id="title-bar:close-button"]') as HTMLButtonElement

    fireEvent.click(minimizeButton)
    fireEvent.click(maximizeButton)
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(windowApi.minimize).toHaveBeenCalledTimes(1)
      expect(windowApi.maximize).toHaveBeenCalledTimes(1)
      expect(windowApi.close).toHaveBeenCalledTimes(1)
      expect(getCurrentWindow).toHaveBeenCalledTimes(4)
    })
  })
})

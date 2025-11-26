import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PanelGroupHandle } from "@jeremy-boschen/react-adjustable-panels"

import { useApplication } from "@/state/application"
import { resetApplicationStore } from "@test/zustand"

const createPanelGroupHandle = () =>
  ({
    setSizes: vi.fn(),
    getSizes: vi.fn(() => []),
    collapsePanel: vi.fn(),
    expandPanel: vi.fn(),
    setCollapsed: vi.fn(),
    isCollapsed: vi.fn(() => false),
  }) as unknown as PanelGroupHandle

describe("sidebar slice", () => {
  beforeEach(() => {
    resetApplicationStore()
    vi.restoreAllMocks()
  })

  it("stores and clears panel group handle", () => {
    const { sidebarApi } = useApplication.getState()
    const handle = createPanelGroupHandle()

    sidebarApi.setPanelGroupApi(handle)
    expect(useApplication.getState().sidebarState.panelGroupApi).toBe(handle)

    sidebarApi.setPanelGroupApi(null)
    expect(useApplication.getState().sidebarState.panelGroupApi).toBeNull()
  })

  it("updates collapse state and toggles panel group when available", () => {
    const { sidebarApi } = useApplication.getState()
    const handle = createPanelGroupHandle()

    sidebarApi.setPanelGroupApi(handle)

    sidebarApi.setCollapsed(true)
    expect(handle.collapsePanel).toHaveBeenCalledWith(0)
    expect(useApplication.getState().sidebarState.isCollapsed).toBe(true)

    sidebarApi.setCollapsed(false)
    expect(handle.expandPanel).toHaveBeenCalledWith(0)
    expect(useApplication.getState().sidebarState.isCollapsed).toBe(false)
  })

  it("collapse/expand helpers flip state even without a panel handle", () => {
    const { sidebarApi } = useApplication.getState()

    sidebarApi.collapseSidebar()
    expect(useApplication.getState().sidebarState.isCollapsed).toBe(true)

    sidebarApi.expandSidebar()
    expect(useApplication.getState().sidebarState.isCollapsed).toBe(false)
  })
})

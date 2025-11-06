import type { ImperativePanelHandle } from "react-resizable-panels"

import type { StateCreator } from "zustand"

import type { Application, SidebarApi, SidebarSlice } from "@/types"

export const sidebarSliceCreator: StateCreator<
  Application,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  SidebarSlice
> = (set, get, _storeApi) => {
  const sidebarApi: SidebarApi = {
    setCollapsed(collapsed: boolean) {
      set((app) => {
        app.sidebarState.isCollapsed = collapsed
      })

      const panelApi = get().sidebarState.panelApi
      if (panelApi) {
        collapsed ? panelApi.collapse() : panelApi.expand()
      }
    },

    collapseSidebar() {
      sidebarApi.setCollapsed(true)
    },

    expandSidebar() {
      sidebarApi.setCollapsed(false)
    },

    setPanelApi(panel: ImperativePanelHandle | null) {
      set((app) => {
        app.sidebarState.panelApi = panel
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: true,
      panelApi: null,
    },
    sidebarApi,
  }
}

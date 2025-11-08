import type { PanelGroupHandle } from "@jeremy-boschen/react-adjustable-panels"

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

      const panelGroupApi = get().sidebarState.panelGroupApi
      if (panelGroupApi) {
        // Use setSizes to set sidebar to collapsedSize (0px) or expanded (250px)
        collapsed ? panelGroupApi.setSizes(["0px", "auto"]) : panelGroupApi.setSizes(["250px", "auto"])
      }
    },

    collapseSidebar() {
      sidebarApi.setCollapsed(true)
    },

    expandSidebar() {
      sidebarApi.setCollapsed(false)
    },

    setPanelGroupApi(panelGroup: PanelGroupHandle | null) {
      set((app) => {
        app.sidebarState.panelGroupApi = panelGroup
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: true,
      panelGroupApi: null,
    },
    sidebarApi,
  }
}

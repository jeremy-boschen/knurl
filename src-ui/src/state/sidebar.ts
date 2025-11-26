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
      const panelGroupApi = get().sidebarState.panelGroupApi
      if (panelGroupApi) {
        // Use setSizes to set sidebar to collapsedSize (35px) or expanded (275px). Must keep in sync with
        // app-layout.tsx
        collapsed ? panelGroupApi.collapsePanel(0) : panelGroupApi.expandPanel(0)
        //collapsed ? panelGroupApi.setSizes(["35px", "auto"]) : panelGroupApi.setSizes(["275px", "auto"])
      }

      set((app) => {
        app.sidebarState.isCollapsed = collapsed
      })
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

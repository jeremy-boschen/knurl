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
      console.log("[sidebar] setCollapsed called with:", collapsed)
      const panelGroupApi = get().sidebarState.panelGroupApi
      console.log("[sidebar] panelGroupApi exists:", !!panelGroupApi)
      if (panelGroupApi) {
        // Use setSizes to set sidebar to collapsedSize (35px) or expanded (275px). Must keep in sync with
        // app-layout.tsx
        console.log("[sidebar] calling panelGroupApi.", collapsed ? "collapsePanel(0)" : "expandPanel(0)")
        collapsed ? panelGroupApi.collapsePanel(0) : panelGroupApi.expandPanel(0)
        //collapsed ? panelGroupApi.setSizes(["35px", "auto"]) : panelGroupApi.setSizes(["275px", "auto"])
      }

      console.log("[sidebar] updating Zustand state")
      set((app) => {
        app.sidebarState.isCollapsed = collapsed
      })
      console.log("[sidebar] state updated")
    },

    collapseSidebar() {
      console.log("[sidebar] collapseSidebar called")
      sidebarApi.setCollapsed(true)
    },

    expandSidebar() {
      console.log("[sidebar] expandSidebar called")
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

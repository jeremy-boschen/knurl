import type { PanelHandle } from "@/components/ui/resizable"

import type { StateCreator } from "zustand"

import type { Application, SidebarApi, SidebarSlice } from "@/types"

// Store panelApi outside of Immer state to avoid circular reference issues
let panelApiRef: PanelHandle | null = null

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

      // Use the module-level ref instead of state
      if (panelApiRef) {
        collapsed ? panelApiRef.collapse() : panelApiRef.expand()
      }
    },

    collapseSidebar() {
      sidebarApi.setCollapsed(true)
    },

    expandSidebar() {
      sidebarApi.setCollapsed(false)
    },

    setPanelApi(panel: PanelHandle | null) {
      // Store in module-level ref only, not in Immer state
      // This avoids circular reference issues with Immer proxies
      panelApiRef = panel
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

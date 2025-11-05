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
      const currentState = get().sidebarState.isCollapsed
      if (currentState === collapsed) {
        return
      }

      set((app) => {
        app.sidebarState.isCollapsed = collapsed
      })
    },

    collapseSidebar() {
      set((app) => {
        app.sidebarState.isCollapsed = true
      })
    },

    expandSidebar() {
      set((app) => {
        app.sidebarState.isCollapsed = false
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: true,
    },
    sidebarApi,
  }
}

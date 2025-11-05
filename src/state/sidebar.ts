import type { AllotmentHandle } from "allotment"

import type { StateCreator } from "zustand"

import type { Application, SidebarApi, SidebarSlice } from "@/types"

const COLLAPSED_SIZE = 50
const EXPANDED_SIZE = 250

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

      const splitviewApi = get().sidebarState.splitviewApi
      if (splitviewApi) {
        splitviewApi.resize(0, collapsed ? COLLAPSED_SIZE : EXPANDED_SIZE)
      }
    },

    collapseSidebar() {
      sidebarApi.setCollapsed(true)
    },

    expandSidebar() {
      sidebarApi.setCollapsed(false)
    },

    setSplitviewApi(splitview: AllotmentHandle | null) {
      set((app) => {
        app.sidebarState.splitviewApi = splitview
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: true,
      splitviewApi: null,
    },
    sidebarApi,
  }
}

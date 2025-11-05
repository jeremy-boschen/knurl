import type { AllotmentHandle } from "allotment"

import type { StateCreator } from "zustand"

import type { Application, SidebarApi, SidebarSlice } from "@/types"

const COLLAPSED_SIZE = 50
const MIN_EXPANDED_SIZE = 250

export const sidebarSliceCreator: StateCreator<
  Application,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  SidebarSlice
> = (set, get, _storeApi) => {
  const sidebarApi: SidebarApi = {
    setCollapsed(collapsed: boolean) {
      // Only update state if it's actually changing
      const currentState = get().sidebarState.isCollapsed
      if (currentState === collapsed) return

      set((app) => {
        app.sidebarState.isCollapsed = collapsed
      })
    },

    collapseSidebar() {
      // Update state
      set((app) => {
        app.sidebarState.isCollapsed = true
      })

      // Resize to collapsed size
      const splitviewApi = get().sidebarState.splitviewApi
      if (splitviewApi) {
        splitviewApi.resize(0, COLLAPSED_SIZE)
      }
    },

    expandSidebar() {
      // Update state
      set((app) => {
        app.sidebarState.isCollapsed = false
      })

      // Resize to expanded size
      const splitviewApi = get().sidebarState.splitviewApi
      if (splitviewApi) {
        splitviewApi.resize(0, MIN_EXPANDED_SIZE)
      }
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

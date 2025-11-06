import type { StateCreator } from "zustand"

import { closeSplitter, getSplitPaneInstance, openSplitter } from "a-multilayout-splitter"

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

      const splitId = get().sidebarState.splitId
      if (splitId) {
        const instances = getSplitPaneInstance()
        const instance = instances[splitId]
        if (instance) {
          if (collapsed) {
            closeSplitter(instance, 0, "horizontal")
          } else {
            openSplitter(instance, 0, "horizontal")
          }
        }
      }
    },

    collapseSidebar() {
      sidebarApi.setCollapsed(true)
    },

    expandSidebar() {
      sidebarApi.setCollapsed(false)
    },

    setSplitId(id: string) {
      set((app) => {
        app.sidebarState.splitId = id
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: true,
      splitId: "app-layout",
    },
    sidebarApi,
  }
}

import {getSplitPaneInstance} from "a-multilayout-splitter"
import type {StateCreator} from "zustand"

import type {Application, SidebarApi, SidebarSlice} from "@/types"

// Minimum width percentage for collapsed (icon-only) view
const COLLAPSED_SIZE = 4 // ~25-50px depending on window width
// Default expanded size
const DEFAULT_EXPANDED_SIZE = 25
// Threshold percentage - below this, auto-switch to collapsed view
const COLLAPSE_THRESHOLD = 8 // ~100px on 1400px window

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
        const instance = instances?.[splitId]
        if (instance) {
          const targetSize = collapsed ? COLLAPSED_SIZE : get().sidebarState.lastExpandedSize

          // Directly manipulate the first child's flex-basis (sidebar pane)
          const sections = instance.children
          if (sections && sections.length > 0) {
            const sidebarPane = sections[0] as HTMLDivElement
            if (sidebarPane) {
              sidebarPane.style.flexBasis = `${targetSize}%`

              set((app) => {
                app.sidebarState.currentSize = targetSize
              })
            }
          }
        }
      }
    },

    collapseSidebar() {
      // Store current size if we're currently expanded
      const currentState = get().sidebarState
      if (!currentState.isCollapsed && currentState.currentSize > COLLAPSE_THRESHOLD) {
        sidebarApi.setLastExpandedSize(currentState.currentSize)
      }
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

    updateSize(size: number) {
      set((app) => {
        app.sidebarState.currentSize = size
      })

      // Auto-switch view based on size threshold
      const currentState = get().sidebarState
      if (size < COLLAPSE_THRESHOLD && !currentState.isCollapsed) {
        // Crossed below threshold while dragging - switch to collapsed view
        set((app) => {
          app.sidebarState.isCollapsed = true
        })
      } else if (size >= COLLAPSE_THRESHOLD && currentState.isCollapsed) {
        // Crossed above threshold while dragging - switch to expanded view
        set((app) => {
          app.sidebarState.isCollapsed = false
        })
      }

      // Store as last expanded size if above threshold
      if (size >= COLLAPSE_THRESHOLD) {
        sidebarApi.setLastExpandedSize(size)
      }
    },

    setLastExpandedSize(size: number) {
      set((app) => {
        app.sidebarState.lastExpandedSize = size
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: false,
      splitId: "app-layout",
      currentSize: DEFAULT_EXPANDED_SIZE,
      lastExpandedSize: DEFAULT_EXPANDED_SIZE,
    },
    sidebarApi,
  }
}

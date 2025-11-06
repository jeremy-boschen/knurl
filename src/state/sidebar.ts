import {getSplitPaneInstance} from "a-multilayout-splitter"
import type {StateCreator} from "zustand"

import type {Application, SidebarApi, SidebarSlice} from "@/types"

// Pixel-based sizing constants
const COLLAPSED_SIZE_PX = 50 // Collapsed width in pixels (icon-only view)
const COLLAPSE_THRESHOLD_PX = 100 // Below this width, auto-switch to collapsed view
const DEFAULT_EXPANDED_SIZE_PX = 300 // Default expanded width in pixels
const MIN_SIZE_PX = 25 // Absolute minimum width

// Helper function to convert pixels to percentage
const pxToPercent = (px: number, containerWidth: number): number => {
  if (containerWidth === 0) return 0
  return (px / containerWidth) * 100
}

// Helper function to convert percentage to pixels
const percentToPx = (percent: number, containerWidth: number): number => {
  return (percent / 100) * containerWidth
}

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
      const containerWidth = get().sidebarState.containerWidth

      if (splitId && containerWidth > 0) {
        const instances = getSplitPaneInstance()
        const instance = instances?.[splitId]
        if (instance) {
          const targetSizePx = collapsed ? COLLAPSED_SIZE_PX : percentToPx(get().sidebarState.lastExpandedSizePercent, containerWidth)
          const targetSizePercent = pxToPercent(targetSizePx, containerWidth)

          // Directly manipulate the first child's flex-basis (sidebar pane)
          const sections = instance.children
          if (sections && sections.length > 0) {
            const sidebarPane = sections[0] as HTMLDivElement
            if (sidebarPane) {
              sidebarPane.style.flexBasis = `${targetSizePercent}%`

              set((app) => {
                app.sidebarState.currentSizePercent = targetSizePercent
              })
            }
          }
        }
      }
    },

    collapseSidebar() {
      // Store current size if we're currently expanded
      const currentState = get().sidebarState
      const currentSizePx = percentToPx(currentState.currentSizePercent, currentState.containerWidth)

      if (!currentState.isCollapsed && currentSizePx > COLLAPSE_THRESHOLD_PX) {
        sidebarApi.setLastExpandedSize(currentState.currentSizePercent)
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

    updateSize(sizePercent: number, containerWidth: number) {
      set((app) => {
        app.sidebarState.currentSizePercent = sizePercent
        app.sidebarState.containerWidth = containerWidth
      })

      // Convert to pixels for threshold comparison
      const sizePx = percentToPx(sizePercent, containerWidth)

      // Auto-switch view based on pixel threshold
      const currentState = get().sidebarState
      if (sizePx < COLLAPSE_THRESHOLD_PX && !currentState.isCollapsed) {
        // Crossed below threshold while dragging - switch to collapsed view
        console.log(`[Sidebar] Auto-collapse: ${sizePx.toFixed(0)}px < ${COLLAPSE_THRESHOLD_PX}px`)
        set((app) => {
          app.sidebarState.isCollapsed = true
        })
      } else if (sizePx >= COLLAPSE_THRESHOLD_PX && currentState.isCollapsed) {
        // Crossed above threshold while dragging - switch to expanded view
        console.log(`[Sidebar] Auto-expand: ${sizePx.toFixed(0)}px >= ${COLLAPSE_THRESHOLD_PX}px`)
        set((app) => {
          app.sidebarState.isCollapsed = false
        })
      }

      // Store as last expanded size if above threshold
      if (sizePx >= COLLAPSE_THRESHOLD_PX) {
        sidebarApi.setLastExpandedSize(sizePercent)
      }
    },

    setLastExpandedSize(sizePercent: number) {
      set((app) => {
        app.sidebarState.lastExpandedSizePercent = sizePercent
      })
    },

    setContainerWidth(width: number) {
      set((app) => {
        app.sidebarState.containerWidth = width
      })
    },
  }

  return {
    sidebarState: {
      isCollapsed: false,
      splitId: "app-layout",
      currentSizePercent: 25, // Will be updated on mount
      lastExpandedSizePercent: 25,
      containerWidth: 1400, // Default, will be updated with actual width
    },
    sidebarApi,
  }
}

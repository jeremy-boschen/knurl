import { useRef } from "react"
import { Allotment, type AllotmentHandle } from "allotment"
import "allotment/dist/style.css"

import RequestWorkspace from "@/components/request/request-workspace"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

const COLLAPSED_SIZE = 50
const MIN_EXPANDED_SIZE = 250
const SNAP_THRESHOLD = 150

export default function AppLayout() {
  const {
    actions: { setSplitviewApi, setCollapsed },
    isCollapsed,
  } = useSidebar()
  const activeTabId = useActiveTabId()
  const isProgrammaticResizeRef = useRef(false)
  const splitviewRef = useRef<AllotmentHandle | null>(null)

  // Handle ref setup and track programmatic resizes
  const handleSplitviewRef = (ref: AllotmentHandle | null) => {
    splitviewRef.current = ref

    // Wrap the resize method to track programmatic resizes
    if (ref) {
      const originalResize = ref.resize.bind(ref)
      ref.resize = (index: number, size: number) => {
        isProgrammaticResizeRef.current = true
        originalResize(index, size)
        // Reset after a short delay to allow onChange to fire
        setTimeout(() => {
          isProgrammaticResizeRef.current = false
        }, 50)
      }
    }

    setSplitviewApi(ref)
  }

  // Implement hysteresis for content switching
  const handleResize = (sizes: number[]) => {
    const sidebarSize = sizes[0]

    // Skip state updates during programmatic resizes (button clicks)
    if (isProgrammaticResizeRef.current) {
      return
    }

    // Hysteresis: maintain current state until crossing the opposite threshold
    if (isCollapsed) {
      // Currently collapsed - only switch to expanded when reaching MIN_EXPANDED_SIZE
      if (sidebarSize >= MIN_EXPANDED_SIZE) {
        setCollapsed(false)
      }
    } else {
      // Currently expanded - only switch to collapsed when reaching COLLAPSED_SIZE
      if (sidebarSize <= COLLAPSED_SIZE + 10) { // Small buffer to trigger collapse
        setCollapsed(true)
      }
    }

    // Snap to valid sizes during manual resize
    if (sidebarSize > COLLAPSED_SIZE && sidebarSize < MIN_EXPANDED_SIZE) {
      // Determine snap target based on which side of threshold we're closer to
      const targetSize = sidebarSize < SNAP_THRESHOLD ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE
      if (splitviewRef.current) {
        splitviewRef.current.resize(0, targetSize)
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
      <UtilitySheetHost />
      <div className="flex h-full flex-1 overflow-hidden">
        <Allotment
          ref={handleSplitviewRef}
          vertical={false}
          proportionalLayout={false}
          onChange={handleResize}
        >
          <Allotment.Pane
            minSize={COLLAPSED_SIZE}
            preferredSize={COLLAPSED_SIZE}
            className="overflow-hidden"
          >
            <Sidebar />
          </Allotment.Pane>

          <Allotment.Pane className="overflow-auto">
            <div className="flex h-full flex-col bg-background">
              <AppHeader className="bg-muted border-b" />
              <div className="flex-1 overflow-hidden ">
                {activeTabId ? (
                  <RequestWorkspace tabId={activeTabId} />
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-foreground"
                    data-test-id="app-layout:empty-state"
                  >
                    <div className="text-center">
                      <p className="mb-2 text-lg">No request open</p>
                      <p className="text-sm">Select a request from the sidebar or create a new one</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  )
}

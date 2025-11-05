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
  const isResizingRef = useRef(false)
  const splitviewRef = useRef<AllotmentHandle | null>(null)

  // Handle ref setup
  const handleSplitviewRef = (ref: AllotmentHandle | null) => {
    splitviewRef.current = ref
    setSplitviewApi(ref)
  }

  // Enforce snap behavior: either collapsed (50px) or expanded (>=250px)
  const handleResize = (sizes: number[]) => {
    const sidebarSize = sizes[0]

    // Update collapsed state based on size
    if (sidebarSize < MIN_EXPANDED_SIZE) {
      setCollapsed(true)
    } else {
      setCollapsed(false)
    }

    // Snap to collapsed or min expanded size
    if (!isResizingRef.current && sidebarSize > COLLAPSED_SIZE && sidebarSize < MIN_EXPANDED_SIZE) {
      isResizingRef.current = true
      setTimeout(() => {
        if (splitviewRef.current) {
          // Snap based on which side of threshold we're on
          const targetSize = sidebarSize < SNAP_THRESHOLD ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE
          splitviewRef.current.resize(0, targetSize)
        }
        isResizingRef.current = false
      }, 0)
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
            preferredSize={isCollapsed ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE}
            snap
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

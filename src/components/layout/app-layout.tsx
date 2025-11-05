import { useEffect, useRef } from "react"
import { Allotment, type AllotmentHandle } from "allotment"
import "allotment/dist/style.css"

import RequestWorkspace from "@/components/request/request-workspace"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

const COLLAPSED_SIZE = 50
const MIN_EXPANDED_SIZE = 250

export default function AppLayout() {
  const {
    actions: { setSplitviewApi, setCollapsed },
    isCollapsed,
  } = useSidebar()
  const activeTabId = useActiveTabId()
  const splitviewRef = useRef<AllotmentHandle | null>(null)
  const lastSizeRef = useRef<number>(COLLAPSED_SIZE)
  const prevCollapsedRef = useRef<boolean>(isCollapsed)

  // Handle ref setup
  const handleSplitviewRef = (ref: AllotmentHandle | null) => {
    splitviewRef.current = ref
    setSplitviewApi(ref)
  }

  // Apply size changes when isCollapsed changes
  useEffect(() => {
    // Only trigger on actual changes, not initial mount
    if (prevCollapsedRef.current !== isCollapsed && splitviewRef.current) {
      const targetSize = isCollapsed ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE
      splitviewRef.current.resize([targetSize])
    }
    prevCollapsedRef.current = isCollapsed
  }, [isCollapsed])

  // Track size changes and update collapsed state
  // DO NOT call resize() here - that creates infinite loop
  const handleResize = (sizes: number[]) => {
    const sidebarSize = sizes[0]
    lastSizeRef.current = sidebarSize

    // Update collapsed state based on current size
    // Simple rule: below min expanded size = collapsed
    if (sidebarSize < MIN_EXPANDED_SIZE) {
      setCollapsed(true)
    } else {
      setCollapsed(false)
    }
  }

  // When user releases the drag, snap to appropriate size
  const handleDragEnd = () => {
    const currentSize = lastSizeRef.current

    if (currentSize > COLLAPSED_SIZE && currentSize < MIN_EXPANDED_SIZE) {
      // In the "snap zone" - decide which way to snap
      const midpoint = (COLLAPSED_SIZE + MIN_EXPANDED_SIZE) / 2
      const targetSize = currentSize < midpoint ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE

      if (splitviewRef.current) {
        splitviewRef.current.resize([targetSize])
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
          onDragEnd={handleDragEnd}
        >
          <Allotment.Pane
            minSize={COLLAPSED_SIZE}
            preferredSize={isCollapsed ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE}
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

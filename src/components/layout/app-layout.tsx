import { useEffect, useRef, useState } from "react"
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
    actions: { setCollapsed },
    isCollapsed,
  } = useSidebar()
  const activeTabId = useActiveTabId()
  const allotmentRef = useRef<AllotmentHandle | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Track container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // When isCollapsed changes, resize both panes
  useEffect(() => {
    if (allotmentRef.current && containerWidth > 0) {
      const sidebarSize = isCollapsed ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE
      const mainContentSize = containerWidth - sidebarSize
      allotmentRef.current.resize([sidebarSize, mainContentSize])
    }
  }, [isCollapsed, containerWidth])

  // Track size changes from user dragging
  const handleResize = (sizes: number[]) => {
    const sidebarSize = sizes[0]

    // Update collapsed state based on current size
    if (sidebarSize < MIN_EXPANDED_SIZE) {
      if (!isCollapsed) {
        setCollapsed(true)
      }
    } else {
      if (isCollapsed) {
        setCollapsed(false)
      }
    }
  }

  // When user releases drag, snap to appropriate size
  const handleDragEnd = (sizes: number[]) => {
    const sidebarSize = sizes[0]

    if (sidebarSize > COLLAPSED_SIZE && sidebarSize < MIN_EXPANDED_SIZE) {
      // In the snap zone - decide which way to snap
      const midpoint = (COLLAPSED_SIZE + MIN_EXPANDED_SIZE) / 2
      const targetSize = sidebarSize < midpoint ? COLLAPSED_SIZE : MIN_EXPANDED_SIZE
      const mainContentSize = containerWidth - targetSize

      if (allotmentRef.current) {
        allotmentRef.current.resize([targetSize, mainContentSize])
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
      <UtilitySheetHost />
      <div className="flex h-full flex-1 overflow-hidden" ref={containerRef}>
        <Allotment
          ref={allotmentRef}
          vertical={false}
          proportionalLayout={false}
          onChange={handleResize}
          onDragEnd={handleDragEnd}
        >
          <Allotment.Pane minSize={COLLAPSED_SIZE} className="overflow-hidden">
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

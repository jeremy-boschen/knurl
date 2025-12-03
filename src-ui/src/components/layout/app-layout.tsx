import { useCallback, useEffect, useRef } from "react"
import { Panel, PanelGroup, ResizeHandle } from "@jeremy-boschen/react-adjustable-panels"

import RequestWorkspace from "@/components/request/request-workspace"
import { DialogHost } from "@/components/dialogs/dialog-host"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { cn } from "@/lib"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

export default function AppLayout() {
  const {
    state: { isCollapsed, panelGroupApi },
    actions: { setPanelGroupApi },
  } = useSidebar()
  console.log("[AppLayout] render, isCollapsed:", isCollapsed)
  const activeTabId = useActiveTabId()
  const initialCollapsedRef = useRef(isCollapsed)

  // Sync Panel state with Zustand when isCollapsed changes
  // This handles initial load and sidebar button clicks (not onCollapse callbacks)
  useEffect(() => {
    console.log("[AppLayout] useEffect: syncing Panel with isCollapsed:", isCollapsed)
    if (panelGroupApi) {
      if (isCollapsed) {
        console.log("[AppLayout] calling collapsePanel from useEffect")
        panelGroupApi.collapsePanel(0)
      } else {
        console.log("[AppLayout] calling expandPanel from useEffect")
        panelGroupApi.expandPanel(0)
      }
    }
  }, [isCollapsed, panelGroupApi])

  const handleCollapsed = (collapsed: boolean) => {
    console.log("[AppLayout] handleCollapsed called with:", collapsed, "current isCollapsed:", isCollapsed)
    // DO NOT update Zustand state here. The Panel's onCollapse fires synchronously
    // but Zustand updates are async. This creates a closure mismatch.
    // Instead, sync happens via the useEffect above when Zustand state changes.
    console.log("[AppLayout] Panel moved by library, onCollapse is not our source of truth")
  }

  const handlePanelGroupRef = useCallback(setPanelGroupApi, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
      <DialogHost />
      <UtilitySheetHost />
      <div className="flex h-full flex-1 overflow-hidden">
        <PanelGroup ref={handlePanelGroupRef} direction="horizontal" className="flex h-full w-full">
          <Panel
            key="sidebar"
            defaultSize="275px"
            minSize="275px"
            collapsedSize="50px"
            defaultCollapsed={initialCollapsedRef.current}
            onCollapse={handleCollapsed}
            className="overflow-hidden"
          >
            <Sidebar />
          </Panel>

          <ResizeHandle size={8} className={cn("z-50 flex items-center justify-center cursor-col-resize")} key="resize">
            <div className={cn("bg-transparent cursor-col-resize")} />
          </ResizeHandle>

          <Panel className="overflow-auto" key="workspace">
            <div className="flex h-full flex-col bg-background">
              <AppHeader className="bg-muted border-b mr-2" />
              <div className="flex-1 overflow-hidden">
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
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

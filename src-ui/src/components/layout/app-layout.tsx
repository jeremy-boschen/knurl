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
  const activeTabId = useActiveTabId()
  const initialCollapsedRef = useRef(isCollapsed)

  // Sync Panel state with Zustand when isCollapsed changes
  // This handles initial load and sidebar button clicks (not onCollapse callbacks)
  useEffect(() => {
    if (panelGroupApi) {
      isCollapsed ? panelGroupApi.collapsePanel(0) : panelGroupApi.expandPanel(0)
    }
  }, [isCollapsed, panelGroupApi])

  const handleCollapsed = () => {
    // onCollapse fires when user manually drags the panel divider to collapse/expand
    // We don't update state here - Zustand is the source of truth, updated via sidebar buttons
    // The useEffect above syncs the Panel with Zustand state
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

import { useCallback } from "react"

import { Panel, PanelGroup, ResizeHandle } from "@jeremy-boschen/react-adjustable-panels"

import { DialogHost } from "@/components/dialogs/dialog-host"
import RequestWorkspace from "@/components/request/request-workspace"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { cn } from "@/lib"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

export default function AppLayout() {
  const {
    state: { isCollapsed },
    actions: { setPanelGroupApi, collapseSidebar, expandSidebar },
  } = useSidebar()
  const activeTabId = useActiveTabId()

  const handleCollapsed = (collapsed: boolean) => {
    if (collapsed) {
      collapseSidebar()
    } else {
      expandSidebar()
    }
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
            defaultCollapsed={isCollapsed}
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

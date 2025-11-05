import { Allotment } from "allotment"
import "allotment/dist/style.css"

import RequestWorkspace from "@/components/request/request-workspace"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

export default function AppLayout() {
  const {
    actions: { setSplitviewApi, collapseSidebar, expandSidebar },
    isCollapsed,
  } = useSidebar()
  const activeTabId = useActiveTabId()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
      <UtilitySheetHost />
      <div className="flex h-full flex-1 overflow-hidden">
        <Allotment
          ref={setSplitviewApi}
          vertical={false}
          proportionalLayout={false}
          onChange={(sizes) => {
            // Track collapse/expand state based on sidebar size
            const sidebarSize = sizes[0]
            if (sidebarSize <= 60) {
              collapseSidebar()
            } else {
              expandSidebar()
            }
          }}
        >
          <Allotment.Pane
            minSize={50}
            maxSize={400}
            preferredSize={isCollapsed ? 50 : 250}
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

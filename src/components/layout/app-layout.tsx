import { Panel, PanelGroup, PanelResizeHandle } from "@/components/ui/resizable"
import RequestWorkspace from "@/components/request/request-workspace"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

export default function AppLayout() {
  const {
    actions: { setPanelApi, collapseSidebar, expandSidebar },
  } = useSidebar()
  const activeTabId = useActiveTabId()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
      <UtilitySheetHost />
      <div className="flex h-full flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="flex h-full w-full">
          <Panel
            ref={setPanelApi}
            minSize="20%"
            defaultSize="25%"
            collapsedSize="50px"
            className="overflow-hidden"
            collapsible
            onCollapse={collapseSidebar}
            onExpand={expandSidebar}
          >
            <Sidebar />
          </Panel>

          <PanelResizeHandle>
            <div className="z-10 flex w-[1px] h-full bg-muted" />
          </PanelResizeHandle>

          <Panel className="overflow-auto">
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
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

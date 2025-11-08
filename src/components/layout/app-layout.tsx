import { useEffect, useState } from "react"
import { Panel, PanelGroup } from "@jeremy-boschen/react-adjustable-panels"
import "@jeremy-boschen/react-adjustable-panels/style.css"

import { getCurrentWindow } from "@tauri-apps/api/window"

import RequestWorkspace from "@/components/request/request-workspace"
import { UtilitySheetHost } from "@/components/utility-sheets/utility-sheet-host"
import { useActiveTabId, useSidebar } from "@/state"
import { AppHeader } from "./app-header"
import Sidebar from "./sidebar"

export function useTauriWindowSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    const setup = async () => {
      const w = getCurrentWindow()
      // seed initial size
      const inner = await w.innerSize()
      setSize({ width: inner.width, height: inner.height })

      // listen for resizes
      unlisten = await w.onResized(({ payload }) => {
        // Reduce the number of setSize updates we make
        if (payload.width % 2 === 0) {
          setSize({ width: payload.width, height: payload.height })
        }
      })
    }
    void setup()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  return size
}

export default function AppLayout() {
  const {
    state: { isCollapsed },
    actions: { setPanelGroupApi, collapseSidebar, expandSidebar },
  } = useSidebar()
  const activeTabId = useActiveTabId()
  const windowSize = useTauriWindowSize()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
      <UtilitySheetHost />
      <div className="flex h-full flex-1 overflow-hidden">
        <PanelGroup
          ref={setPanelGroupApi}
          direction="horizontal"
          className="flex h-full w-full"
        >
          <Panel
            defaultSize="250px"
            minSize="200px"
            collapsedSize="0px"
            collapsed={isCollapsed}
            onCollapse={(collapsed) => {
              if (collapsed) {
                collapseSidebar()
              } else {
                expandSidebar()
              }
            }}
            className="overflow-hidden"
          >
            <Sidebar />
          </Panel>

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

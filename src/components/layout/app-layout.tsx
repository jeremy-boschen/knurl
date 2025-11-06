import {useEffect, useState} from "react"

import {Split, SplitStateProvider} from "a-multilayout-splitter"
import "a-multilayout-splitter/dist/style/index.css"

import {getCurrentWindow} from "@tauri-apps/api/window"

import RequestWorkspace from "@/components/request/request-workspace"
import {UtilitySheetHost} from "@/components/utility-sheets/utility-sheet-host"
import {cn} from "@/lib"
import {useActiveTabId, useSidebar} from "@/state"
import {AppHeader} from "./app-header"
import Sidebar from "./sidebar"

export function useTauriWindowSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    const setup = async () => {
      const w = getCurrentWindow()
      // seed initial size
      const inner = await w.innerSize()
      setSize({width: inner.width, height: inner.height})

      // listen for resizes
      unlisten = await w.onResized(({payload}) => {
        // Reduce the number of setSize updates we make
        if (payload.width % 2 === 0) {
          setSize({width: payload.width, height: payload.height})
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
    state: {isCollapsed},
    actions: {collapseSidebar, expandSidebar},
  } = useSidebar()
  const activeTabId = useActiveTabId()

  return (
    <SplitStateProvider>
      <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
        <UtilitySheetHost/>
        <div className="flex h-full flex-1 overflow-hidden">
          {/* biome-ignore lint/correctness/useUniqueElementIds: Split library requires static ID for instance management */}
          <Split
            id="app-layout"
            mode="horizontal"
            initialSizes={["25%", "75%"]}
            minSizes={[20, 0]}
            collapsed={[isCollapsed]}
            lineBar={true}
            onLayoutChange={(sectionNumber, _paneId, reason, _direction) => {
              if (sectionNumber === 0) {
                if (reason === "close") {
                  collapseSidebar()
                } else if (reason === "open") {
                  expandSidebar()
                }
              }
            }}
            renderBar={(props, _position) => (
              <div {...props} className={cn(props.className, "z-10 flex w-[1px] h-full bg-muted")}/>
            )}
          >
            <div className="overflow-hidden">
              <Sidebar/>
            </div>

            <div className="overflow-auto">
              <div className="flex h-full flex-col bg-background">
                <AppHeader className="bg-muted border-b"/>
                <div className="flex-1 overflow-hidden ">
                  {activeTabId ? (
                    <RequestWorkspace tabId={activeTabId}/>
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
            </div>
          </Split>
        </div>
      </div>
    </SplitStateProvider>
  )
}

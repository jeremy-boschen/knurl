import {useEffect, useRef, useState} from "react"

import {getSplitPaneInstance, Split, SplitStateProvider} from "a-multilayout-splitter"
import "a-multilayout-splitter/dist/style/index.css"

import {getCurrentWindow} from "@tauri-apps/api/window"

import RequestWorkspace from "@/components/request/request-workspace"
import {UtilitySheetHost} from "@/components/utility-sheets/utility-sheet-host"
import {cn} from "@/lib"
import {useActiveTabId, useSidebar} from "@/state"
import {AppHeader} from "./app-header"
import Sidebar from "./sidebar"

// Pixel-based sizing constants for sidebar
const MIN_SIDEBAR_SIZE_PX = 25

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
    actions: {updateSize, setContainerWidth},
  } = useSidebar()
  const activeTabId = useActiveTabId()
  const containerRef = useRef<HTMLDivElement>(null)
  const splitInstanceRef = useRef<HTMLElement | null>(null)
  const [containerWidth, setLocalContainerWidth] = useState(1400)

  // Track container width for percentage/pixel conversions
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => {
      const width = container.getBoundingClientRect().width
      setLocalContainerWidth(width)
      setContainerWidth(width)
    }

    // Initial width
    updateWidth()

    // Watch for resize - when window resizes, enforce minimum pixel size
    const resizeObserver = new ResizeObserver(() => {
      updateWidth()

      // After window resize, ensure sidebar doesn't violate pixel constraints
      if (splitInstanceRef.current) {
        const sections = splitInstanceRef.current.children
        if (sections && sections.length > 0) {
          const sidebarPane = sections[0] as HTMLDivElement
          if (sidebarPane) {
            const currentWidth = sidebarPane.getBoundingClientRect().width
            const newContainerWidth = container.getBoundingClientRect().width

            // If current pixel width is below minimum, set to minimum
            if (currentWidth < MIN_SIDEBAR_SIZE_PX) {
              const minPercent = (MIN_SIDEBAR_SIZE_PX / newContainerWidth) * 100
              sidebarPane.style.flexBasis = `${minPercent}%`
            }
          }
        }
      }
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [setContainerWidth])

  // Store split instance ref when component mounts
  useEffect(() => {
    const instances = getSplitPaneInstance()
    if (instances?.["app-layout"]) {
      splitInstanceRef.current = instances["app-layout"] as HTMLElement
    }
  }, [])

  // Helper to enforce pixel-based minimum size
  const enforceMinimumSize = (sizePercent: number, containerWidth: number): number => {
    const sizePx = (sizePercent / 100) * containerWidth
    if (sizePx < MIN_SIDEBAR_SIZE_PX) {
      return (MIN_SIDEBAR_SIZE_PX / containerWidth) * 100
    }
    return sizePercent
  }

  return (
    <SplitStateProvider>
      <div className="flex h-screen flex-col bg-background text-foreground" data-test-id="app-layout">
        <UtilitySheetHost/>
        <div ref={containerRef} className="flex h-full flex-1 overflow-hidden">
          {/* biome-ignore lint/correctness/useUniqueElementIds: Split library requires static ID for instance management */}
          <Split
            id="app-layout"
            mode="horizontal"
            initialSizes={["300px", "auto"]}
            minSizes={[0, 0]}
            collapsed={[false]}
            lineBar={false}
            onDragging={(preSize, _nextSize, paneNumber) => {
              // Update sidebar size in real-time during drag
              if (paneNumber === 0) {
                const sizePx = (preSize / 100) * containerWidth
                const enforcedSize = enforceMinimumSize(preSize, containerWidth)

                // If we need to enforce minimum, set it directly
                if (enforcedSize !== preSize && splitInstanceRef.current) {
                  const sections = splitInstanceRef.current.children
                  if (sections && sections.length > 0) {
                    const sidebarPane = sections[0] as HTMLDivElement
                    if (sidebarPane) {
                      sidebarPane.style.flexBasis = `${enforcedSize}%`
                    }
                  }
                }

                console.log(`[AppLayout] onDragging: ${preSize.toFixed(1)}% (${sizePx.toFixed(0)}px) → enforced: ${enforcedSize.toFixed(1)}%`)
                updateSize(enforcedSize, containerWidth)
              }
            }}
            onDragEnd={(preSize, _nextSize, paneNumber) => {
              // Ensure final size is recorded with minimum enforced
              if (paneNumber === 0) {
                const sizePx = (preSize / 100) * containerWidth
                const enforcedSize = enforceMinimumSize(preSize, containerWidth)

                // Set the enforced size
                if (enforcedSize !== preSize && splitInstanceRef.current) {
                  const sections = splitInstanceRef.current.children
                  if (sections && sections.length > 0) {
                    const sidebarPane = sections[0] as HTMLDivElement
                    if (sidebarPane) {
                      sidebarPane.style.flexBasis = `${enforcedSize}%`
                    }
                  }
                }

                console.log(`[AppLayout] onDragEnd: ${preSize.toFixed(1)}% (${sizePx.toFixed(0)}px) → enforced: ${enforcedSize.toFixed(1)}%`)
                updateSize(enforcedSize, containerWidth)
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

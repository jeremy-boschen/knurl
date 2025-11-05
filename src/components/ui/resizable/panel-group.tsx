import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PanelGroupContext } from "./panel-group-context"
import type { PanelData, PanelGroupProps, PanelSize } from "./types"
import { getElementSize, parseSize, sizeToPercentage } from "./utils"

export function PanelGroup({ direction, className, style, children, onLayout }: PanelGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [panels, setPanels] = useState<Map<string, PanelData>>(new Map())
  const [panelSizes, setPanelSizes] = useState<Map<string, number>>(new Map())
  const [containerSize, setContainerSize] = useState(0)

  // Track container size with ResizeObserver
  useEffect(() => {
    const element = groupRef.current
    if (!element) {
      return
    }

    const updateSize = () => {
      const size = getElementSize(element, direction)
      setContainerSize(size)
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [direction])

  // Register a panel
  const registerPanel = useCallback(
    (panel: PanelData) => {
      setPanels((prev) => {
        const next = new Map(prev)
        next.set(panel.id, panel)
        return next
      })

      // Initialize size if defaultSize is provided
      if (panel.constraints.defaultSize !== undefined) {
        const parsed = parseSize(panel.constraints.defaultSize)
        if (parsed && containerSize > 0) {
          const percentage = sizeToPercentage(parsed, containerSize)
          setPanelSizes((prev) => {
            const next = new Map(prev)
            next.set(panel.id, percentage)
            return next
          })
        }
      }
    },
    [containerSize],
  )

  // Unregister a panel
  const unregisterPanel = useCallback((id: string) => {
    setPanels((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setPanelSizes((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Get current size of a panel
  const getPanelSize = useCallback(
    (id: string): number => {
      return panelSizes.get(id) ?? 0
    },
    [panelSizes],
  )

  // Resize a panel to a specific size
  const resizePanel = useCallback(
    (id: string, size: PanelSize) => {
      if (containerSize === 0) {
        return
      }

      const panel = panels.get(id)
      if (!panel) {
        return
      }

      const parsed = parseSize(size)
      if (!parsed) {
        return
      }

      let targetPercentage = sizeToPercentage(parsed, containerSize)

      // Apply constraints
      if (panel.constraints.minSize) {
        const min = parseSize(panel.constraints.minSize)
        if (min) {
          const minPercentage = sizeToPercentage(min, containerSize)
          targetPercentage = Math.max(targetPercentage, minPercentage)
        }
      }

      if (panel.constraints.maxSize) {
        const max = parseSize(panel.constraints.maxSize)
        if (max) {
          const maxPercentage = sizeToPercentage(max, containerSize)
          targetPercentage = Math.min(targetPercentage, maxPercentage)
        }
      }

      setPanelSizes((prev) => {
        const next = new Map(prev)
        next.set(id, targetPercentage)
        return next
      })

      panel.callbacks.onResize?.(targetPercentage)
    },
    [containerSize, panels],
  )

  // Collapse a panel
  const collapsePanel = useCallback(
    (id: string) => {
      const panel = panels.get(id)
      if (!panel || !panel.constraints.collapsible) {
        return
      }

      const collapsedSize = panel.constraints.collapsedSize ?? 0
      resizePanel(id, collapsedSize)
      panel.callbacks.onCollapse?.()
    },
    [panels, resizePanel],
  )

  // Expand a panel
  const expandPanel = useCallback(
    (id: string) => {
      const panel = panels.get(id)
      if (!panel) {
        return
      }

      const defaultSize = panel.constraints.defaultSize ?? 50
      resizePanel(id, defaultSize)
      panel.callbacks.onExpand?.()
    },
    [panels, resizePanel],
  )

  // Start resize operation
  const startResize = useCallback((handleIndex: number) => {
    // This will be called by ResizeHandle
    // For now, we'll implement the basic structure
    console.log("Start resize", handleIndex)
  }, [])

  // Notify parent of layout changes
  useEffect(() => {
    if (onLayout && panelSizes.size > 0) {
      const sizes = Array.from(panels.keys()).map((id) => panelSizes.get(id) ?? 0)
      onLayout(sizes)
    }
  }, [onLayout, panels, panelSizes])

  const contextValue = useMemo(
    () => ({
      direction,
      registerPanel,
      unregisterPanel,
      startResize,
      getPanelSize,
      resizePanel,
      collapsePanel,
      expandPanel,
      groupElement: groupRef.current,
    }),
    [direction, registerPanel, unregisterPanel, startResize, getPanelSize, resizePanel, collapsePanel, expandPanel],
  )

  const flexDirection = direction === "horizontal" ? "row" : "column"

  return (
    <PanelGroupContext.Provider value={contextValue}>
      <div
        ref={groupRef}
        className={className}
        style={{
          ...style,
          display: "flex",
          flexDirection,
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </PanelGroupContext.Provider>
  )
}

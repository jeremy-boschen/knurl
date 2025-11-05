import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { usePanelGroupContext } from "./panel-group-context"
import type { PanelHandle, PanelProps } from "./types"
import { generateId } from "./utils"

export const Panel = forwardRef<PanelHandle, PanelProps>(function Panel(
  {
    id: idFromProps,
    defaultSize,
    minSize,
    maxSize,
    collapsible = false,
    collapsedSize,
    onCollapse,
    onExpand,
    onResize,
    className,
    style,
    children,
  },
  ref,
) {
  const panelId = useMemo(() => idFromProps ?? generateId("panel"), [idFromProps])
  const elementRef = useRef<HTMLDivElement>(null)
  const context = usePanelGroupContext()

  // Store callbacks in ref to avoid re-registration
  const callbacksRef = useRef({ onCollapse, onExpand, onResize })
  useEffect(() => {
    callbacksRef.current = { onCollapse, onExpand, onResize }
  }, [onCollapse, onExpand, onResize])

  // Register panel with group ONCE on mount
  useEffect(() => {
    const panelData = {
      id: panelId,
      constraints: {
        defaultSize,
        minSize,
        maxSize,
        collapsible,
        collapsedSize,
      },
      element: elementRef.current,
      callbacks: {
        onCollapse: () => callbacksRef.current.onCollapse?.(),
        onExpand: () => callbacksRef.current.onExpand?.(),
        onResize: (size: number) => callbacksRef.current.onResize?.(size),
      },
    }

    context.registerPanel(panelData)

    return () => {
      context.unregisterPanel(panelId)
    }
    // Only register once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId])

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      collapse: () => {
        context.collapsePanel(panelId)
      },
      expand: () => {
        context.expandPanel(panelId)
      },
      resize: (size) => {
        context.resizePanel(panelId, size)
      },
      getSize: () => {
        return context.getPanelSize(panelId)
      },
      isCollapsed: () => {
        const size = context.getPanelSize(panelId)
        // Consider collapsed if size is very small (< 1%)
        return size < 1
      },
    }),
    [panelId, context],
  )

  const currentSize = context.getPanelSize(panelId)
  const flexGrow = currentSize > 0 ? currentSize : 1
  const flexShrink = currentSize > 0 ? 0 : 1
  const flexBasis = currentSize > 0 ? `${currentSize}%` : "0%"

  return (
    <div
      ref={elementRef}
      data-panel-id={panelId}
      className={className}
      style={{
        ...style,
        flexGrow,
        flexShrink,
        flexBasis,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {children}
    </div>
  )
})

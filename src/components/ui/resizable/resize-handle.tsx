import { useCallback, useEffect, useRef, useState } from "react"
import { usePanelGroupContext } from "./panel-group-context"
import type { ResizeHandleProps } from "./types"
import { getElementSize, toPercentage } from "./utils"

export function PanelResizeHandle({ className, disabled = false, ...rest }: ResizeHandleProps) {
  const context = usePanelGroupContext()
  const handleRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const resizeStateRef = useRef<{
    panelBefore: { id: string; element: HTMLElement; startSize: number }
    panelAfter: { id: string; element: HTMLElement; startSize: number }
    startPos: number
    containerSize: number
  } | null>(null)

  const getAdjacentPanels = useCallback(() => {
    const handle = handleRef.current
    if (!handle || !context.groupElement) {
      return null
    }

    // Find panels before and after this handle
    let panelBefore: HTMLElement | null = null
    let panelAfter: HTMLElement | null = null

    let current = handle.previousElementSibling as HTMLElement | null
    while (current) {
      if (current.hasAttribute("data-panel-id")) {
        panelBefore = current
        break
      }
      current = current.previousElementSibling as HTMLElement | null
    }

    current = handle.nextElementSibling as HTMLElement | null
    while (current) {
      if (current.hasAttribute("data-panel-id")) {
        panelAfter = current
        break
      }
      current = current.nextElementSibling as HTMLElement | null
    }

    if (!panelBefore || !panelAfter) {
      return null
    }

    const beforeId = panelBefore.getAttribute("data-panel-id")
    const afterId = panelAfter.getAttribute("data-panel-id")

    if (!beforeId || !afterId) {
      return null
    }

    return {
      before: { id: beforeId, element: panelBefore },
      after: { id: afterId, element: panelAfter },
    }
  }, [context.groupElement])

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled) {
        return
      }

      const adjacent = getAdjacentPanels()
      if (!adjacent || !context.groupElement) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const handle = handleRef.current
      if (handle) {
        handle.setPointerCapture(e.pointerId)
      }

      const containerSize = getElementSize(context.groupElement, context.direction)
      const startPos = context.direction === "horizontal" ? e.clientX : e.clientY

      resizeStateRef.current = {
        panelBefore: {
          id: adjacent.before.id,
          element: adjacent.before.element,
          startSize: context.getPanelSize(adjacent.before.id),
        },
        panelAfter: {
          id: adjacent.after.id,
          element: adjacent.after.element,
          startSize: context.getPanelSize(adjacent.after.id),
        },
        startPos,
        containerSize,
      }

      setIsDragging(true)
    },
    [disabled, getAdjacentPanels, context],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !resizeStateRef.current) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const { panelBefore, panelAfter, startPos, containerSize } = resizeStateRef.current
      const currentPos = context.direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - startPos

      // Convert delta to percentage
      const deltaPercentage = toPercentage(delta, containerSize)

      const newBeforeSize = panelBefore.startSize + deltaPercentage
      const newAfterSize = panelAfter.startSize - deltaPercentage

      // Apply the resize (constraints handled in resizePanel)
      context.resizePanel(panelBefore.id, newBeforeSize)
      context.resizePanel(panelAfter.id, newAfterSize)
    },
    [isDragging, context],
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const handle = handleRef.current
      if (handle) {
        handle.releasePointerCapture(e.pointerId)
      }

      setIsDragging(false)
      resizeStateRef.current = null
    },
    [isDragging],
  )

  // Set up pointer event listeners
  useEffect(() => {
    const handle = handleRef.current
    if (!handle) {
      return
    }

    handle.addEventListener("pointerdown", handlePointerDown)

    return () => {
      handle.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [handlePointerDown])

  // Global pointer move/up listeners when dragging
  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handleMove = (e: PointerEvent) => handlePointerMove(e)
    const handleUp = (e: PointerEvent) => handlePointerUp(e)

    document.addEventListener("pointermove", handleMove)
    document.addEventListener("pointerup", handleUp)
    document.addEventListener("pointercancel", handleUp)

    return () => {
      document.removeEventListener("pointermove", handleMove)
      document.removeEventListener("pointerup", handleUp)
      document.removeEventListener("pointercancel", handleUp)
    }
  }, [isDragging, handlePointerMove, handlePointerUp])

  const cursorClass = context.direction === "horizontal" ? "cursor-col-resize" : "cursor-row-resize"
  const activeCursor = context.direction === "horizontal" ? "col-resize" : "row-resize"

  // Apply cursor to body when dragging
  useEffect(() => {
    if (isDragging) {
      const prevCursor = document.body.style.cursor
      const prevUserSelect = document.body.style.userSelect
      document.body.style.cursor = activeCursor
      document.body.style.userSelect = "none"

      return () => {
        document.body.style.cursor = prevCursor
        document.body.style.userSelect = prevUserSelect
      }
    }
  }, [isDragging, activeCursor])

  return (
    <div
      ref={handleRef}
      className={`${cursorClass} ${className ?? ""}`}
      data-resize-handle
      style={{
        flexShrink: 0,
        touchAction: "none",
        userSelect: "none",
      }}
      {...rest}
    />
  )
}

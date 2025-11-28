import type { DragOverEvent } from "@dnd-kit/core"

import type { DragPayload, DropPosition } from "../actions/action-types"

/**
 * Calculates the drop position (top/middle/bottom) based on pointer position
 * relative to the target element.
 */
export function calculateDropPosition(
  event: DragOverEvent,
  activeData: DragPayload | undefined,
  overData: DragPayload | undefined,
): DropPosition {
  const { over, active } = event

  if (!over) {
    return null
  }

  // Request or folder dropped on collection = always middle
  if ((activeData?.type === "request-item" || activeData?.type === "folder-item") && overData?.type === "collection") {
    return "middle"
  }

  // Request dropped on folder = always middle
  if (activeData?.type === "request-item" && overData?.type === "folder-item") {
    return "middle"
  }

  // Calculate position based on pointer Y coordinate
  const overRect = over.rect
  const activeRect = active.rect.current.translated
  const pointerY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top + overRect.height / 2
  const topBoundary = overRect.top + overRect.height / 3
  const bottomBoundary = overRect.top + (overRect.height * 2) / 3

  let position: DropPosition = null
  if (pointerY < topBoundary) {
    position = "top"
  } else if (pointerY > bottomBoundary) {
    position = "bottom"
  } else {
    position = "middle"
  }

  // Override: request dragged over folder or collection = always middle
  if (activeData?.type === "request-item" && (overData?.type === "folder-item" || overData?.type === "collection")) {
    position = "middle"
  }

  return position
}

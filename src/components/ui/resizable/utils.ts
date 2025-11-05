import type { PanelSize, SizeValue } from "./types"

/**
 * Parse a size value into a normalized format
 * @param size - Can be number (% by default), "50%", or "200px"
 * @returns Normalized size object with value and unit
 */
export function parseSize(size: PanelSize | undefined): SizeValue | undefined {
  if (size === undefined) {
    return undefined
  }

  // Number means percentage
  if (typeof size === "number") {
    return { value: size, unit: "%" }
  }

  // String - parse unit
  const trimmed = size.trim()

  if (trimmed.endsWith("px")) {
    const value = Number.parseFloat(trimmed)
    return Number.isNaN(value) ? undefined : { value, unit: "px" }
  }

  if (trimmed.endsWith("%")) {
    const value = Number.parseFloat(trimmed)
    return Number.isNaN(value) ? undefined : { value, unit: "%" }
  }

  // No unit specified, try to parse as number (assume %)
  const value = Number.parseFloat(trimmed)
  return Number.isNaN(value) ? undefined : { value, unit: "%" }
}

/**
 * Convert pixels to percentage based on container size
 */
export function toPercentage(pixels: number, containerSize: number): number {
  if (containerSize === 0) {
    return 0
  }
  return (pixels / containerSize) * 100
}

/**
 * Convert a SizeValue to percentage
 */
export function sizeToPercentage(size: SizeValue, containerSize: number): number {
  if (size.unit === "%") {
    return size.value
  }
  return toPercentage(size.value, containerSize)
}

/**
 * Get the size of an element in the specified direction
 */
export function getElementSize(element: HTMLElement, direction: "horizontal" | "vertical"): number {
  const rect = element.getBoundingClientRect()
  return direction === "horizontal" ? rect.width : rect.height
}

/**
 * Generate a unique ID
 */
let counter = 0
export function generateId(prefix = "panel"): string {
  return `${prefix}-${++counter}`
}

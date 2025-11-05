import type { CSSProperties, HTMLAttributes, ReactNode } from "react"

export type Direction = "horizontal" | "vertical"

export type SizeValue = {
  value: number
  unit: "px" | "%"
}

export type PanelSize = number | string

export type PanelConstraints = {
  defaultSize?: PanelSize
  minSize?: PanelSize
  maxSize?: PanelSize
  collapsible?: boolean
  collapsedSize?: PanelSize
}

export type PanelData = {
  id: string
  constraints: PanelConstraints
  element: HTMLElement | null
  callbacks: {
    onCollapse?: () => void
    onExpand?: () => void
    onResize?: (size: number) => void
  }
}

export type PanelHandle = {
  collapse: () => void
  expand: () => void
  resize: (size: PanelSize) => void
  getSize: () => number
  isCollapsed: () => boolean
}

export type PanelGroupProps = {
  direction: Direction
  className?: string
  style?: CSSProperties
  children: ReactNode
  onLayout?: (sizes: number[]) => void
}

export type PanelProps = {
  id?: string
  defaultSize?: PanelSize
  minSize?: PanelSize
  maxSize?: PanelSize
  collapsible?: boolean
  collapsedSize?: PanelSize
  onCollapse?: () => void
  onExpand?: () => void
  onResize?: (size: number) => void
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export type ResizeHandleProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
  disabled?: boolean
}

export type PanelGroupContextValue = {
  direction: Direction
  registerPanel: (panel: PanelData) => void
  unregisterPanel: (id: string) => void
  startResize: (handleIndex: number) => void
  getPanelSize: (id: string) => number
  resizePanel: (id: string, size: PanelSize) => void
  collapsePanel: (id: string) => void
  expandPanel: (id: string) => void
  groupElement: HTMLElement | null
}

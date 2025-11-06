import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  splitId: string
  currentSizePercent: number // Current percentage width
  lastExpandedSizePercent: number // Last percentage when expanded (for restoration)
  containerWidth: number // Container width in pixels for calculations
}

export interface SidebarApi {
  setCollapsed(collapsed: boolean): void

  collapseSidebar(): void

  expandSidebar(): void

  setSplitId(id: string): void

  updateSize(sizePercent: number, containerWidth: number): void

  setLastExpandedSize(sizePercent: number): void

  setContainerWidth(width: number): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

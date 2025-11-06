import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  splitId: string
  currentSize: number // Current percentage width
  lastExpandedSize: number // Last width when expanded (for restoration)
}

export interface SidebarApi {
  setCollapsed(collapsed: boolean): void

  collapseSidebar(): void

  expandSidebar(): void

  setSplitId(id: string): void

  updateSize(size: number): void

  setLastExpandedSize(size: number): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

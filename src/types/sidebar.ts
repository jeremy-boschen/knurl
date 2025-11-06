import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  splitId: string
}

export interface SidebarApi {
  setCollapsed(open: boolean): void

  collapseSidebar(): void

  expandSidebar(): void

  setSplitId(id: string): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

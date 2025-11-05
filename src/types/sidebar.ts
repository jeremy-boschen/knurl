import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState>

export interface SidebarApi {
  setCollapsed(open: boolean): void

  collapseSidebar(): void

  expandSidebar(): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

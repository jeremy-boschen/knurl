import type { AllotmentHandle } from "allotment"
import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  splitviewApi: AllotmentHandle | null
}

export interface SidebarApi {
  setCollapsed(open: boolean): void

  collapseSidebar(): void

  expandSidebar(): void

  setSplitviewApi(splitview: AllotmentHandle | null): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

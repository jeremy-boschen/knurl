import type { ImperativePanelHandle } from "react-resizable-panels"
import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  panelApi: ImperativePanelHandle | null
}

export interface SidebarApi {
  setCollapsed(open: boolean): void

  collapseSidebar(): void

  expandSidebar(): void

  setPanelApi(panel: ImperativePanelHandle | null): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

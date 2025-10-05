import type { ImperativePanelHandle } from "react-resizable-panels"
import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  panelApi: ImperativePanelHandle | null
}

export interface SidebarStateApi {
  setCollapsed(open: boolean): void
  collapseSidebar(): void
  expandSidebar(): void
  setPanelApi(panel: ImperativePanelHandle | null): void
}

export interface SidebarStateSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarStateApi
}

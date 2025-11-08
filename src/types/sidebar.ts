import type { PanelGroupHandle } from "@jeremy-boschen/react-adjustable-panels"
import { z } from "zod"

export const zSidebarState = z.object({
  isCollapsed: z.boolean().default(true),
})
export type SidebarState = z.infer<typeof zSidebarState> & {
  panelGroupApi: PanelGroupHandle | null
}

export interface SidebarApi {
  setCollapsed(open: boolean): void

  collapseSidebar(): void

  expandSidebar(): void

  setPanelGroupApi(panelGroup: PanelGroupHandle | null): void
}

export interface SidebarSlice {
  sidebarState: SidebarState
  sidebarApi: SidebarApi
}

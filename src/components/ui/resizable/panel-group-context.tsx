import { createContext, useContext } from "react"
import type { PanelGroupContextValue } from "./types"

export const PanelGroupContext = createContext<PanelGroupContextValue | null>(null)

export function usePanelGroupContext(): PanelGroupContextValue {
  const context = useContext(PanelGroupContext)
  if (!context) {
    throw new Error("Panel components must be used within a PanelGroup")
  }
  return context
}

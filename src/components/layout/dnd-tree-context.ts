import React from "react"
import type { DropPosition } from "@/components/layout/collection-tree"

type DndTreeContextType = {
  activeId: string | null
  dropIndicator: { id: string; position: DropPosition } | null
}

const DndTreeContext = React.createContext<DndTreeContextType | null>(null)

export const useDndTreeContext = () => {
  const context = React.useContext(DndTreeContext)
  if (!context) {
    throw new Error("useDndTreeContext must be used within a DndTreeProvider")
  }
  return context
}

export const useOptionalDndTreeContext = () => React.useContext(DndTreeContext)

export const DndTreeProvider = DndTreeContext.Provider

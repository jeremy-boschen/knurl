import React, { useState } from "react"

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useCollections } from "@/state"
import { CollectionItem } from "./collection-item"
import { CollectionTreeContextMenuContent } from "./collection-tree-context-menu"

export type ActiveMenuItem = {
  collectionId: string
  requestId?: string
  folderId?: string
  kind: "collection" | "folder" | "request"
  name: string
} | null

const TreeContextMenuProvider = React.createContext<{
  setActiveMenuItem: (item: ActiveMenuItem) => void
} | null>(null)

export const useTreeContextMenu = () => {
  const context = React.useContext(TreeContextMenuProvider)
  if (!context) {
    throw new Error("useTreeContextMenu must be used within CollectionTree2")
  }
  return context
}

export function CollectionTree2() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const [activeMenuItem, setActiveMenuItem] = useState<ActiveMenuItem>(null)

  const handleContextMenu = React.useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // Walk up the tree to find the data attributes
    let target: HTMLElement | null = event.target as HTMLElement | null
    while (target && !target.dataset.kind) {
      target = target.parentElement
    }

    if (!target) {
      return
    }

    const collectionId = target.dataset.collectionId
    const requestId = target.dataset.requestId
    const folderId = target.dataset.folderId
    const kind = target.dataset.kind
    const name = target.dataset.name

    if (!collectionId || !kind) {
      return
    }

    setActiveMenuItem({
      collectionId,
      requestId,
      folderId,
      kind: kind as "collection" | "folder" | "request",
      name: name || "Unknown",
    })
  }, [])

  return (
    <TreeContextMenuProvider.Provider value={{ setActiveMenuItem }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="space-y-2" role="tree" onContextMenu={handleContextMenu}>
            {collectionsIndex.map((entry) => (
              <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
            ))}
          </div>
        </ContextMenuTrigger>
        {activeMenuItem && <CollectionTreeContextMenuContent activeMenuItem={activeMenuItem} />}
      </ContextMenu>
    </TreeContextMenuProvider.Provider>
  )
}

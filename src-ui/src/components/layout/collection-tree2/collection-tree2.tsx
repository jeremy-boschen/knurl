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

export function CollectionTree2() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const [activeMenuItem, setActiveMenuItem] = useState<ActiveMenuItem>(null)

  const handleContextMenu = React.useCallback((event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement | null
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="space-y-2" role="tree" onContextMenu={handleContextMenu}>
          {collectionsIndex.map((entry) => (
            <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
          ))}
        </div>
      </ContextMenuTrigger>
      {activeMenuItem && (
        <CollectionTreeContextMenuContent activeMenuItem={activeMenuItem} />
      )}
    </ContextMenu>
  )
}

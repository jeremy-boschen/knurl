import React, { useState } from "react"

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useCollections } from "@/state"
import { CollectionItem } from "./collection-item"
import { ContextMenuContentProvider } from "./context-menu"

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

  const handleContextMenuOpen = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
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

  const handleContextMenuClose = (open: boolean) => {
    if (!open) {
      setActiveMenuItem(null)
    }
  }

  return (
    <ContextMenu onOpenChange={handleContextMenuClose}>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen}>
        <div className="space-y-2" role="tree">
          {collectionsIndex.map((entry) => (
            <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
          ))}
        </div>
      </ContextMenuTrigger>
      {activeMenuItem && <ContextMenuContentProvider activeMenuItem={activeMenuItem} />}
    </ContextMenu>
  )
}

import type { MouseEvent, ReactNode } from "react"
import { useState } from "react"

import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

import { CollectionMenu } from "./context-menu/collection-menu"
import { FolderMenu } from "./context-menu/folder-menu"
import { RequestMenu } from "./context-menu/request-menu"
import type { ActiveMenuItem } from "./context-menu/types"

export type { ActiveMenuItem } from "./context-menu/types"

export type CollectionContextMenuProps = {
  children: ReactNode
}

export function CollectionContextMenu({ children }: CollectionContextMenuProps) {
  const [activeMenuItem, setActiveMenuItem] = useState<ActiveMenuItem>(null)

  const handleContextMenuOpen = (event: MouseEvent<HTMLDivElement>) => {
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

    if (!collectionId || !kind || !name) {
      return
    }

    switch (kind) {
      case "collection":
        setActiveMenuItem({ kind, collectionId, name })
        break
      case "folder":
        if (folderId) {
          setActiveMenuItem({ kind, collectionId, folderId, name })
        }
        break
      case "request":
        if (requestId) {
          setActiveMenuItem({ kind, collectionId, requestId, name })
        }
        break
    }
  }

  const handleContextMenuClose = (open: boolean) => {
    if (!open) {
      setActiveMenuItem(null)
    }
  }

  return (
    <ContextMenu onOpenChange={handleContextMenuClose}>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen}>
        {children}
      </ContextMenuTrigger>
      {activeMenuItem &&
        (() => {
          switch (activeMenuItem.kind) {
            case "collection":
              return <CollectionMenu item={activeMenuItem} />
            case "folder":
              return <FolderMenu item={activeMenuItem} />
            case "request":
              return <RequestMenu item={activeMenuItem} />
          }
        })()}
    </ContextMenu>
  )
}

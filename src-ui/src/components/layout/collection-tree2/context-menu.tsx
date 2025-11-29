// noinspection DuplicatedCode

import type { MouseEvent, ReactNode } from "react"
import { useState } from "react"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { CopyIcon, Edit2Icon, Trash2Icon } from "lucide-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { collectionsApi } from "@/state"
import { useDialogs } from "@/hooks/useDialogs"
import type { DeleteContext, RenameContext } from "./types"

export type ActiveMenuItem =
  | {
      kind: "collection"
      collectionId: string
      name: string
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
      name: string
    }
  | {
      kind: "request"
      collectionId: string
      requestId: string
      name: string
    }
  | null

export type CollectionContextMenuProps = {
  children: ReactNode
}

export function CollectionContextMenu({ children }: CollectionContextMenuProps) {
  const [activeMenuItem, setActiveMenuItem] = useState<ActiveMenuItem>(null)
  const dialogs = useDialogs()

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

  const openRenameDialog = () => {
    if (!activeMenuItem) {
      return
    }

    let context: RenameContext
    let kindName: string

    switch (activeMenuItem.kind) {
      case "request":
        context = {
          kind: "request",
          collectionId: activeMenuItem.collectionId,
          requestId: activeMenuItem.requestId,
        }
        kindName = "Request"
        break
      case "folder":
        context = {
          kind: "folder",
          collectionId: activeMenuItem.collectionId,
          folderId: activeMenuItem.folderId,
        }
        kindName = "Folder"
        break
      case "collection":
        context = { kind: "collection", collectionId: activeMenuItem.collectionId }
        kindName = "Collection"
        break
    }

    dialogs.showRenameDialog({
      title: `Rename ${kindName}`,
      description: (
        <>
          Rename the <span className="text-lg text-primary">{activeMenuItem.name}</span> {kindName.toLowerCase()}?
        </>
      ),
      context,
      name: activeMenuItem.name,
      onConfirm: (ctx, newName) => {
        if (ctx.kind === "request") {
          collectionsApi().updateRequest(ctx.collectionId, ctx.requestId, { name: newName })
        } else if (ctx.kind === "collection") {
          collectionsApi().updateCollection(ctx.collectionId, { name: newName })
        } else if (ctx.kind === "folder") {
          collectionsApi().renameFolder(ctx.collectionId, ctx.folderId, newName)
        }
      },
    })
  }

  const openDeleteDialog = () => {
    if (!activeMenuItem) {
      return
    }
    let context: DeleteContext
    let kindName: string

    switch (activeMenuItem.kind) {
      case "request":
        context = {
          kind: "request",
          collectionId: activeMenuItem.collectionId,
          requestId: activeMenuItem.requestId,
        }
        kindName = "Request"
        break
      case "folder":
        context = {
          kind: "folder",
          collectionId: activeMenuItem.collectionId,
          folderId: activeMenuItem.folderId,
        }
        kindName = "Folder"
        break
      case "collection":
        context = { kind: "collection", collectionId: activeMenuItem.collectionId }
        kindName = "Collection"
        break
    }

    dialogs.showDeleteDialog({
      title: `Delete ${kindName}`,
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{activeMenuItem.name}</span>{" "}
          {kindName.toLowerCase()}?
        </>
      ),
      context,
      onConfirm: (ctx) => {
        if (ctx.kind === "request") {
          collectionsApi().deleteRequest(ctx.collectionId, ctx.requestId)
        } else if (ctx.kind === "collection") {
          collectionsApi().removeCollection(ctx.collectionId)
        } else if (ctx.kind === "folder") {
          collectionsApi().deleteFolder(ctx.collectionId, ctx.folderId)
        }
      },
    })
  }

  return (
    <ContextMenu onOpenChange={handleContextMenuClose}>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen}>
        {children}
      </ContextMenuTrigger>
      {activeMenuItem && renderContextMenuContent(activeMenuItem, openRenameDialog, openDeleteDialog)}
    </ContextMenu>
  )
}

function renderContextMenuContent(
  activeMenuItem: NonNullable<ActiveMenuItem>,
  openRenameDialog: () => void,
  openDeleteDialog: () => void,
) {
  switch (activeMenuItem.kind) {
    case "request":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={openRenameDialog}>
            <Edit2Icon className="h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              try {
                collectionsApi().duplicateRequest(activeMenuItem.collectionId, activeMenuItem.requestId)
              } catch (error) {
                console.error(`Failed to duplicate request:${activeMenuItem.requestId}`, error)
              }
            }}
          >
            <CopyIcon className="h-4 w-4" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              try {
                const request = collectionsApi().getRequest(activeMenuItem.collectionId, activeMenuItem.requestId)
                if (request) {
                  void writeText(JSON.stringify(request, null, 2))
                }
              } catch (error) {
                console.error(`Failed to copy request:${activeMenuItem.requestId}`, error)
              }
            }}
          >
            <CopyIcon className="h-4 w-4" />
            Copy as JSON
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={openDeleteDialog} variant="destructive">
            <Trash2Icon className="h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )
    case "folder":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={openRenameDialog}>Rename Folder</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={openDeleteDialog} variant="destructive">
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      )
    case "collection":
      return (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={openRenameDialog}>Rename Collection</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={openDeleteDialog} variant="destructive">
            Delete Collection
          </ContextMenuItem>
        </ContextMenuContent>
      )
  }
}

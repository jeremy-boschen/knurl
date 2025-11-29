// noinspection DuplicatedCode

import type { MouseEvent, ReactNode } from "react"
import { useState } from "react"

import DeleteDialog from "@/components/shared/delete-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { RequestContextMenuContent } from "@/components/ui/knurl/request-context-menu"
import { collectionsApi } from "@/state"
import type { DeleteContext, DialogProps, RenameContext } from "./types"

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
  const [dialogProps, setDialogProps] = useState<DialogProps | null>(null)

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

  const handleRename = (newName: string, ctx: RenameContext) => {
    if (ctx.kind === "request") {
      collectionsApi().updateRequest(ctx.collectionId, ctx.requestId, { name: newName })
    } else if (ctx.kind === "collection") {
      collectionsApi().updateCollection(ctx.collectionId, { name: newName })
    } else if (ctx.kind === "folder") {
      collectionsApi().renameFolder(ctx.collectionId, ctx.folderId, newName)
    }
    setDialogProps(null)
  }

  const handleDelete = async (ctx: DeleteContext) => {
    if (ctx.kind === "request") {
      collectionsApi().deleteRequest(ctx.collectionId, ctx.requestId)
    } else if (ctx.kind === "collection") {
      collectionsApi().removeCollection(ctx.collectionId)
    } else if (ctx.kind === "folder") {
      collectionsApi().deleteFolder(ctx.collectionId, ctx.folderId)
    }
    setDialogProps(null)
  }

  const handleCancel = () => {
    setDialogProps(null)
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

    setDialogProps({
      action: "rename",
      name: activeMenuItem.name,
      title: `Rename ${kindName}`,
      description: (
        <>
          Rename the <span className="text-lg text-primary">{activeMenuItem.name}</span> {kindName.toLowerCase()}?
        </>
      ),
      context,
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

    setDialogProps({
      action: "delete",
      name: activeMenuItem.name,
      title: `Delete ${kindName}`,
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{activeMenuItem.name}</span>{" "}
          {kindName.toLowerCase()}?
        </>
      ),
      context,
    })
  }

  return (
    <>
      {dialogProps?.action === "rename" && (
        <RenameDialog
          open={true}
          title={dialogProps.title}
          description={dialogProps.description}
          name={dialogProps.name}
          context={dialogProps.context}
          onRename={handleRename}
          onCancel={handleCancel}
        />
      )}

      {dialogProps?.action === "delete" && (
        <DeleteDialog
          open={true}
          title={dialogProps.title}
          description={dialogProps.description}
          context={dialogProps.context}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      )}

      <ContextMenu onOpenChange={handleContextMenuClose}>
        <ContextMenuTrigger asChild onContextMenu={handleContextMenuOpen}>
          {children}
        </ContextMenuTrigger>
        {activeMenuItem && renderContextMenuContent(activeMenuItem, openRenameDialog, openDeleteDialog)}
      </ContextMenu>
    </>
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
        <RequestContextMenuContent
          collectionId={activeMenuItem.collectionId}
          requestId={activeMenuItem.requestId}
          requestName={activeMenuItem.name}
          onRename={openRenameDialog}
          onDelete={openDeleteDialog}
        />
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

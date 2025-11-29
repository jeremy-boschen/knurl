import React, { useState } from "react"

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import DeleteDialog from "@/components/shared/delete-dialog"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { collectionsApi, useCollections } from "@/state"
import { CollectionItem } from "./collection-item"
import { ContextMenuContentProvider, type ContextMenuAction } from "./context-menu"
import type { DeleteContext, DialogProps, RenameContext } from "./types"

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
  const [dialogProps, setDialogProps] = useState<DialogProps | null>(null)

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

  const handleMenuAction = (action: ContextMenuAction) => {
    const { actionId, collectionId, name } = action

    if (actionId === "rename") {
      // biome-ignore lint/style/noNonNullAssertion: folderId is present for folder kind
      const context: RenameContext =
        action.kind === "request"
          ? { kind: "request", collectionId, requestId: action.requestId }
          : action.kind === "folder"
            ? { kind: "folder", collectionId, folderId: action.folderId! }
            : { kind: "collection", collectionId }

      setDialogProps({
        action: "rename",
        name,
        title: `Rename ${action.kind === "request" ? "Request" : action.kind === "folder" ? "Folder" : "Collection"}`,
        description: (
          <>
            Rename the <span className="text-lg text-primary">{name}</span>{" "}
            {action.kind === "request" ? "request" : action.kind === "folder" ? "folder" : "collection"}?
          </>
        ),
        context,
      })
    } else if (actionId === "delete") {
      // biome-ignore lint/style/noNonNullAssertion: folderId is present for folder kind
      const context: DeleteContext =
        action.kind === "request"
          ? { kind: "request", collectionId, requestId: action.requestId }
          : action.kind === "folder"
            ? { kind: "folder", collectionId, folderId: action.folderId! }
            : { kind: "collection", collectionId }

      setDialogProps({
        action: "delete",
        name,
        title: `Delete ${action.kind === "request" ? "Request" : action.kind === "folder" ? "Folder" : "Collection"}`,
        description: (
          <>
            Are you sure you want to delete the <span className="text-lg text-primary">{name}</span>{" "}
            {action.kind === "request" ? "request" : action.kind === "folder" ? "folder" : "collection"}?
          </>
        ),
        context,
      })
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
          <div className="space-y-2" role="tree">
            {collectionsIndex.map((entry) => (
              <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
            ))}
          </div>
        </ContextMenuTrigger>
        {activeMenuItem && <ContextMenuContentProvider activeMenuItem={activeMenuItem} onAction={handleMenuAction} />}
      </ContextMenu>
    </>
  )
}

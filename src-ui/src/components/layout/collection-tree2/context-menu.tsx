import { useState } from "react"

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import DeleteDialog from "@/components/shared/delete-dialog"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { RequestContextMenuContent } from "@/components/ui/knurl/request-context-menu"
import { collectionsApi, useCollections } from "@/state"
import type { DeleteContext, DialogProps, RenameContext } from "./types"
import { CollectionItem } from "./collection-item"

export type ActiveMenuItem = {
  collectionId: string
  requestId?: string
  folderId?: string
  kind: "collection" | "folder" | "request"
  name: string
} | null

export function CollectionTreeContextMenu() {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const [activeMenuItem, setActiveMenuItem] = useState<ActiveMenuItem>(null)
  const [dialogProps, setDialogProps] = useState<DialogProps | null>(null)

  const handleContextMenuOpen = (event: React.MouseEvent<HTMLDivElement>) => {
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

  const openRenameDialog = (kind: "request" | "folder" | "collection", name: string) => {
    // biome-ignore lint/style/noNonNullAssertion: activeMenuItem is guaranteed by calling code
    const context: RenameContext =
      kind === "request"
        ? {
            kind: "request",
            collectionId: activeMenuItem!.collectionId,
            // biome-ignore lint/style/noNonNullAssertion: requestId is present for request kind
            requestId: activeMenuItem!.requestId!,
          }
        : kind === "folder"
          ? {
              kind: "folder",
              collectionId: activeMenuItem!.collectionId,
              // biome-ignore lint/style/noNonNullAssertion: folderId is present for folder kind
              folderId: activeMenuItem!.folderId!,
            }
          : { kind: "collection", collectionId: activeMenuItem!.collectionId }

    setDialogProps({
      action: "rename",
      name,
      title: `Rename ${kind === "request" ? "Request" : kind === "folder" ? "Folder" : "Collection"}`,
      description: (
        <>
          Rename the <span className="text-lg text-primary">{name}</span>{" "}
          {kind === "request" ? "request" : kind === "folder" ? "folder" : "collection"}?
        </>
      ),
      context,
    })
  }

  const openDeleteDialog = (kind: "request" | "folder" | "collection", name: string) => {
    // biome-ignore lint/style/noNonNullAssertion: activeMenuItem is guaranteed by calling code
    const context: DeleteContext =
      kind === "request"
        ? {
            kind: "request",
            collectionId: activeMenuItem!.collectionId,
            // biome-ignore lint/style/noNonNullAssertion: requestId is present for request kind
            requestId: activeMenuItem!.requestId!,
          }
        : kind === "folder"
          ? {
              kind: "folder",
              collectionId: activeMenuItem!.collectionId,
              // biome-ignore lint/style/noNonNullAssertion: folderId is present for folder kind
              folderId: activeMenuItem!.folderId!,
            }
          : { kind: "collection", collectionId: activeMenuItem!.collectionId }

    setDialogProps({
      action: "delete",
      name,
      title: `Delete ${kind === "request" ? "Request" : kind === "folder" ? "Folder" : "Collection"}`,
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{name}</span>{" "}
          {kind === "request" ? "request" : kind === "folder" ? "folder" : "collection"}?
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
          <div className="space-y-2" role="tree">
            {collectionsIndex.map((entry) => (
              <CollectionItem key={entry.id} collectionId={entry.id} collectionName={entry.name} />
            ))}
          </div>
        </ContextMenuTrigger>
        {activeMenuItem && renderContextMenuContent(activeMenuItem, openRenameDialog, openDeleteDialog)}
      </ContextMenu>
    </>
  )
}

function renderContextMenuContent(
  activeMenuItem: ActiveMenuItem,
  openRenameDialog: (kind: "request" | "folder" | "collection", name: string) => void,
  openDeleteDialog: (kind: "request" | "folder" | "collection", name: string) => void,
) {
  if (!activeMenuItem) {
    return null
  }

  if (activeMenuItem.kind === "request") {
    // biome-ignore lint/style/noNonNullAssertion: requestId is present for request kind
    const requestId = activeMenuItem.requestId!
    return (
      <RequestContextMenuContent
        collectionId={activeMenuItem.collectionId}
        requestId={requestId}
        requestName={activeMenuItem.name}
        onRename={() => openRenameDialog("request", activeMenuItem.name)}
        onDelete={() => openDeleteDialog("request", activeMenuItem.name)}
      />
    )
  } else if (activeMenuItem.kind === "folder") {
    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openRenameDialog("folder", activeMenuItem.name)}>Rename Folder</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openDeleteDialog("folder", activeMenuItem.name)} variant="destructive">
          Delete Folder
        </ContextMenuItem>
      </ContextMenuContent>
    )
  } else {
    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openRenameDialog("collection", activeMenuItem.name)}>
          Rename Collection
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openDeleteDialog("collection", activeMenuItem.name)} variant="destructive">
          Delete Collection
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }
}

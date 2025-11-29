import { useState } from "react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import DeleteDialog from "@/components/shared/delete-dialog"
import RenameDialog from "@/components/ui/knurl/rename-dialog"
import { RequestContextMenuContent } from "@/components/ui/knurl/request-context-menu"
import { collectionsApi } from "@/state"
import type { ActiveMenuItem } from "./collection-tree2"
import type { DeleteContext, DialogProps, RenameContext } from "./types"

type CollectionTreeContextMenuContentProps = {
  activeMenuItem: ActiveMenuItem
}

export function ContextMenuContentProvider({ activeMenuItem }: CollectionTreeContextMenuContentProps) {
  const [dialogProps, setDialogProps] = useState<DialogProps | null>(null)

  if (!activeMenuItem) {
    return null
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
    const context: RenameContext =
      kind === "request"
        ? {
            kind: "request",
            collectionId: activeMenuItem.collectionId,
            // biome-ignore lint/style/noNonNullAssertion: requestId is present for request kind
            requestId: activeMenuItem.requestId!,
          }
        : kind === "folder"
          ? {
              kind: "folder",
              collectionId: activeMenuItem.collectionId,
              // biome-ignore lint/style/noNonNullAssertion: folderId is present for folder kind
              folderId: activeMenuItem.folderId!,
            }
          : { kind: "collection", collectionId: activeMenuItem.collectionId }

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
    const context: DeleteContext =
      kind === "request"
        ? {
            kind: "request",
            collectionId: activeMenuItem.collectionId,
            // biome-ignore lint/style/noNonNullAssertion: requestId is present for request kind
            requestId: activeMenuItem.requestId!,
          }
        : kind === "folder"
          ? {
              kind: "folder",
              collectionId: activeMenuItem.collectionId,
              // biome-ignore lint/style/noNonNullAssertion: folderId is present for folder kind
              folderId: activeMenuItem.folderId!,
            }
          : { kind: "collection", collectionId: activeMenuItem.collectionId }

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

      {activeMenuItem.kind === "request" ? (
        <RequestContextMenuContent
          collectionId={activeMenuItem.collectionId}
          // biome-ignore lint/style/noNonNullAssertion: requestId is present for request kind
          requestId={activeMenuItem.requestId!}
          requestName={activeMenuItem.name}
          onRename={() => openRenameDialog("request", activeMenuItem.name)}
          onDelete={() => openDeleteDialog("request", activeMenuItem.name)}
        />
      ) : activeMenuItem.kind === "folder" ? (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => openRenameDialog("folder", activeMenuItem.name)}>
            Rename Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => openDeleteDialog("folder", activeMenuItem.name)} variant="destructive">
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      ) : (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => openRenameDialog("collection", activeMenuItem.name)}>
            Rename Collection
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => openDeleteDialog("collection", activeMenuItem.name)} variant="destructive">
            Delete Collection
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </>
  )
}

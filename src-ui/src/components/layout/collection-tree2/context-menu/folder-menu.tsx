import { useCallback } from "react"

import { Edit2Icon, FolderPlusIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { collectionsApi, dialogsApi } from "@/state"

import type { ActiveMenuItem } from "./types"

interface FolderMenuProps {
  item: Extract<ActiveMenuItem, { kind: "folder" }>
}

export function FolderMenu({ item }: FolderMenuProps) {
  const handleRename = useCallback(() => {
    dialogsApi().showRenameDialog({
      title: "Rename Folder",
      description: (
        <>
          Rename the <span className="text-lg text-primary">{item.name}</span> folder?
        </>
      ),
      context: {
        kind: "folder",
        collectionId: item.collectionId,
        folderId: item.folderId,
      },
      name: item.name,
      onConfirm: (ctx, newName) => {
        collectionsApi().renameFolder(ctx.collectionId, ctx.folderId, newName)
      },
    })
  }, [item])

  const handleCreateRequest = useCallback(() => {
    dialogsApi().showCreateRequestDialog({
      collectionId: item.collectionId,
      parentId: item.folderId,
      onConfirm: (context) => {
        try {
          collectionsApi().createRequest(item.collectionId, {
            name: context.name,
            folderId: item.folderId,
          })
        } catch (error) {
          console.error("Failed to create request", error)
        }
      },
    })
  }, [item])

  const handleCreateFolder = useCallback(() => {
    dialogsApi().showCreateFolderDialog({
      collectionId: item.collectionId,
      parentId: item.folderId,
      onConfirm: (context) => {
        try {
          collectionsApi().createFolder(context.collectionId, item.folderId, context.name)
        } catch (error) {
          console.error("Failed to create folder", error)
        }
      },
    })
  }, [item])

  const handleDelete = useCallback(() => {
    dialogsApi().showDeleteDialog({
      title: "Delete Folder",
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{item.name}</span> folder?
        </>
      ),
      context: {
        kind: "folder",
        collectionId: item.collectionId,
        folderId: item.folderId,
      },
      onConfirm: (ctx) => {
        collectionsApi().deleteFolder(ctx.collectionId, ctx.folderId)
      },
    })
  }, [item])

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={handleCreateRequest}>
        <PlusIcon className="h-4 w-4" />
        New Request
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCreateFolder}>
        <FolderPlusIcon className="h-4 w-4" />
        New Folder
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleRename}>
        <Edit2Icon className="h-4 w-4" />
        Rename Folder
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDelete} variant="destructive">
        <Trash2Icon className="h-4 w-4" />
        Delete Folder
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

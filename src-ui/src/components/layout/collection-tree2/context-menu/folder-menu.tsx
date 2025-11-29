import { useCallback } from "react"

import { Edit2Icon, FolderPlusIcon, Trash2Icon } from "lucide-react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { collectionsApi } from "@/state"
import { useDialogs } from "@/hooks/useDialogs"

import type { ActiveMenuItem } from "./types"

interface FolderMenuProps {
  item: Extract<ActiveMenuItem, { kind: "folder" }>
}

export function FolderMenu({ item }: FolderMenuProps) {
  const dialogs = useDialogs()

  const handleRename = useCallback(() => {
    dialogs.showRenameDialog({
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
  }, [item, dialogs])

  const handleCreateFolder = useCallback(() => {
    dialogs.showCreateFolderDialog({
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
  }, [item, dialogs])

  const handleDelete = useCallback(() => {
    dialogs.showDeleteDialog({
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
  }, [item, dialogs])

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={handleRename}>
        <Edit2Icon className="h-4 w-4" />
        Rename Folder
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCreateFolder}>
        <FolderPlusIcon className="h-4 w-4" />
        New Folder
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDelete} variant="destructive">
        <Trash2Icon className="h-4 w-4" />
        Delete Folder
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

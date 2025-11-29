import { useCallback } from "react"

import { Edit2Icon, FolderPlusIcon, GlobeIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { collectionsApi, utilitySheetsApi } from "@/state"
import { useDialogs } from "@/hooks/useDialogs"
import { RootCollectionFolderId } from "@/types"

import type { ActiveMenuItem } from "./types"

interface CollectionMenuProps {
  item: Extract<ActiveMenuItem, { kind: "collection" }>
}

export function CollectionMenu({ item }: CollectionMenuProps) {
  const dialogs = useDialogs()

  // biome-ignore lint/correctness/useExhaustiveDependencies: dialogs is stable from Zustand
  const handleCreateRequest = useCallback(() => {
    dialogs.showCreateRequestDialog({
      collectionId: item.collectionId,
      parentId: RootCollectionFolderId,
      onConfirm: (context) => {
        try {
          collectionsApi().createRequest(item.collectionId, RootCollectionFolderId, context.name)
        } catch (error) {
          console.error("Failed to create request", error)
        }
      },
    })
  }, [item])

  // biome-ignore lint/correctness/useExhaustiveDependencies: dialogs is stable from Zustand
  const handleCreateFolder = useCallback(() => {
    dialogs.showCreateFolderDialog({
      collectionId: item.collectionId,
      parentId: RootCollectionFolderId,
      onConfirm: (context) => {
        try {
          collectionsApi().createFolder(item.collectionId, RootCollectionFolderId, context.name)
        } catch (error) {
          console.error("Failed to create folder", error)
        }
      },
    })
  }, [item])

  // biome-ignore lint/correctness/useExhaustiveDependencies: dialogs is stable from Zustand
  const handleRename = useCallback(() => {
    dialogs.showRenameDialog({
      title: "Rename Collection",
      description: (
        <>
          Rename the <span className="text-lg text-primary">{item.name}</span> collection?
        </>
      ),
      context: { kind: "collection", collectionId: item.collectionId },
      name: item.name,
      onConfirm: (ctx, newName) => {
        collectionsApi().updateCollection(ctx.collectionId, { name: newName })
      },
    })
  }, [item])

  const handleOpenSettings = useCallback(() => {
    try {
      utilitySheetsApi().openSheet({
        type: "collection-settings",
        context: { collectionId: item.collectionId },
      })
    } catch (error) {
      console.error("Failed to open collection settings", error)
    }
  }, [item])

  const handleOpenExport = useCallback(() => {
    try {
      utilitySheetsApi().openSheet({ type: "export", context: { collectionId: item.collectionId } })
    } catch (error) {
      console.error("Failed to open export sheet", error)
    }
  }, [item])

  // biome-ignore lint/correctness/useExhaustiveDependencies: dialogs is stable from Zustand
  const handleDelete = useCallback(() => {
    dialogs.showDeleteDialog({
      title: "Delete Collection",
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{item.name}</span> collection?
        </>
      ),
      context: { kind: "collection", collectionId: item.collectionId },
      onConfirm: (ctx) => {
        collectionsApi().removeCollection(ctx.collectionId)
      },
    })
  }, [item])

  return (
    <ContextMenuContent className="w-56">
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
        Rename Collection
      </ContextMenuItem>
      <ContextMenuItem onClick={handleOpenSettings}>
        <GlobeIcon className="h-4 w-4" />
        Manage Settings
      </ContextMenuItem>
      <ContextMenuItem onClick={handleOpenExport}>
        <UploadIcon className="h-4 w-4" />
        Export Collection
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDelete} variant="destructive">
        <Trash2Icon className="h-4 w-4" />
        Delete Collection
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

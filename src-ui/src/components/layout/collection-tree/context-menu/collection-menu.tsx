import { useCallback, useMemo } from "react"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  Edit2Icon,
  FolderPlusIcon,
  GlobeIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { collectionsApi, dialogsApi, utilitySheetsApi, useCollections } from "@/state"
import { RootCollectionFolderId } from "@/types"
import type { ActiveMenuItem } from "./types"

interface CollectionMenuProps {
  item: Extract<ActiveMenuItem, { kind: "collection" }>
}

export function CollectionMenu({ item }: CollectionMenuProps) {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const currentIndex = useMemo(
    () => collectionsIndex.findIndex((entry) => entry.id === item.collectionId),
    [collectionsIndex, item.collectionId],
  )

  const canMoveUp = useMemo(() => currentIndex > 0, [currentIndex])
  const canMoveDown = useMemo(
    () => currentIndex >= 0 && currentIndex < collectionsIndex.length - 1,
    [currentIndex, collectionsIndex.length],
  )

  const handleMoveUp = useCallback(() => {
    if (canMoveUp) {
      const newOrder = [...collectionsIndex]
      ;[newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]]
      collectionsApi().reorderCollections(newOrder.map((e) => e.id))
    }
  }, [canMoveUp, currentIndex, collectionsIndex])

  const handleMoveDown = useCallback(() => {
    if (canMoveDown) {
      const newOrder = [...collectionsIndex]
      ;[newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]]
      collectionsApi().reorderCollections(newOrder.map((e) => e.id))
    }
  }, [canMoveDown, currentIndex, collectionsIndex])

  const handleCreateRequest = useCallback(() => {
    dialogsApi().showCreateRequestDialog({
      collectionId: item.collectionId,
      parentId: RootCollectionFolderId,
      onConfirm: async (context) => {
        try {
          await collectionsApi().loadCollection(item.collectionId)

          collectionsApi().createRequest(item.collectionId, {
            name: context.name,
            folderId: RootCollectionFolderId,
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
      parentId: RootCollectionFolderId,
      onConfirm: async (context) => {
        try {
          await collectionsApi().loadCollection(item.collectionId)

          collectionsApi().createFolder(item.collectionId, RootCollectionFolderId, context.name)
        } catch (error) {
          console.error("Failed to create folder", error)
        }
      },
    })
  }, [item])

  const handleRename = useCallback(() => {
    dialogsApi().showRenameDialog({
      title: "Rename Collection",
      description: (
        <>
          Rename the <span className="text-lg text-primary">{item.name}</span> collection?
        </>
      ),
      context: { kind: "collection", collectionId: item.collectionId },
      name: item.name,
      onConfirm: async (ctx, newName) => {
        try {
          await collectionsApi().loadCollection(item.collectionId)

          collectionsApi().updateCollection(ctx.collectionId, { name: newName })
        } catch (error) {
          console.error("Failed to rename collection", error)
        }
      },
    })
  }, [item])

  const handleOpenSettings = useCallback(async () => {
    try {
      await collectionsApi().loadCollection(item.collectionId)

      utilitySheetsApi().openSheet({
        type: "collection-settings",
        context: { collectionId: item.collectionId },
      })
    } catch (error) {
      console.error("Failed to open collection settings", error)
    }
  }, [item])

  const handleOpenExport = useCallback(async () => {
    try {
      await collectionsApi().loadCollection(item.collectionId)

      utilitySheetsApi().openSheet({ type: "export", context: { collectionId: item.collectionId } })
    } catch (error) {
      console.error("Failed to open export sheet", error)
    }
  }, [item])

  const handleCopyAsJson = useCallback(async () => {
    try {
      await collectionsApi().loadCollection(item.collectionId)

      const collection = collectionsApi().getCollection(item.collectionId)
      if (collection) {
        const { requestIndex: _, ...collectionData } = collection
        void writeText(JSON.stringify(collectionData, null, 2))
      }
    } catch (error) {
      console.error(`Failed to copy collection:${item.collectionId}`, error)
    }
  }, [item])

  const handleDelete = useCallback(() => {
    dialogsApi().showDeleteDialog({
      title: "Delete Collection",
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{item.name}</span> collection?
        </>
      ),
      context: { kind: "collection", collectionId: item.collectionId },
      onConfirm: async (ctx) => {
        try {
          await collectionsApi().loadCollection(item.collectionId)

          collectionsApi().removeCollection(ctx.collectionId)
        } catch (error) {
          console.error("Failed to delete collection", error)
        }
      },
    })
  }, [item])

  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem
        onClick={handleCreateRequest}
        data-test-id={`collection-menu:item:request:new:${item.collectionId}`}
      >
        <PlusIcon className="h-4 w-4" />
        New Request
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleCreateFolder}
        data-test-id={`collection-menu:item:folder:new:${item.collectionId}`}
      >
        <FolderPlusIcon className="h-4 w-4" />
        New Folder
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleMoveUp}
        disabled={!canMoveUp}
        data-test-id={`collection-menu:item:move-up:${item.collectionId}`}
      >
        <ChevronUpIcon className="h-4 w-4" />
        Move Up
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleMoveDown}
        disabled={!canMoveDown}
        data-test-id={`collection-menu:item:move-down:${item.collectionId}`}
      >
        <ChevronDownIcon className="h-4 w-4" />
        Move Down
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleRename}
        data-test-id={`collection-menu:item:rename:${item.collectionId}`}
      >
        <Edit2Icon className="h-4 w-4" />
        Rename Collection
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleOpenSettings}
        data-test-id={`collection-menu:item:manage-settings:${item.collectionId}`}
      >
        <GlobeIcon className="h-4 w-4" />
        Manage Settings
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleOpenExport}
        data-test-id={`collection-menu:item:export:${item.collectionId}`}
      >
        <UploadIcon className="h-4 w-4" />
        Export Collection
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleCopyAsJson}
        data-test-id={`collection-menu:item:copy-json:${item.collectionId}`}
      >
        <CopyIcon className="h-4 w-4" />
        Copy as JSON
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleDelete}
        variant="destructive"
        data-test-id={`collection-menu:item:delete:${item.collectionId}`}
      >
        <Trash2Icon className="h-4 w-4" />
        Delete Collection
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

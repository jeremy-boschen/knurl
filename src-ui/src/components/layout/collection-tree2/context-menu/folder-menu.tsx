import { useCallback, useMemo } from "react"

import { Edit2Icon, FolderPlusIcon, FolderIcon, PlusIcon, Trash2Icon } from "lucide-react"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { collectionsApi, dialogsApi } from "@/state"
import { useCollection } from "@/state/application"
import { RootCollectionFolderId } from "@/types"

import type { ActiveMenuItem } from "./types"

interface FolderMenuProps {
  item: Extract<ActiveMenuItem, { kind: "folder" }>
}

type FolderPath = {
  folderId: string
  path: string
}

function buildFolderPaths(collection: ReturnType<typeof useCollection>["state"]["collection"]): FolderPath[] {
  const paths: FolderPath[] = []
  const folderMap = collection.folders

  // Helper to build path for a folder
  const buildPath = (folderId: string): string[] => {
    const folder = folderMap[folderId]
    if (!folder || folder.parentId === null) {
      return folder ? [folder.name] : []
    }
    const parentPath = buildPath(folder.parentId)
    return [...parentPath, folder.name]
  }

  // Recursively traverse folders in order using childFolderIds
  const traverseFolder = (parentId: string | null) => {
    const folder = parentId === null ? folderMap[Object.keys(folderMap)[0]] : folderMap[parentId]
    if (!folder) {
      return
    }

    const childIds =
      parentId === null
        ? Object.entries(folderMap)
            .filter(([, f]) => f.parentId === null)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([id]) => id)
        : folder.childFolderIds

    for (const childId of childIds) {
      const child = folderMap[childId]
      if (child && child.parentId !== null) {
        // Skip root, only include nested folders
        const pathParts = buildPath(childId)
        paths.push({
          folderId: childId,
          path: pathParts.join(" / "),
        })
      }
      // Recurse into children
      traverseFolder(childId)
    }
  }

  // Start traversal from root
  traverseFolder(null)
  return paths
}

function getCurrentFolderParent(
  collection: ReturnType<typeof useCollection>["state"]["collection"],
  folderId: string,
): string | null {
  const folder = collection.folders[folderId]
  return folder?.parentId ?? null
}

export function FolderMenu({ item }: FolderMenuProps) {
  const { state: collectionState } = useCollection(item.collectionId)

  const currentParentId = useMemo(
    () => getCurrentFolderParent(collectionState.collection, item.folderId),
    [collectionState.collection, item.folderId],
  )

  const folderPaths = useMemo(() => buildFolderPaths(collectionState.collection), [collectionState.collection])

  const availableFolders = useMemo(
    () => folderPaths.filter((folder) => folder.folderId !== item.folderId && folder.folderId !== currentParentId),
    [folderPaths, item.folderId, currentParentId],
  )

  const handleMoveToFolder = useCallback(
    (targetParentId: string | null) => {
      try {
        collectionsApi().moveFolder(item.collectionId, item.folderId, targetParentId)
      } catch (error) {
        console.error("Failed to move folder", error)
      }
    },
    [item.collectionId, item.folderId],
  )
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
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <FolderIcon className="h-4 w-4" />
          Move to folder
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          {currentParentId !== RootCollectionFolderId && (
            <ContextMenuItem onClick={() => handleMoveToFolder(RootCollectionFolderId)}>Root</ContextMenuItem>
          )}
          {availableFolders.map((folder) => (
            <ContextMenuItem key={folder.folderId} onClick={() => handleMoveToFolder(folder.folderId)}>
              {folder.path}
            </ContextMenuItem>
          ))}
          {availableFolders.length === 0 && currentParentId === RootCollectionFolderId && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No folders</div>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
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

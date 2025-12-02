import { useCallback, useMemo } from "react"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { CopyIcon, Edit2Icon, FolderIcon, Trash2Icon } from "lucide-react"

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

interface RequestMenuProps {
  item: Extract<ActiveMenuItem, { kind: "request" }>
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

function getCurrentRequestFolder(
  collection: ReturnType<typeof useCollection>["state"]["collection"],
  requestId: string,
): string | null {
  for (const [folderId, folder] of Object.entries(collection.folders)) {
    if (folder.requestIds.includes(requestId)) {
      return folderId
    }
  }
  return null
}

export function RequestMenu({ item }: RequestMenuProps) {
  const { state: collectionState } = useCollection(item.collectionId)

  const currentFolderId = useMemo(
    () => getCurrentRequestFolder(collectionState.collection, item.requestId),
    [collectionState.collection, item.requestId],
  )

  const folderPaths = useMemo(() => buildFolderPaths(collectionState.collection), [collectionState.collection])

  const availableFolders = useMemo(
    () => folderPaths.filter((folder) => folder.folderId !== currentFolderId),
    [folderPaths, currentFolderId],
  )

  const handleMoveToFolder = useCallback(
    (targetFolderId: string) => {
      try {
        collectionsApi().moveRequestToFolder(item.collectionId, item.requestId, targetFolderId)
      } catch (error) {
        console.error("Failed to move request", error)
      }
    },
    [item.collectionId, item.requestId],
  )

  const handleRename = useCallback(() => {
    dialogsApi().showRenameDialog({
      title: "Rename Request",
      description: (
        <>
          Rename the <span className="text-lg text-primary">{item.name}</span> request?
        </>
      ),
      context: {
        kind: "request",
        collectionId: item.collectionId,
        requestId: item.requestId,
      },
      name: item.name,
      onConfirm: (ctx, newName) => {
        collectionsApi().updateRequest(ctx.collectionId, ctx.requestId, { name: newName })
      },
    })
  }, [item])

  const handleDuplicate = useCallback(() => {
    try {
      collectionsApi().duplicateRequest(item.collectionId, item.requestId)
    } catch (error) {
      console.error(`Failed to duplicate request:${item.requestId}`, error)
    }
  }, [item])

  const handleCopyAsJson = useCallback(() => {
    try {
      const request = collectionsApi().getRequest(item.collectionId, item.requestId)
      if (request) {
        void writeText(JSON.stringify(request, null, 2))
      }
    } catch (error) {
      console.error(`Failed to copy request:${item.requestId}`, error)
    }
  }, [item])

  const handleDelete = useCallback(() => {
    dialogsApi().showDeleteDialog({
      title: "Delete Request",
      description: (
        <>
          Are you sure you want to delete the <span className="text-lg text-primary">{item.name}</span> request?
        </>
      ),
      context: {
        kind: "request",
        collectionId: item.collectionId,
        requestId: item.requestId,
      },
      onConfirm: (ctx) => {
        collectionsApi().deleteRequest(ctx.collectionId, ctx.requestId)
      },
    })
  }, [item])

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={handleRename}>
        <Edit2Icon className="h-4 w-4" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem onClick={handleDuplicate}>
        <CopyIcon className="h-4 w-4" />
        Duplicate
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <FolderIcon className="h-4 w-4" />
          Move to folder
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48 p-0 [&>*]:max-h-64 [&>*]:overflow-y-auto">
          <div className="p-1">
            {currentFolderId !== RootCollectionFolderId && (
              <ContextMenuItem onClick={() => handleMoveToFolder(RootCollectionFolderId)}>Root</ContextMenuItem>
            )}
            {availableFolders.map((folder) => (
              <ContextMenuItem key={folder.folderId} onClick={() => handleMoveToFolder(folder.folderId)}>
                {folder.path}
              </ContextMenuItem>
            ))}
            {availableFolders.length === 0 && currentFolderId === RootCollectionFolderId && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No folders</div>
            )}
          </div>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleCopyAsJson}>
        <CopyIcon className="h-4 w-4" />
        Copy as JSON
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDelete} variant="destructive">
        <Trash2Icon className="h-4 w-4" />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

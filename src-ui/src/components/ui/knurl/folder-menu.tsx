import { useCallback, useMemo } from "react"
import type React from "react"

import {
  ChevronDownIcon,
  ChevronUpIcon,
  Edit2Icon,
  FolderIcon,
  FolderPlusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { collectionsApi, useCollection } from "@/state"
import { RootCollectionFolderId } from "@/types"
import type { CollectionFolderNode } from "@/types"

export type FolderMenuActionId =
  | "request:new"
  | "folder:new"
  | "folder:rename"
  | "move-up"
  | "move-down"
  | "folder:move"
  | "delete"

export type FolderMenuPayload = {
  actionId: FolderMenuActionId
  kind: "folder"
  collectionId: string
  folderId: string
  name: string
  parentId?: string | null
  targetParentId?: string | null
}

export type FolderMenuContentProps = {
  collectionId: string
  folder: CollectionFolderNode
  onAction: (payload: FolderMenuPayload) => void
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

export function FolderMenuContent({ collectionId, folder, onAction }: FolderMenuContentProps) {
  const { state: collectionState } = useCollection(collectionId)

  const currentParentId = useMemo(
    () => getCurrentFolderParent(collectionState.collection, folder.id),
    [collectionState.collection, folder.id],
  )

  const folderPaths = useMemo(() => buildFolderPaths(collectionState.collection), [collectionState.collection])

  const availableFolders = useMemo(
    () => folderPaths.filter((f) => f.folderId !== folder.id && f.folderId !== currentParentId),
    [folderPaths, folder.id, currentParentId],
  )

  // Get sibling folders for move up/down
  const siblingFolderIds = useMemo(() => {
    const parentFolder =
      collectionState.collection.folders[currentParentId || Object.keys(collectionState.collection.folders)[0]]
    if (!parentFolder) {
      return []
    }
    return parentFolder.childFolderIds || []
  }, [collectionState.collection, currentParentId])

  const currentSiblingIndex = useMemo(() => siblingFolderIds.indexOf(folder.id), [siblingFolderIds, folder.id])
  const canMoveUp = useMemo(() => currentSiblingIndex > 0, [currentSiblingIndex])
  const canMoveDown = useMemo(
    () => currentSiblingIndex >= 0 && currentSiblingIndex < siblingFolderIds.length - 1,
    [currentSiblingIndex, siblingFolderIds.length],
  )

  const createHandlers = (payload: Omit<FolderMenuPayload, "kind">) => {
    let handled = false
    const invoke = (event?: Event) => {
      if (handled) {
        return
      }
      handled = true
      event?.preventDefault?.()
      onAction({
        ...payload,
        kind: "folder",
      })
    }
    return {
      onSelect: (event: unknown) => invoke(event as Event),
      onClick: (event: React.MouseEvent<HTMLElement>) => invoke(event.nativeEvent as unknown as Event),
    }
  }

  return (
    <DropdownMenuContent align="start" className="w-48" sideOffset={4}>
      <DropdownMenuItem
        className="cursor-pointer"
        {...createHandlers({
          actionId: "request:new",
          collectionId,
          folderId: folder.id,
          name: folder.name,
        })}
        data-action-id="request:new"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <PlusIcon className="mr-2 h-4 w-4" /> New Request
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        {...createHandlers({
          actionId: "folder:new",
          collectionId,
          folderId: folder.id,
          parentId: folder.id,
          name: folder.name,
        })}
        data-action-id="folder:new"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-parent-id={folder.id}
        data-name={folder.name}
      >
        <FolderPlusIcon className="mr-2 h-4 w-4" /> New Subfolder
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer"
        disabled={!canMoveUp}
        {...createHandlers({
          actionId: "move-up",
          collectionId,
          folderId: folder.id,
          name: folder.name,
        })}
        data-action-id="move-up"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <ChevronUpIcon className="mr-2 h-4 w-4" /> Move Up
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        disabled={!canMoveDown}
        {...createHandlers({
          actionId: "move-down",
          collectionId,
          folderId: folder.id,
          name: folder.name,
        })}
        data-action-id="move-down"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <ChevronDownIcon className="mr-2 h-4 w-4" /> Move Down
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FolderIcon className="mr-2 h-4 w-4" /> Move to folder
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="!max-h-96 !overflow-y-auto w-48 p-1">
          {currentParentId !== RootCollectionFolderId && (
            <DropdownMenuItem
              {...createHandlers({
                actionId: "folder:move",
                collectionId,
                folderId: folder.id,
                name: folder.name,
                targetParentId: RootCollectionFolderId,
              })}
            >
              Root
            </DropdownMenuItem>
          )}
          {availableFolders.map((f) => (
            <DropdownMenuItem
              key={f.folderId}
              {...createHandlers({
                actionId: "folder:move",
                collectionId,
                folderId: folder.id,
                name: folder.name,
                targetParentId: f.folderId,
              })}
            >
              {f.path}
            </DropdownMenuItem>
          ))}
          {availableFolders.length === 0 && currentParentId === RootCollectionFolderId && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No folders</div>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer"
        {...createHandlers({
          actionId: "folder:rename",
          collectionId,
          folderId: folder.id,
          name: folder.name,
        })}
        data-action-id="folder:rename"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <Edit2Icon className="mr-2 h-4 w-4" /> Rename
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer"
        variant="destructive"
        {...createHandlers({
          actionId: "delete",
          collectionId,
          folderId: folder.id,
          name: folder.name,
        })}
        data-action-id="delete"
        data-kind="folder"
        data-collection-id={collectionId}
        data-folder-id={folder.id}
        data-name={folder.name}
      >
        <Trash2Icon className="mr-2 h-4 w-4" /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

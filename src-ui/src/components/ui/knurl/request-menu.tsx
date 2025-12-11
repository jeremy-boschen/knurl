import { useMemo } from "react"
import type React from "react"

import { CopyIcon, Edit2Icon, FolderIcon, Trash2Icon } from "lucide-react"

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { useCollection } from "@/state"
import { RootCollectionFolderId } from "@/types"

export type RequestMenuMoveTarget = {
  id: string
  path: string
}

export type RequestMenuActionId = "rename" | "duplicate" | "request:move" | "copy-json" | "delete"

export type RequestMenuPayload = {
  actionId: RequestMenuActionId
  kind: "request"
  collectionId: string
  requestId: string
  name: string
  targetFolderId?: string
}

export type RequestMenuContentProps = {
  collectionId: string
  requestId: string
  requestName: string
  isScratch: boolean
  moveTargets?: RequestMenuMoveTarget[]
  onAction: (payload: RequestMenuPayload) => void
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

export function RequestMenuContent({
  collectionId,
  requestId,
  requestName,
  isScratch,
  onAction,
}: RequestMenuContentProps) {
  const { state: collectionState } = useCollection(collectionId)

  const currentFolderId = useMemo(
    () => getCurrentRequestFolder(collectionState.collection, requestId),
    [collectionState.collection, requestId],
  )

  const folderPaths = useMemo(() => buildFolderPaths(collectionState.collection), [collectionState.collection])

  const availableFolders = useMemo(
    () => folderPaths.filter((folder) => folder.folderId !== currentFolderId),
    [folderPaths, currentFolderId],
  )

  const createHandlers = (payload: Omit<RequestMenuPayload, "kind">) => {
    let handled = false
    const invoke = (event?: Event) => {
      if (handled) {
        return
      }
      handled = true
      event?.preventDefault?.()
      onAction({
        ...payload,
        kind: "request",
      })
    }
    return {
      onSelect: (event: unknown) => invoke(event as Event),
      onClick: (event: React.MouseEvent<HTMLElement>) => invoke(event.nativeEvent as unknown as Event),
    }
  }

  const hasMoveTargets = !isScratch && availableFolders.length > 0

  return (
    <DropdownMenuContent className="w-48" align="start" sideOffset={2}>
      {!isScratch && (
        <>
          <DropdownMenuItem
            className="cursor-pointer"
            {...createHandlers({
              actionId: "rename",
              collectionId,
              requestId,
              name: requestName,
            })}
            data-action-id="rename"
            data-kind="request"
            data-collection-id={collectionId}
            data-request-id={requestId}
            data-name={requestName}
          >
            <Edit2Icon className="mr-2 h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            {...createHandlers({
              actionId: "duplicate",
              collectionId,
              requestId,
              name: requestName,
            })}
            data-action-id="duplicate"
            data-kind="request"
            data-collection-id={collectionId}
            data-request-id={requestId}
            data-name={requestName}
          >
            <CopyIcon className="mr-2 h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          {hasMoveTargets && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <FolderIcon className="mr-2 h-4 w-4" /> Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="!max-h-96 !overflow-y-auto w-48 p-1">
                {currentFolderId !== RootCollectionFolderId && (
                  <DropdownMenuItem
                    {...createHandlers({
                      actionId: "request:move",
                      collectionId,
                      requestId,
                      name: requestName,
                      targetFolderId: RootCollectionFolderId,
                    })}
                    data-action-id="request:move"
                    data-target-folder-id={RootCollectionFolderId}
                  >
                    Root
                  </DropdownMenuItem>
                )}
                {availableFolders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.folderId}
                    {...createHandlers({
                      actionId: "request:move",
                      collectionId,
                      requestId,
                      name: requestName,
                      targetFolderId: folder.folderId,
                    })}
                    data-action-id="request:move"
                    data-target-folder-id={folder.folderId}
                  >
                    {folder.path}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem
        className="cursor-pointer"
        {...createHandlers({
          actionId: "copy-json",
          collectionId,
          requestId,
          name: requestName,
        })}
        data-action-id="copy-json"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={requestId}
        data-name={requestName}
      >
        <CopyIcon className="mr-2 h-4 w-4" /> Copy as JSON
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        className="cursor-pointer"
        {...createHandlers({
          actionId: "delete",
          collectionId,
          requestId,
          name: requestName,
        })}
        data-action-id="delete"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={requestId}
        data-name={requestName}
      >
        <Trash2Icon className="mr-2 h-4 w-4" /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

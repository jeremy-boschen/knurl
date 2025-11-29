import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { CopyIcon, Edit2Icon, FolderOpenIcon, Trash2Icon } from "lucide-react"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { collectionsApi, ScratchCollectionId } from "@/state"

export type RequestContextMenuContentProps = {
  collectionId: string
  requestId: string
  requestName: string
  moveTargets?: { id: string; path: string }[]
}

export function RequestContextMenuContent({
  collectionId,
  requestId,
  requestName,
  moveTargets = [],
}: RequestContextMenuContentProps) {
  const isScratch = collectionId === ScratchCollectionId
  const hasMoveTargets = !isScratch && moveTargets.length > 0

  const handleRename = () => {
    // TODO: Implement rename handler
  }

  const handleDuplicate = () => {
    try {
      collectionsApi().duplicateRequest(collectionId, requestId)
    } catch (error) {
      console.error(`Failed to duplicate collectionId:${collectionId} request:${requestId}`, error)
    }
  }

  const handleMove = (_targetFolderId: string) => {
    // TODO: Implement move handler
  }

  const handleCopy = () => {
    try {
      const request = collectionsApi().getRequest(collectionId, requestId)
      if (request) {
        void writeText(JSON.stringify(request, null, 2))
      }
    } catch (error) {
      console.error(`Failed to copy collectionId:${collectionId} request:${requestId}`, error)
    }
  }

  const handleDelete = () => {
    // TODO: Implement delete handler
  }

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem
        onClick={handleRename}
        data-action-id="rename"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={requestId}
        data-name={requestName}
      >
        <Edit2Icon className="h-4 w-4" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem
        onClick={handleDuplicate}
        data-action-id="duplicate"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={requestId}
        data-name={requestName}
      >
        <CopyIcon className="h-4 w-4" />
        Duplicate
      </ContextMenuItem>
      {hasMoveTargets && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderOpenIcon className="h-4 w-4" />
            Move to Folder
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {moveTargets.map((target) => (
              <ContextMenuItem
                key={target.id}
                onClick={() => handleMove(target.id)}
                data-action-id="request:move"
                data-kind="request"
                data-collection-id={collectionId}
                data-request-id={requestId}
                data-target-folder-id={target.id}
                data-name={requestName}
              >
                {target.path}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleCopy}
        data-action-id="copy"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={requestId}
        data-name={requestName}
      >
        <CopyIcon className="h-4 w-4" />
        Copy as JSON
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onClick={handleDelete}
        data-action-id="delete"
        data-kind="request"
        data-collection-id={collectionId}
        data-request-id={requestId}
        data-name={requestName}
      >
        <Trash2Icon className="h-4 w-4" />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

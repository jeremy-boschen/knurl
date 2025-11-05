import type React from "react"

import { CopyIcon, Edit2Icon, FolderOpenIcon, Trash2Icon } from "lucide-react"

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

export type RequestMenuMoveTarget = {
  id: string
  path: string
}

export type RequestMenuActionId = "rename" | "duplicate" | "request:move" | "copy" | "delete"

export type RequestMenuPayload = {
  actionId: RequestMenuActionId | "request:move"
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

export function RequestMenuContent({
  collectionId,
  requestId,
  requestName,
  isScratch,
  moveTargets = [],
  onAction,
}: RequestMenuContentProps) {
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

  const hasMoveTargets = !isScratch && moveTargets.length > 0

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
                <FolderOpenIcon className="mr-2 h-4 w-4" /> Move to Folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {moveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    className="cursor-pointer"
                    {...createHandlers({
                      actionId: "request:move",
                      collectionId,
                      requestId,
                      name: requestName,
                      targetFolderId: target.id,
                    })}
                    data-action-id="request:move"
                    data-kind="request"
                    data-collection-id={collectionId}
                    data-request-id={requestId}
                    data-target-folder-id={target.id}
                    data-name={requestName}
                  >
                    {target.path}
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
          actionId: "copy",
          collectionId,
          requestId,
          name: requestName,
        })}
        data-action-id="copy"
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

import { useCallback } from "react"

import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { CopyIcon, Edit2Icon, Trash2Icon } from "lucide-react"

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { collectionsApi, dialogsApi } from "@/state"

import type { ActiveMenuItem } from "./types"

interface RequestMenuProps {
  item: Extract<ActiveMenuItem, { kind: "request" }>
}

export function RequestMenu({ item }: RequestMenuProps) {
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

import type React from "react"

import { Edit2Icon, FolderPlusIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { CollectionFolderNode } from "@/types"

export type FolderMenuActionId = "request:new" | "folder:new" | "folder:rename" | "delete"

export type FolderMenuPayload = {
  actionId: FolderMenuActionId
  kind: "folder"
  collectionId: string
  folderId: string
  name: string
  parentId?: string | null
}

export type FolderMenuContentProps = {
  collectionId: string
  folder: CollectionFolderNode
  onAction: (payload: FolderMenuPayload) => void
}

export function FolderMenuContent({ collectionId, folder, onAction }: FolderMenuContentProps) {
  const createHandlers = (payload: Omit<FolderMenuPayload, "kind"> & Partial<Pick<FolderMenuPayload, "parentId">>) => {
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
    <DropdownMenuContent align="start" className="w-44" sideOffset={4}>
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

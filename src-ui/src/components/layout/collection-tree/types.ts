import type React from "react"

import type { FolderOption } from "@/lib/collections/folder-options"
import type { CollectionCache, RequestState } from "@/types"
import type { DeleteContext, RenameContext } from "@/types/dialogs"

export type ClearScratchContext = {
  collectionId: string
}

export type FolderCreateContext = {
  collectionId: string
  parentId: string | null
}

export type FolderDragData = {
  type: "folder-item"
  collectionId: string
  folderId: string
  parentId: string
  siblings: string[]
  childIds: string[]
}

export type CollectionDragData = {
  type: "collection"
  collectionId: string
}

export type RequestDragData = {
  type: "request-item"
  collectionId: string
  requestId: string
  folderId: string
  siblings: string[]
}

export type DragPayload = FolderDragData | CollectionDragData | RequestDragData
export type DropPosition = "top" | "bottom" | "middle" | null

export type DialogProps =
  | { action: "rename"; name: string; title: string; description: React.ReactNode; context: RenameContext }
  | { action: "delete"; name: string; title: string; description: React.ReactNode; context: DeleteContext }
  | {
      action: "clear-scratch"
      name: string
      title: string
      description: React.ReactNode
      context: ClearScratchContext
    }
  | { action: "export"; context: string }
  | {
      action: "folder-create"
      name: string
      title: string
      description: React.ReactNode
      context: FolderCreateContext
    }

export type ActionId =
  | "select"
  | "select:expand"
  | "rename"
  | "manage-settings"
  | "export"
  | "delete"
  | "clear-scratch"
  | "copy"
  | "duplicate"
  | "request:move"
  | "request:new"
  | "folder:new"
  | "folder:rename"
  | "folder:delete"

export type ActionPayload = {
  actionId: ActionId
  kind: string
  collectionId?: string
  requestId?: string
  folderId?: string
  parentId?: string | null
  targetFolderId?: string
  name?: string
}

export type CollectionsTreeProps = {
  searchTerm: string | undefined
}

export type CollectionRowProps = {
  collectionId: string
  collectionName: string
  open: boolean
  onRowSelect: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  onMenuAction: (payload: ActionPayload) => void
}

export type CollectionRowSearchableProps = {
  collectionId: string
  collectionName: string
  query: string
  onRowSelect: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  onMenuAction: (payload: ActionPayload) => void
}

export type RequestListProps = {
  collectionId: string
  folderId: string
  requests: RequestState[]
  folderOptions: FolderOption[]
  onRowSelect: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  onMenuAction: (payload: ActionPayload) => void
  filterQuery?: string
}

export type CollectionContentProps = {
  collectionId: string
  onRowSelect: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  onMenuAction: (payload: ActionPayload) => void
}

export type CollectionFolderBranchProps = {
  collection: CollectionCache
  collectionId: string
  folderId: string
  depth: number
  folderOptions: FolderOption[]
  onRowSelect: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  onMenuAction: (payload: ActionPayload) => void
}

export type RequestRowProps = {
  r: RequestState
  collectionId: string
  folderId: string
  onRowSelect: (event: Event | React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void
  onMenuAction: (payload: ActionPayload) => void
  dndDisabled?: boolean
  moveTargets: FolderOption[]
  siblings: string[]
  folderPath?: string
}

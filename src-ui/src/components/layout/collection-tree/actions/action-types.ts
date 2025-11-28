import type React from "react"

export type RenameContext =
  | {
      kind: "request"
      collectionId: string
      requestId: string
    }
  | {
      kind: "collection"
      collectionId: string
      requestId: never
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
    }

export type DeleteContext =
  | {
      kind: "request"
      collectionId: string
      requestId: string
    }
  | {
      kind: "collection"
      collectionId: string
      requestId: never
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
    }

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

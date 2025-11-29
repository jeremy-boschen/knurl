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
    }
  | {
      kind: "folder"
      collectionId: string
      folderId: string
    }

export type FolderCreateContext = {
  collectionId: string
  parentId: string
}

export type DialogProps =
  | { action: "rename"; name: string; title: string; description: React.ReactNode; context: RenameContext }
  | { action: "delete"; name: string; title: string; description: React.ReactNode; context: DeleteContext }
  | {
      action: "folder-create"
      name: string
      title: string
      description: React.ReactNode
      context: FolderCreateContext
    }

import type React from "react"

import type { DeleteContext, RenameContext } from "@/types/dialogs"

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

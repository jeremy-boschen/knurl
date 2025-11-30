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

export type ActiveDialog =
  | {
      kind: "delete"
      title: string
      description: React.ReactNode
      context: DeleteContext
      onConfirm: (context: DeleteContext) => void | Promise<void>
    }
  | {
      kind: "rename"
      title: string
      description: React.ReactNode
      context: RenameContext
      name: string
      onConfirm: (context: RenameContext, newName: string) => void | Promise<void>
    }
  | {
      kind: "create-collection"
      onConfirm: (context: { name: string }) => void | Promise<void>
    }
  | {
      kind: "create-folder"
      collectionId: string
      parentId: string
      onConfirm: (context: { name: string }) => void | Promise<void>
    }
  | {
      kind: "create-request"
      collectionId: string
      parentId?: string
      onConfirm: (context: { name: string }) => void | Promise<void>
    }
  | {
      kind: "save-request"
      onConfirm: (context: { collectionId: string; folderId?: string }) => void | Promise<void>
    }
  | null

export type DialogsState = {
  activeDialog: ActiveDialog
}

export interface DialogsApi {
  showDeleteDialog(props: {
    title: string
    description: React.ReactNode
    context: DeleteContext
    onConfirm: (context: DeleteContext) => void | Promise<void>
  }): void

  showRenameDialog(props: {
    title: string
    description: React.ReactNode
    context: RenameContext
    name: string
    onConfirm: (context: RenameContext, newName: string) => void | Promise<void>
  }): void

  showCreateCollectionDialog(props: { onConfirm: (context: { name: string }) => void | Promise<void> }): void

  showCreateFolderDialog(props: {
    collectionId: string
    parentId: string
    onConfirm: (context: { name: string }) => void | Promise<void>
  }): void

  showCreateRequestDialog(props: {
    collectionId: string
    parentId?: string
    onConfirm: (context: { name: string }) => void | Promise<void>
  }): void

  showSaveRequestDialog(props: {
    onConfirm: (context: { collectionId: string; folderId?: string }) => void | Promise<void>
  }): void

  closeDialog(): void
}

export interface DialogsSlice {
  dialogsState: DialogsState
  dialogsApi: DialogsApi
}

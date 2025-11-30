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
      context: { kind: "request"; collectionId: string; requestId: string }
      onConfirm: (context: { kind: "request"; collectionId: string; requestId: string }) => void | Promise<void>
    }
  | {
      kind: "delete"
      title: string
      description: React.ReactNode
      context: { kind: "collection"; collectionId: string }
      onConfirm: (context: { kind: "collection"; collectionId: string }) => void | Promise<void>
    }
  | {
      kind: "delete"
      title: string
      description: React.ReactNode
      context: { kind: "folder"; collectionId: string; folderId: string }
      onConfirm: (context: { kind: "folder"; collectionId: string; folderId: string }) => void | Promise<void>
    }
  | {
      kind: "rename"
      title: string
      description: React.ReactNode
      context: { kind: "request"; collectionId: string; requestId: string }
      name: string
      onConfirm: (
        context: { kind: "request"; collectionId: string; requestId: string },
        newName: string,
      ) => void | Promise<void>
    }
  | {
      kind: "rename"
      title: string
      description: React.ReactNode
      context: { kind: "collection"; collectionId: string }
      name: string
      onConfirm: (context: { kind: "collection"; collectionId: string }, newName: string) => void | Promise<void>
    }
  | {
      kind: "rename"
      title: string
      description: React.ReactNode
      context: { kind: "folder"; collectionId: string; folderId: string }
      name: string
      onConfirm: (
        context: { kind: "folder"; collectionId: string; folderId: string },
        newName: string,
      ) => void | Promise<void>
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
  showDeleteDialog<T extends DeleteContext>(props: {
    title: string
    description: React.ReactNode
    context: T
    onConfirm: (context: T) => void | Promise<void>
  }): void

  showRenameDialog<T extends RenameContext>(props: {
    title: string
    description: React.ReactNode
    context: T
    name: string
    onConfirm: (context: T, newName: string) => void | Promise<void>
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

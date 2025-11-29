import type { StateCreator } from "zustand"

import type {
  Application,
  DeleteContext,
  DialogProps,
  RenameContext,
} from "@/types"

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

  showCreateCollectionDialog(props: {
    onConfirm: (context: { name: string }) => void | Promise<void>
  }): void

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

export const dialogsSliceCreator: StateCreator<
  Application,
  [["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  DialogsSlice
> = (set) => {
  const dialogsApi: DialogsApi = {
    showDeleteDialog({ title, description, context, onConfirm }) {
      set((app) => {
        app.dialogsState.activeDialog = {
          kind: "delete",
          title,
          description,
          context,
          onConfirm,
        }
      })
    },

    showRenameDialog({ title, description, context, name, onConfirm }) {
      set((app) => {
        app.dialogsState.activeDialog = {
          kind: "rename",
          title,
          description,
          context,
          name,
          onConfirm,
        }
      })
    },

    showCreateCollectionDialog({ onConfirm }) {
      set((app) => {
        app.dialogsState.activeDialog = {
          kind: "create-collection",
          onConfirm,
        }
      })
    },

    showCreateFolderDialog({ collectionId, parentId, onConfirm }) {
      set((app) => {
        app.dialogsState.activeDialog = {
          kind: "create-folder",
          collectionId,
          parentId,
          onConfirm,
        }
      })
    },

    showCreateRequestDialog({ collectionId, parentId, onConfirm }) {
      set((app) => {
        app.dialogsState.activeDialog = {
          kind: "create-request",
          collectionId,
          parentId,
          onConfirm,
        }
      })
    },

    showSaveRequestDialog({ onConfirm }) {
      set((app) => {
        app.dialogsState.activeDialog = {
          kind: "save-request",
          onConfirm,
        }
      })
    },

    closeDialog() {
      set((app) => {
        app.dialogsState.activeDialog = null
      })
    },
  }

  return {
    dialogsState: {
      activeDialog: null,
    },
    dialogsApi,
  }
}

import type { StateCreator } from "zustand"

import type { Application } from "@/types"
import type { DialogsApi, DialogsSlice } from "@/types/dialogs"

export type { DialogsApi, DialogsSlice } from "@/types/dialogs"

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

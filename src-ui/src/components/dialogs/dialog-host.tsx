import { useApplication } from "@/state/application"
import { DeleteDialog } from "./delete-dialog"
import { RenameDialog } from "./rename-dialog"
import { CreateCollectionDialog } from "./create-collection-dialog"
import { CreateFolderDialog } from "./create-folder-dialog"
import { CreateRequestDialog } from "./create-request-dialog"
import { SaveRequestDialog } from "./save-request-dialog"

export function DialogHost() {
  const {
    state: { activeDialog },
    actions: { dialogsApi },
  } = useApplication((app) => ({
    state: { activeDialog: app.dialogsState.activeDialog },
    actions: { dialogsApi: app.dialogsApi },
  }))

  if (!activeDialog) {
    return null
  }

  switch (activeDialog.kind) {
    case "delete":
      return (
        <DeleteDialog
          open={true}
          title={activeDialog.title}
          description={activeDialog.description}
          context={activeDialog.context}
          onConfirm={activeDialog.onConfirm}
          onCancel={dialogsApi.closeDialog}
        />
      )

    case "rename":
      return (
        <RenameDialog
          open={true}
          title={activeDialog.title}
          description={activeDialog.description}
          name={activeDialog.name}
          context={activeDialog.context}
          onConfirm={activeDialog.onConfirm}
          onCancel={dialogsApi.closeDialog}
        />
      )

    case "create-collection":
      return <CreateCollectionDialog open={true} onConfirm={activeDialog.onConfirm} onCancel={dialogsApi.closeDialog} />

    case "create-folder":
      return <CreateFolderDialog open={true} onConfirm={activeDialog.onConfirm} onCancel={dialogsApi.closeDialog} />

    case "create-request":
      return <CreateRequestDialog open={true} onConfirm={activeDialog.onConfirm} onCancel={dialogsApi.closeDialog} />

    case "save-request":
      return <SaveRequestDialog open={true} onConfirm={activeDialog.onConfirm} onCancel={dialogsApi.closeDialog} />

    default:
      return null
  }
}

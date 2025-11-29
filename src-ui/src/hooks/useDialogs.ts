import { useApplication } from "@/state/application"
import type { DialogsApi } from "@/types"
import type { Application } from "@/state"

// Memoized selector to prevent unnecessary re-renders
const selectDialogsApi = (app: Application): DialogsApi => app.dialogsApi

export const useDialogs = (): DialogsApi => {
  return useApplication(selectDialogsApi)
}

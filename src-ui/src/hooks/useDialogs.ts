import { useApplication } from "@/state/application"
import type { DialogsApi } from "@/types"

export const useDialogs = (): DialogsApi => {
  return useApplication((app) => app.dialogsApi)
}

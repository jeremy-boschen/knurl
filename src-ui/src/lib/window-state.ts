import { getCurrentWindow } from "@tauri-apps/api/window"

import { applyWindowState } from "@/bindings/knurl"
import { getSyncLogger } from "@/lib/logger"
import { useApplication } from "@/state"

const logger = getSyncLogger("window-state")

const isTauri = () =>
  typeof window !== "undefined" && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export async function restoreMainWindowFromSettings() {
  if (!isTauri()) {
    return
  }

  const state = useApplication.getState().settingsState.windows?.main
  try {
    await applyWindowState("main", state)
  } catch (error) {
    logger.warn("failed to apply window state", { error })
    try {
      const win = await getCurrentWindow()
      await win.show()
    } catch {}
  }
}

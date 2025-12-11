/**
 * E2E Test Bridge
 *
 * This module provides a bridge between E2E tests and the Tauri application.
 * It exposes functions that the WebDriver cannot call directly (due to sandboxing)
 * but can be invoked from within the app's context.
 *
 * This is ONLY loaded during E2E tests, never in production.
 */

import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager"
import { getSyncLogger } from "@/lib/logger"

const logger = getSyncLogger("e2e-bridge")

/**
 * E2E bridge functions exposed to the window for test access
 */
export const e2eBridge = {
  /**
   * Write text to the system clipboard
   */
  async writeClipboard(text: string): Promise<void> {
    await writeText(text)
  },

  /**
   * Read text from the system clipboard
   */
  async readClipboard(): Promise<string> {
    return await readText()
  },

  /**
   * Prepare app for test reset by disabling auto-save and clearing transient state
   * This should be called before a page reload to ensure a clean slate
   */
  async prepareForReset(): Promise<void> {
    if (typeof window === "undefined") {
      return
    }

    // Access the Zustand store directly to disable auto-save
    try {
      const { useApplication } = await import("@/state")
      // Disable auto-save by setting interval to 0
      useApplication.getState().settingsState.requests.autoSave = 0
    } catch (err) {
      logger.warn("Failed to disable auto-save", { err })
    }
  },
}

// Expose to window for E2E tests
if (typeof window !== "undefined") {
  ;(window as any).__E2E_BRIDGE__ = e2eBridge

  // Add global keyboard handler for manual readiness checking during tests
  // Press 'M' to log a manual readiness marker with timestamp
  document.addEventListener("keydown", (event) => {
    if (event.key === "m" || event.key === "M") {
      const timestamp = new Date().toISOString()
      logger.info(`UI appears ready (manually marked) at ${timestamp}`)
    }
  })
}

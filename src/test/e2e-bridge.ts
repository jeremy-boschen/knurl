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
}

// Expose to window for E2E tests
if (typeof window !== "undefined") {
  ;(window as any).__E2E_BRIDGE__ = e2eBridge
}

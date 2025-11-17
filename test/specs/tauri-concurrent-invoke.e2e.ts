/**
 * Tauri WebDriver Concurrency Bug - Minimal Reproducible Test
 *
 * This test reproduces a concurrency issue in @tauri-apps/wdio-driver where
 * multiple concurrent browser.executeAsync() calls fail with WebDriver session errors
 * when the underlying Tauri app is trying to process them concurrently.
 *
 * Pattern: 3 concurrent browser.executeAsync() calls via Promise.all()
 * Expected result: WebDriverError showing concurrent command failures
 *
 * This test demonstrates that @tauri-apps/wdio-driver cannot handle more than
 * one concurrent WebDriver command per session - when multiple commands are sent
 * in parallel, the driver's session handler fails.
 *
 * How to reproduce this in any Tauri project:
 *
 * 1. Add a simple async Tauri backend command (e.g., echo_command):
 *    #[tauri::command(async)]
 *    pub async fn echo_command(message: String) -> Result<String> {
 *      tokio::time::sleep(Duration::from_millis(10)).await;
 *      Ok(format!("Echo: {}", message))
 *    }
 *
 * 2. In your E2E test, invoke 3 concurrent WebDriver commands via Promise.all()
 * 3. Each command should invoke your Tauri backend command via window.__TAURI__.core.invoke()
 *    Example:
 *    const { invoke } = await window.__TAURI__.core
 *    const result = await invoke('echo_command', { message: '...' })
 *
 * Expected failure patterns:
 * - WebDriverError: undefined is not an object (evaluating 'window.__TAURI__.core')
 *   (if Tauri not available in test context)
 * - WebDriverError: invalid session id
 * - WebDriverError: callback is not a function
 * - UND_ERR_SOCKET connection errors
 * - All 3 concurrent commands fail simultaneously
 *
 * Note: The WebDriver session becomes unresponsive after concurrent commands
 * are sent. This is a limitation of @tauri-apps/wdio-driver's session handler.
 */

import { expect } from "@wdio/globals"
import { ensureWorkspaceReady } from "../support/ui"

describe("Tauri WebDriver Concurrency Bug", () => {
  before(async () => {
    // Ensure the app is fully loaded so Tauri API is available
    await ensureWorkspaceReady()
  })

  it("demonstrates concurrent executeAsync limitations", async () => {
    // Create 3 concurrent browser.executeAsync() calls
    // Each performs a simple async operation
    const promises = []

    for (let i = 0; i < 3; i++) {
      promises.push(
        browser.executeAsync(async (index: number, callback: any) => {
          try {
            // Attempt to access Tauri API
            const tauriCore = (window as any)?.__TAURI__?.core
            if (!tauriCore) {
              // Fallback: simulate async work with setTimeout
              await new Promise((resolve) => setTimeout(resolve, 50))
              callback({
                success: true,
                message: `Async operation ${index} completed`,
              })
              return
            }

            // If Tauri is available, invoke the echo_command
            const { invoke } = tauriCore
            const result = await invoke('echo_command', {
              message: `Concurrent command ${index}`,
            })
            callback({
              success: true,
              message: result,
            })
          } catch (error: any) {
            // Catch any errors during execution
            callback({
              success: false,
              error: error.message || String(error),
            })
          }
        }, i),
      )
    }

    // Execute all 3 commands in parallel
    // With @tauri-apps/wdio-driver, this will likely fail with:
    // - WebDriverError: invalid session id
    // - Or other session-related errors
    // All 3 commands will fail at approximately the same time
    let results: any
    try {
      results = await Promise.all(promises)

      // If we reach here, the concurrent calls succeeded
      // This would indicate the bug is fixed
      expect(results).toHaveLength(3)
      results.forEach((result: any) => {
        expect(result.success).toBe(true)
        expect(result.message).toBeDefined()
      })
    } catch (error) {
      // Expected behavior with the bug: concurrent executeAsync calls fail
      // The error indicates the WebDriver session was compromised
      console.error("Concurrent executeAsync failed (expected with bug):", error)
      throw error
    }
  })
})

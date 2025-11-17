/**
 * Tauri Concurrent Invoke Bug - Generic Reproducible Test
 *
 * This test reproduces a concurrency issue in @tauri-apps/wdio-driver where
 * multiple concurrent Tauri command invocations (window.__TAURI__.invoke) sent
 * via WebDriver's executeAsync() fail with session errors.
 *
 * Pattern: 3 concurrent window.__TAURI__.invoke() calls via Promise.all()
 * Result: WebDriverError (invalid session id or socket error)
 *
 * This test is completely generic and works with any Tauri application.
 * It doesn't depend on app-specific UI or business logic.
 *
 * Expected: Test fails with WebDriver session error
 */

import { expect } from "@wdio/globals"

describe("Tauri Concurrent Invoke - Generic Reproducible Test", () => {
  it("handles concurrent window.__TAURI__.invoke calls", async () => {
    // Create 3 concurrent Tauri IPC invocations
    // Each calls a simple backend command via window.__TAURI__.invoke()
    const promises = []

    for (let i = 0; i < 3; i++) {
      promises.push(
        browser.executeAsync(
          async (callback, index) => {
            try {
              // Invoke a simple Tauri command concurrently
              // The "echo_command" is a generic command available on any Tauri app
              const result = await (window as any).__TAURI__.invoke("echo_command", {
                message: `Concurrent invoke ${index}`,
              })
              callback({
                success: true,
                result: result,
                index: index,
              })
            } catch (error) {
              callback({
                success: false,
                error: (error as Error).message,
                index: index,
              })
            }
          },
          i,
        ),
      )
    }

    // Send all 3 commands in parallel via WebDriver
    // This is where the concurrency bug manifests: invalid session id errors
    const results = await Promise.all(promises)

    // If we get here without session errors, the bug didn't occur (or was fixed)
    expect(results).toHaveLength(3)
    results.forEach((result: any) => {
      expect(result).toBeDefined()
      // Each result should indicate whether the command succeeded
      // (either success or error message is acceptable - we're testing if WebDriver survives)
    })
  })
})

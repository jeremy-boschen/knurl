/**
 * Tauri Driver Concurrency Bug - Generic Minimal Reproducible Test
 *
 * This test reproduces a concurrency issue where @tauri-apps/wdio-driver fails
 * when handling multiple concurrent WebDriver commands in a single session.
 *
 * Bug: Multiple concurrent executeAsync() calls via Promise.all() cause
 * WebDriverError: invalid session id or UND_ERR_SOCKET errors.
 *
 * This test is generic and works with any Tauri app - it doesn't depend on
 * app-specific UI or bridge APIs. It only uses standard WebDriver commands.
 *
 * Expected result: Test fails with session error during concurrent execution
 */

import { expect } from "@wdio/globals"

describe("Tauri Driver Concurrency Bug - Generic Test", () => {
  it("handles concurrent executeAsync calls", async () => {
    // Create 3 concurrent executeAsync() calls
    // These are standard WebDriver commands, not app-specific
    const promises = []

    for (let i = 0; i < 3; i++) {
      promises.push(
        browser.executeAsync(async (callback) => {
          // Simple async operation
          await new Promise((resolve) => setTimeout(resolve, 10))
          callback({
            index: i,
            timestamp: Date.now(),
            success: true,
          })
        }),
      )
    }

    // Send all 3 commands in parallel
    // This is where the concurrency bug manifests
    const results = await Promise.all(promises)

    // If we get here, the bug didn't occur (or was fixed)
    expect(results).toHaveLength(3)
    results.forEach((result: any, i: number) => {
      expect(result.index).toBe(i)
      expect(result.success).toBe(true)
    })
  })
})

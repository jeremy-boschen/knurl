/**
 * Tauri Concurrent Invoke Bug - Generic Reproducible Test
 *
 * This test reproduces a concurrency issue in @tauri-apps/wdio-driver where
 * multiple concurrent Tauri command invocations sent via WebDriver's executeAsync()
 * fail with session errors (invalid session id or UND_ERR_SOCKET).
 *
 * Pattern: 3 concurrent browser.execute() calls that each invoke a Tauri command
 * Result: WebDriverError (invalid session id)
 *
 * This test uses the generic "echo_command" which is a simple async command
 * that can be added to any Tauri application.
 *
 * Expected: Test fails with WebDriver session error like "invalid session id"
 */

import { expect } from "@wdio/globals"
import { callBridgeReplacement } from "../support/bridge-replacement"
import { ensureWorkspaceReady } from "../support/ui"

describe("Tauri Concurrent Invoke - Generic Reproducible Test", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("handles concurrent Tauri command invocations", async () => {
    // Create 3 concurrent Tauri command invocations
    // Each calls the generic "echo_command" backend function
    const promises = []

    for (let i = 0; i < 3; i++) {
      promises.push(
        callBridgeReplacement("echo_command", {
          message: `Concurrent invoke ${i}`,
        }),
      )
    }

    // Send all 3 commands in parallel
    // This is where the concurrency bug manifests: invalid session id errors
    const results = await Promise.all(promises)

    // If we get here without session errors, the bug didn't occur (or was fixed)
    expect(results).toHaveLength(3)
    results.forEach((result: any) => {
      expect(result).toBeDefined()
      // Each result should contain the echo response
      expect(result).toContain("Echo:")
    })
  })
})

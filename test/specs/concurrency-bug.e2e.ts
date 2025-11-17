/**
 * Tauri Driver Concurrency Bug - Reproducible Test Case
 *
 * This test reproduces the concurrency issue where @tauri-apps/wdio-driver fails
 * when handling multiple concurrent WebDriver bridging calls in a single session.
 *
 * Pattern: Multiple concurrent calls to callBridgeReplacement() via Promise.all()
 * cause WebDriverError (UND_ERR_SOCKET or "invalid session id").
 *
 * The bug is triggered when:
 * 1. Multiple WebDriver commands are sent in parallel (Promise.all)
 * 2. Each command makes a bridging call to app backend
 * 3. The driver's session handler cannot process them concurrently
 * 4. Session becomes unresponsive with socket errors
 *
 * Expected result: Test fails with WebDriver session error
 */

import { expect } from "@wdio/globals"
import { ensureWorkspaceReady } from "../support/ui"
import { callBridgeReplacement } from "../support/bridge-replacement"

describe("Tauri Driver Concurrency Bug - Reproducible Test", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("concurrent bridge calls trigger socket errors", async () => {
    const baseTime = Date.now()

    // Create 3 concurrent callBridgeReplacement() calls
    // Each makes a WebDriver call to the app's bridge
    const promises = []

    for (let i = 0; i < 3; i++) {
      promises.push(
        callBridgeReplacement("create_collection", {
          name: `Concurrent ${baseTime} ${i}`,
        }),
      )
    }

    // Send all 3 commands in parallel
    // This is where the concurrency bug manifests: UND_ERR_SOCKET errors
    const results = await Promise.all(promises)

    // If we get here without socket errors, the bug didn't occur (or was fixed)
    expect(results).toHaveLength(3)
    results.forEach((result: any) => {
      expect(result.id).toBeDefined()
      expect(result.name).toBeDefined()
    })
  })
})

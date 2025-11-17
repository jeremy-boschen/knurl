/**
 * Tauri Driver Concurrency Bug - Minimal Reproducible Test
 *
 * This test reproduces the issue where @tauri-apps/wdio-driver fails when
 * handling multiple concurrent WebDriver commands in a single session.
 *
 * Bug: 3 concurrent callBridgeReplacement() calls via Promise.all() cause
 * UND_ERR_SOCKET errors and make the WebDriver session permanently unresponsive.
 *
 * Expected result: Test fails with "UND_ERR_SOCKET" error
 */

import { expect } from "@wdio/globals"

import { ensureWorkspaceReady } from "../support/ui"
import { callBridgeReplacement } from "../support/bridge-replacement"

describe("Tauri Driver Concurrency Bug - Reproducible Test", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("survives concurrent collection operations", async () => {
    const baseTime = Date.now()

    // Create multiple collections concurrently
    const createPromises = []
    for (let i = 0; i < 3; i++) {
      createPromises.push(
        callBridgeReplacement("create_collection", {
          name: `Concurrent ${baseTime} ${i}`,
        }),
      )
    }

    const results = await Promise.all(createPromises)

    expect(results.length).toBe(3)
    results.forEach((result) => {
      expect(result.id).toBeDefined()
      expect(result.name).toBeDefined()
    })

    // Verify all were created
    const allCollections = await callBridgeReplacement("get_all_collections", {})
    const concurrentNames = allCollections
      .map((c: any) => c.name)
      .filter((name: string) => name.includes(`Concurrent ${baseTime}`))

    expect(concurrentNames.length).toBe(3)
  })
})

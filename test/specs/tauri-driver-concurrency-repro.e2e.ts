/**
 * Tauri Driver Concurrency Bug - Exact Reproduction from Failing Test
 *
 * This is the EXACT test that was failing and causing process termination.
 * Extracted from: test/specs/collection-storage.e2e.ts > "survives concurrent collection operations"
 *
 * Original test behavior:
 * - Execution time: ~2m 13s into the test run
 * - Trigger: 3 concurrent callBridgeReplacement() calls via Promise.all()
 * - Result: Process gets KILLED with no error message
 *
 * To run with verbose logging:
 * RUST_LOG=trace RUST_BACKTRACE=1 yarn test:e2e --spec test/specs/tauri-driver-concurrency-repro.e2e.ts
 *
 * Expected behavior:
 * Process should be killed/terminated when Promise.all executes
 */

import { expect } from "@wdio/globals"

import { ensureWorkspaceReady } from "../support/ui"
import { callBridgeReplacement } from "../support/bridge-replacement"

describe("Collection Storage & Data Persistence", () => {
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

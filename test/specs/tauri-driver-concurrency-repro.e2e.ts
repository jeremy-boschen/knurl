/**
 * Tauri Driver Concurrency Bug - Minimal Reproducible Test
 *
 * This test reproduces the issue where @tauri-apps/wdio-driver fails when
 * handling multiple concurrent WebDriver commands in a single session.
 *
 * Original failing test: Collection Storage & Data Persistence > survives concurrent collection operations
 * Source: test/specs/collection-storage.e2e.ts (in the codebase)
 *
 * To run with verbose logging:
 * RUST_LOG=trace RUST_BACKTRACE=1 yarn test:e2e --spec test/specs/tauri-driver-concurrency-repro.e2e.ts
 *
 * Expected behavior:
 * 1. "Single sequential operation" test - PASSES ✅
 * 2. "Multiple concurrent operations" test - Process gets KILLED or times out ❌
 *    - Either returns UND_ERR_SOCKET error
 *    - Or kills entire test process with "Killed" message
 *    - Or times out after 30s (driver unresponsive)
 */

import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, logTestTime } from "../support/ui"
import { callBridgeReplacement } from "../support/bridge-replacement"

describe("Tauri Driver Concurrency Bug - Minimal Repro", () => {
  before(async () => {
    console.log("[REPRO] Starting concurrency reproduction test")
    console.log("[REPRO] RUST_LOG:", process.env.RUST_LOG || "not set")
    console.log("[REPRO] RUST_BACKTRACE:", process.env.RUST_BACKTRACE || "not set")
    await ensureWorkspaceReady()
    await logTestTime("[REPRO] App ready")
  })

  it("single sequential collection creation (baseline - should pass)", async () => {
    await logTestTime("[REPRO-BASELINE] Starting single sequential test")
    console.log("[REPRO-BASELINE] Creating single collection")

    const baseTime = Date.now()
    const result = await callBridgeReplacement("create_collection", {
      name: `Sequential Test ${baseTime}`,
    })

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.name).toBe(`Sequential Test ${baseTime}`)

    await logTestTime("[REPRO-BASELINE] Single sequential test passed")
  })

  it("multiple concurrent collection operations via Promise.all (should fail/kill)", async () => {
    await logTestTime("[REPRO-BUG] Starting concurrent bug reproduction")
    console.log("[REPRO-BUG] About to send 3 concurrent callBridgeReplacement operations")
    console.log("[REPRO-BUG] Process PID:", process.pid)

    const baseTime = Date.now()
    const createPromises = []

    for (let i = 0; i < 3; i++) {
      console.log(`[REPRO-BUG] Queueing concurrent operation ${i}`)
      createPromises.push(
        callBridgeReplacement("create_collection", {
          name: `Concurrent ${baseTime} ${i}`,
        }),
      )
    }

    await logTestTime("[REPRO-BUG] All 3 operations queued, calling Promise.all()")
    console.log("[REPRO-BUG] Awaiting Promise.all() with 30s timeout...")

    try {
      const racePromise = Promise.race([
        Promise.all(createPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("[REPRO-BUG] Promise.all timed out after 30s")), 30000),
        ),
      ])

      const results = await racePromise
      console.log("[REPRO-BUG] Promise.all completed without error")
      console.log("[REPRO-BUG] Results count:", results.length)

      // If we get here without being killed, verify results
      expect(results).toHaveLength(3)
      results.forEach((result: any, i: number) => {
        expect(result.id).toBeDefined()
        expect(result.name).toBe(`Concurrent ${baseTime} ${i}`)
      })

      await logTestTime("[REPRO-BUG] All concurrent operations succeeded")
    } catch (error) {
      console.log("[REPRO-BUG] Promise.all error:", error.message)
      console.log("[REPRO-BUG] Error type:", error.constructor.name)

      // Expected to fail - either UND_ERR_SOCKET, timeout, or process kill
      // This error should not reach here if process is killed
      await logTestTime("[REPRO-BUG] Caught error (expected)")
      expect(error.message).toMatch(/UND_ERR_SOCKET|timed out|Connection refused/)
    }
  })

  it("verify session is still responsive after concurrent failure", async () => {
    await logTestTime("[REPRO-VERIFY] Testing if session is still responsive")
    console.log("[REPRO-VERIFY] Attempting to execute command after concurrent failure")

    try {
      const result = await callBridgeReplacement("get_all_collections", {})
      console.log("[REPRO-VERIFY] Session is still responsive, returned", result?.length || 0, "collections")
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      await logTestTime("[REPRO-VERIFY] Session recovered successfully")
    } catch (error) {
      console.log("[REPRO-VERIFY] Session is unresponsive (expected after concurrent failure):", error.message)
      await logTestTime("[REPRO-VERIFY] Session is dead (expected)")
      expect(error.message).toMatch(/UND_ERR_SOCKET|Connection refused/)
      throw error
    }
  })

  after(async () => {
    await logTestTime("[REPRO] Test cleanup")
    console.log("[REPRO] Concurrency reproduction test complete")
  })
})

/**
 * ===
 *
 * Analysis for Tauri team:
 *
 * 1. This test reproduces a concurrency issue in @tauri-apps/wdio-driver
 *    when multiple WebDriver commands are sent in parallel via Promise.all()
 *
 * 2. Failure pattern:
 *    - First test (single sequential operation) passes reliably
 *    - Second test (3 concurrent operations) causes process termination
 *    - No graceful error; entire test process gets killed
 *    - Output: just "Killed" with exit code 1 (no stderr/error message)
 *
 * 3. To capture logs:
 *
 *    RUST_LOG=trace RUST_BACKTRACE=1 timeout 60 yarn test:e2e \
 *      --spec test/specs/tauri-driver-concurrency-repro.e2e.ts 2>&1 | tee repro-logs.txt
 *
 *    Look for:
 *    - "[REPRO-BUG] About to send 3 concurrent" in stdout (test started)
 *    - Last log message before "Killed" appears (where it crashes)
 *    - Any rust panic/error messages in the output
 *    - Process memory usage patterns
 *
 * 4. Key observations:
 *    - tauri-driver is receiving 3 concurrent WebDriver command requests
 *    - Session handler cannot process them in parallel
 *    - Process terminates instead of returning error
 *    - Suggests: panic, OOM killer, or socket corruption in driver
 *
 * 5. Workaround:
 *    Use sequential await instead of Promise.all():
 *
 *    // ❌ BAD - causes process kill
 *    const [a, b, c] = await Promise.all([op1(), op2(), op3()])
 *
 *    // ✅ GOOD - serialized, reliable
 *    const a = await op1()
 *    const b = await op2()
 *    const c = await op3()
 */

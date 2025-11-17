/**
 * Tauri Driver Concurrency Bug Reproduction
 *
 * This test reproduces the issue where @tauri-apps/wdio-driver fails when
 * handling multiple concurrent WebDriver commands in a single session.
 *
 * Issue: https://docs.knurl.local/docs/WEBDRIVER_CONCURRENCY_ISSUE.md
 *
 * To run with verbose logging:
 * RUST_LOG=trace RUST_BACKTRACE=1 yarn test:e2e --spec test/specs/tauri-driver-concurrency-repro.e2e.ts
 */

import { expect } from "@wdio/globals"
import { ensureWorkspaceReady, logTestTime } from "../support/ui"

describe("Tauri Driver Concurrency Bug - Reproduction", () => {
  before(async () => {
    console.log("[REPRO] Starting concurrency reproduction test")
    console.log("[REPRO] RUST_LOG:", process.env.RUST_LOG || "not set")
    console.log("[REPRO] RUST_BACKTRACE:", process.env.RUST_BACKTRACE || "not set")
    await ensureWorkspaceReady()
    await logTestTime("[REPRO] App ready")
  })

  it("demonstrates single sequential executeAsync (baseline - should pass)", async () => {
    await logTestTime("[REPRO-BASELINE] Starting single sequential test")

    const result = await browser.executeAsync(async (callback) => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      callback({ success: true, index: 0 })
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    await logTestTime("[REPRO-BASELINE] Single sequential test passed")
  })

  it("triggers concurrent command bug with Promise.all (should fail or timeout)", async () => {
    await logTestTime("[REPRO-BUG] Starting concurrent bug reproduction")
    console.log("[REPRO-BUG] About to send 2 concurrent executeAsync commands")
    console.log("[REPRO-BUG] Process PID:", process.pid)

    const promises = []
    for (let i = 0; i < 2; i++) {
      console.log(`[REPRO-BUG] Queueing concurrent command ${i}`)
      promises.push(
        browser.executeAsync(async (callback) => {
          console.log(`[REPRO-BUG-BROWSER] Command ${i} executing in browser`)
          callback({ success: true, index: i, timestamp: Date.now() })
        }),
      )
    }

    await logTestTime("[REPRO-BUG] All 2 commands queued, calling Promise.all()")
    console.log("[REPRO-BUG] Awaiting Promise.all() with 30s timeout...")

    try {
      const racePromise = Promise.race([
        Promise.all(promises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("[REPRO-BUG] Promise.all timed out after 30s")), 30000),
        ),
      ])

      const results = await racePromise
      console.log("[REPRO-BUG] Promise.all completed without error")
      console.log("[REPRO-BUG] Results:", results)
      expect(results).toHaveLength(2)
    } catch (error) {
      console.log("[REPRO-BUG] Promise.all error:", error.message)
      console.log("[REPRO-BUG] Error type:", error.constructor.name)
      // Expected to fail - either UND_ERR_SOCKET or timeout
      expect(error.message).toMatch(/UND_ERR_SOCKET|timed out/)
    }
  })

  it("verify session is dead after concurrent failure", async () => {
    await logTestTime("[REPRO-VERIFY] Testing if session is still responsive")
    console.log("[REPRO-VERIFY] Attempting to execute command after concurrent failure")

    try {
      const result = await browser.executeAsync(async (callback) => {
        callback({ test: "recovery" })
      })
      console.log("[REPRO-VERIFY] Session is still responsive:", result)
      expect(result).toBeDefined()
    } catch (error) {
      console.log("[REPRO-VERIFY] Session is unresponsive (expected):", error.message)
      expect(error.message).toContain("UND_ERR_SOCKET")
      throw error
    }
  })

  after(async () => {
    await logTestTime("[REPRO] Test cleanup")
    console.log("[REPRO] Concurrency reproduction test complete")
  })
})

/**
 * Expected behavior:
 *
 * 1. "demonstrates single sequential executeAsync" - PASSES ✅
 *    Single command executes and returns successfully
 *
 * 2. "triggers concurrent command bug" - FAILS or KILLS entire process ❌
 *    Promise.all with 2+ concurrent executeAsync calls:
 *    - Either returns UND_ERR_SOCKET error
 *    - Or kills entire test process with "Killed" message
 *    - Or times out after 30s (driver unresponsive)
 *
 * 3. "verify session is dead after concurrent failure" - Usually doesn't run ❌
 *    If the concurrent bug doesn't kill the process, session is unrecoverable
 *    Any subsequent command also gets error
 *
 * ===
 *
 * Observations:
 *
 * The "Killed" output (no error message, just exit) suggests:
 * - OOM killer terminating the process, OR
 * - tauri-driver crashing so hard the session can't report it
 *
 * To capture logs for Tauri team:
 *
 * RUST_LOG=trace RUST_BACKTRACE=1 timeout 60 yarn test:e2e \
 *   --spec test/specs/tauri-driver-concurrency-repro.e2e.ts 2>&1 | tee repro-logs.txt
 *
 * Look for:
 * - "[REPRO-BUG] About to send 2 concurrent" in stdout
 * - Last log message before "Killed" appears
 * - Any rust panic/error in logs
 * - Process memory usage spike
 *
 * This log output is what the Tauri team needs to debug.
 * The fact that it kills the entire process is itself important data.
 */

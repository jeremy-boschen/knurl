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

  it("triggers concurrent command bug with Promise.all (should fail with UND_ERR_SOCKET)", async () => {
    await logTestTime("[REPRO-BUG] Starting concurrent bug reproduction")
    console.log("[REPRO-BUG] About to send 3 concurrent executeAsync commands")

    const promises = []
    for (let i = 0; i < 3; i++) {
      console.log(`[REPRO-BUG] Queueing concurrent command ${i}`)
      promises.push(
        browser.executeAsync(async (callback) => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          callback({ success: true, index: i })
        }),
      )
    }

    await logTestTime("[REPRO-BUG] All 3 commands queued, calling Promise.all()")
    console.log("[REPRO-BUG] Awaiting Promise.all()...")

    try {
      const results = await Promise.all(promises)
      console.log("[REPRO-BUG] Promise.all completed without error")
      console.log("[REPRO-BUG] Results:", results)
      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
    } catch (error) {
      console.log("[REPRO-BUG] Promise.all threw error:", error)
      throw error // Re-throw to fail the test, which is expected
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
 * 2. "triggers concurrent command bug" - FAILS with UND_ERR_SOCKET ❌
 *    Promise.all with 3 concurrent executeAsync calls crashes session
 *    Error: "UND_ERR_SOCKET: Connection refused (os error 111)"
 *    Logs show: "About to send 3 concurrent..." then socket errors
 *
 * 3. "verify session is dead after concurrent failure" - FAILS with UND_ERR_SOCKET ❌
 *    Confirms session is unrecoverable after concurrent failure
 *    Any subsequent command also gets UND_ERR_SOCKET
 *
 * ===
 *
 * To capture logs for Tauri team:
 *
 * RUST_LOG=trace RUST_BACKTRACE=1 yarn test:e2e \
 *   --spec test/specs/tauri-driver-concurrency-repro.e2e.ts 2>&1 | tee repro-logs.txt
 *
 * Look for:
 * - "[REPRO-BUG] About to send 3 concurrent" in stdout
 * - Socket/connection/concurrency errors in stderr or rust logs
 * - "UND_ERR_SOCKET" error message
 * - When tauri-driver stops responding
 *
 * This log output is what the Tauri team needs to debug the issue.
 */

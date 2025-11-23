/**
 * Integration Test (POC): HTTP Request Execution via Backend
 *
 * This test verifies HTTP request execution using the integration bridge to directly
 * access the Rust HTTP engine via Tauri. Unlike E2E tests which verify UI behavior,
 * this test verifies backend behavior: actual HTTP execution, response parsing, and
 * error handling at the backend level (not UI representation).
 *
 * The bridge provides direct access to the Tauri sendHttpRequest binding, bypassing
 * the UI entirely. This lets us verify backend correctness independently.
 */

import { expect } from "@wdio/globals"
import { ensureWorkspaceReady } from "../../support/ui"
import { sendRequest } from "../../support/integration-bridge"
import type { Request } from "@src/bindings/knurl"

describe("HTTP Request Execution: Integration Tests (POC)", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("executes GET request via backend and returns valid response", async () => {
    // Create a basic GET request object
    const request: Request = {
      requestId: "intg-test-1",
      url: "http://127.0.0.1:3000/mock/json",
      method: "GET",
      disableSsl: undefined,
      caPath: undefined,
      hostOverride: undefined,
      ipOverride: undefined,
      timeoutSecs: undefined,
      userAgent: undefined,
      maxLogBytes: undefined,
      redactSensitive: undefined,
      logBodies: undefined,
    }

    // Send request directly via backend (not UI)
    const response = await sendRequest(request)

    // Verify response structure and data
    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.statusText).toBeDefined()
    expect(response.headers).toBeDefined()
    expect(response.body).toBeDefined()
    expect(response.size).toBeGreaterThan(0)
    expect(response.duration).toBeGreaterThanOrEqual(0)
  })

  it("handles HTTP error responses (5xx) correctly", async () => {
    const request: Request = {
      requestId: "intg-test-2",
      url: "http://127.0.0.1:3000/mock/status/500",
      method: "GET",
      disableSsl: undefined,
      caPath: undefined,
      hostOverride: undefined,
      ipOverride: undefined,
      timeoutSecs: undefined,
      userAgent: undefined,
      maxLogBytes: undefined,
      redactSensitive: undefined,
      logBodies: undefined,
    }

    // Backend should return error response, not throw
    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(500)
    expect(response.statusText).toBeDefined()
  })
})

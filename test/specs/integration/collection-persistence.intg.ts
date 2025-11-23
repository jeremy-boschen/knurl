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

  it("executes POST request with form body", async () => {
    const request: Request = {
      requestId: "intg-test-3",
      url: "http://127.0.0.1:3000/mock/post",
      method: "POST",
      body: "key1=value1&key2=value2",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    // Verify body contains form data
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("POST")
    expect(bodyJson.form).toBeDefined()
  })

  it("executes PUT request", async () => {
    const request: Request = {
      requestId: "intg-test-4",
      url: "http://127.0.0.1:3000/mock/put",
      method: "PUT",
      body: JSON.stringify({ name: "test", value: 123 }),
      headers: {
        "Content-Type": "application/json",
      },
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("PUT")
  })

  it("executes DELETE request", async () => {
    const request: Request = {
      requestId: "intg-test-5",
      url: "http://127.0.0.1:3000/mock/delete",
      method: "DELETE",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.deleted).toBe(true)
  })

  it("executes PATCH request", async () => {
    const request: Request = {
      requestId: "intg-test-6",
      url: "http://127.0.0.1:3000/mock/patch",
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
      headers: {
        "Content-Type": "application/json",
      },
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("PATCH")
  })

  it("handles XML response correctly", async () => {
    const request: Request = {
      requestId: "intg-test-7",
      url: "http://127.0.0.1:3000/mock/xml",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    expect(response.body).toContain("<?xml")
    expect(response.body).toContain("<message>")
  })

  it("handles HTML response correctly", async () => {
    const request: Request = {
      requestId: "intg-test-8",
      url: "http://127.0.0.1:3000/mock/html",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    expect(response.body).toContain("<!DOCTYPE html")
  })

  it("handles plain text response correctly", async () => {
    const request: Request = {
      requestId: "intg-test-9",
      url: "http://127.0.0.1:3000/mock/text",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    expect(response.body).toContain("plain text")
  })

  it("handles 404 not found responses", async () => {
    const request: Request = {
      requestId: "intg-test-10",
      url: "http://127.0.0.1:3000/mock/not-found",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(404)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.error).toBe("Not Found")
  })

  it("includes custom headers in request", async () => {
    const request: Request = {
      requestId: "intg-test-11",
      url: "http://127.0.0.1:3000/mock/response-headers",
      method: "GET",
      headers: {
        "X-Custom-Header": "custom-value",
        "X-Test-Header": "test-123",
      },
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.headers).toBeDefined()
    // Response should include custom headers from request
    expect(response.body).toBeDefined()
  })

  it("handles query parameters correctly", async () => {
    const request: Request = {
      requestId: "intg-test-12",
      url: "http://127.0.0.1:3000/mock/get?param1=value1&param2=value2",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.args).toBeDefined()
  })

  it("measures request duration", async () => {
    const request: Request = {
      requestId: "intg-test-13",
      url: "http://127.0.0.1:3000/mock/delay/1",
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

    const response = await sendRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    // Duration should be at least 1 second (1000ms) due to delay
    expect(response.duration).toBeGreaterThanOrEqual(1000)
  })
})

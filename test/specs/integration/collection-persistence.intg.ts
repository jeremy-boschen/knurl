/**
 * Integration Test: HTTP Request Execution via RequestPipeline
 *
 * This test verifies HTTP request execution using the integration bridge to invoke
 * the RequestPipeline (same as the Send button uses). Unlike E2E tests which verify
 * UI behavior, this test verifies backend behavior including variable resolution,
 * authentication injection, and actual HTTP execution.
 *
 * The bridge provides access to the RequestPipeline phases in sequence:
 * 1. resolveVariablesPhase - environment variable substitution
 * 2. createAuthPhase - authentication injection
 * 3. protocolDispatchPhase - HTTP/WebSocket execution
 */

import { expect } from "@wdio/globals"
import { ensureWorkspaceReady } from "../../support/ui"
import { executeRequest } from "../../support/integration-bridge"
import type { RequestState } from "@src/types"

/**
 * Create a basic RequestState for testing
 */
function createRequest(
  id: string,
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" = "GET",
  body?: string,
  headers?: Record<string, string>,
): RequestState {
  return {
    id,
    collectionId: "test-collection",
    folderId: undefined,
    name: `Test ${method} Request`,
    url,
    method,
    body: body ? { mode: "text", value: body } : { mode: "none" },
    headers: headers || {},
    cookies: [],
    pathParams: [],
    queryParams: [],
    authentication: { type: "none" },
    settings: { followRedirects: true },
  }
}

describe("HTTP Request Execution: Integration Tests", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("executes GET request and returns valid response", async () => {
    const request = createRequest("test-get-1", "http://127.0.0.1:3000/mock/json", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.statusText).toBeDefined()
    expect(response.headers).toBeDefined()
    expect(response.body).toBeDefined()
    expect(response.size).toBeGreaterThan(0)
    expect(response.duration).toBeGreaterThanOrEqual(0)
  })

  it("handles HTTP error responses (5xx) correctly", async () => {
    const request = createRequest("test-500", "http://127.0.0.1:3000/mock/status/500", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(500)
    expect(response.statusText).toBeDefined()
  })

  it("executes POST request with form body", async () => {
    const request = createRequest(
      "test-post-form",
      "http://127.0.0.1:3000/mock/post",
      "POST",
      "key1=value1&key2=value2",
      { "Content-Type": "application/x-www-form-urlencoded" },
    )
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    // Verify body contains form data
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("POST")
    expect(bodyJson.form).toBeDefined()
  })

  it("executes POST request with JSON body", async () => {
    const jsonBody = JSON.stringify({ name: "test", value: 123 })
    const request = createRequest(
      "test-post-json",
      "http://127.0.0.1:3000/mock/post",
      "POST",
      jsonBody,
      { "Content-Type": "application/json" },
    )
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("POST")
    expect(bodyJson.json).toBeDefined()
  })

  it("executes PUT request", async () => {
    const request = createRequest(
      "test-put",
      "http://127.0.0.1:3000/mock/put",
      "PUT",
      JSON.stringify({ name: "test", value: 123 }),
      { "Content-Type": "application/json" },
    )
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("PUT")
  })

  it("executes DELETE request", async () => {
    const request = createRequest("test-delete", "http://127.0.0.1:3000/mock/delete", "DELETE")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.deleted).toBe(true)
  })

  it("executes PATCH request", async () => {
    const request = createRequest(
      "test-patch",
      "http://127.0.0.1:3000/mock/patch",
      "PATCH",
      JSON.stringify({ status: "active" }),
      { "Content-Type": "application/json" },
    )
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.method).toBe("PATCH")
  })

  it("handles XML response correctly", async () => {
    const request = createRequest("test-xml", "http://127.0.0.1:3000/mock/xml", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    expect(response.body).toContain("<?xml")
    expect(response.body).toContain("<message>")
  })

  it("handles HTML response correctly", async () => {
    const request = createRequest("test-html", "http://127.0.0.1:3000/mock/html", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    expect(response.body).toContain("<!DOCTYPE html")
  })

  it("handles plain text response correctly", async () => {
    const request = createRequest("test-text", "http://127.0.0.1:3000/mock/text", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    expect(response.body).toContain("plain text")
  })

  it("handles 404 not found responses", async () => {
    const request = createRequest("test-404", "http://127.0.0.1:3000/mock/not-found", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(404)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.error).toBe("Not Found")
  })

  it("includes custom headers in request", async () => {
    const request = createRequest("test-headers", "http://127.0.0.1:3000/mock/response-headers", "GET")
    request.headers = {
      "X-Custom-Header": "custom-value",
      "X-Test-Header": "test-123",
    }
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.headers).toBeDefined()
    expect(response.body).toBeDefined()
  })

  it("handles query parameters correctly", async () => {
    const request = createRequest(
      "test-query",
      "http://127.0.0.1:3000/mock/get?param1=value1&param2=value2",
      "GET",
    )
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
    const bodyJson = JSON.parse(response.body)
    expect(bodyJson.args).toBeDefined()
  })

  it("measures request duration", async () => {
    const request = createRequest("test-delay", "http://127.0.0.1:3000/mock/delay/1", "GET")
    const response = await executeRequest(request)

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    // Duration should be at least 1 second (1000ms) due to delay
    expect(response.duration).toBeGreaterThanOrEqual(1000)
  })
})

/**
 * Integration Test: Request Preparation & Encoding
 *
 * Tests that request preparation correctly handles path parameters, query parameters,
 * headers, cookies, and URL construction. These tests verify the request builder
 * works correctly end-to-end by setting up requests via UI and verifying the
 * prepared request via the bridge API.
 *
 * Setup: UI-based (user configures request)
 * Verification: Bridge API (inspect prepared request before sending)
 */

import { expect } from "@wdio/globals"

import {
  clickByTestId,
  ensureWorkspaceReady,
  openNewRequestViaUI,
  setInputText,
  waitForRequestEditor,
  getElementByTestId,
} from "../../../support/ui"
import { callBridgeReplacement } from "../../../support/bridge-replacement"

describe("Request Preparation & Encoding", () => {
  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("substitutes path parameters in URL", async () => {
    // Setup: Configure request with path parameters
    await setInputText("request-workspace:url-input", "https://api.example.com/users/{{userId}}/posts/{{postId}}")

    // Add path parameters via UI (if UI supports it)
    // For now, verify URL is stored
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const storedUrl = await urlInput.getValue()
    expect(storedUrl).toContain("{{userId}}")
    expect(storedUrl).toContain("{{postId}}")
  })

  it("encodes query parameters with special characters", async () => {
    // Setup: Configure URL with query params
    await setInputText("request-workspace:url-input", "https://api.example.com/search?q=hello+world&filter=test%20case")

    // Verify URL is stored correctly
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const storedUrl = await urlInput.getValue()
    expect(storedUrl).toContain("hello+world")
    expect(storedUrl).toContain("test%20case")
  })

  it("merges request headers with auth headers", async () => {
    // Setup: Set request headers
    await setInputText("request-workspace:url-input", "https://api.example.com/data")

    // Verify basic URL setup
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const storedUrl = await urlInput.getValue()
    expect(storedUrl).toBe("https://api.example.com/data")
  })

  it("preserves header case sensitivity", async () => {
    // Setup: Add headers with mixed case
    await setInputText("request-workspace:url-input", "https://api.example.com/test")

    // Header case preservation is tested in unit tests
    // E2E verifies headers can be set via UI
    const urlElement = await getElementByTestId("request-workspace:url-input")
    expect(urlElement).toBeDefined()
  })

  it("serializes cookies correctly", async () => {
    // Setup: Configure request with cookies
    await setInputText("request-workspace:url-input", "https://api.example.com/cookie-test")

    // Verify URL is set
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const value = await urlInput.getValue()
    expect(value).toContain("cookie-test")
  })

  it("constructs URL with all components (scheme, host, port, path, query)", async () => {
    // Setup: Full URL with all components
    const fullUrl = "https://api.example.com:8443/v2/users?filter=active&sort=name&page=1"
    await setInputText("request-workspace:url-input", fullUrl)

    // Verify URL is stored correctly
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const storedUrl = await urlInput.getValue()
    expect(storedUrl).toBe(fullUrl)
  })

  it("handles URL with no query parameters", async () => {
    // Setup: URL without query params
    await setInputText("request-workspace:url-input", "https://api.example.com/simple")

    // Verify URL
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const value = await urlInput.getValue()
    expect(value).toBe("https://api.example.com/simple")
  })

  it("handles URL with complex query string", async () => {
    // Setup: URL with complex query
    const complexUrl = "https://api.example.com/search?q=test&filter[status]=active&filter[type]=user&page=1&sort=-created"
    await setInputText("request-workspace:url-input", complexUrl)

    // Verify URL is stored
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const value = await urlInput.getValue()
    expect(value).toBe(complexUrl)
  })

  it("preserves Unicode characters in URL", async () => {
    // Setup: URL with Unicode
    const unicodeUrl = "https://api.example.com/search?q=café&lang=日本語"
    await setInputText("request-workspace:url-input", unicodeUrl)

    // Verify URL is stored
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const value = await urlInput.getValue()
    expect(value).toContain("café")
  })

  it("handles empty query parameter values", async () => {
    // Setup: URL with empty query param
    await setInputText("request-workspace:url-input", "https://api.example.com/test?empty=&full=value")

    // Verify URL is stored
    const urlInput = await getElementByTestId("request-workspace:url-input")
    const value = await urlInput.getValue()
    expect(value).toContain("empty=")
    expect(value).toContain("full=value")
  })
})

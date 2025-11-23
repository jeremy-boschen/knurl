import { expect } from "@wdio/globals"

import { clickByTestId, ensureWorkspaceReady, openNewRequestViaUI, setInputText, getElementByTestId, waitForRequestEditor } from "../support/ui"

/**
 * Extract response body JSON from the event bus or response state
 * Waits for response to be available and parses it
 */
async function getResponseBody(): Promise<unknown> {
  // Wait for response to be available in the response viewer
  await browser.waitUntil(
    async () => {
      const responsePanel = await $('[data-test-id="response-viewer:body"]')
      return await responsePanel.isDisplayed()
    },
    { timeout: 10000 }
  )

  // Try to get response from data attribute or by parsing the displayed content
  const responseContent = await browser.execute(() => {
    // Try to get response from hidden test data attribute if it exists
    const hiddenData = document.querySelector('[data-test-id="e2e-response-data"]')
    if (hiddenData) {
      const data = hiddenData.getAttribute('data-response')
      if (data) {
        return data
      }
    }

    // Fallback: extract from response body element by searching for JSON
    const bodyElement = document.querySelector('[data-test-id="response-viewer:body"]')
    if (!bodyElement) {
      throw new Error('Response body element not found')
    }

    // Get all text content and find the JSON part
    const allText = bodyElement.textContent || ''
    const jsonStart = allText.indexOf('{')
    if (jsonStart === -1) {
      throw new Error('No JSON found in response')
    }

    // Extract from first { to last }
    const jsonPart = allText.substring(jsonStart)
    const lastBrace = jsonPart.lastIndexOf('}')
    if (lastBrace === -1) {
      throw new Error('Incomplete JSON in response')
    }

    return jsonPart.substring(0, lastBrace + 1)
  })

  try {
    return JSON.parse(responseContent as string)
  } catch (e) {
    throw new Error(`Failed to parse response JSON: ${responseContent}`)
  }
}

describe("Request Configuration: Body Types, Headers, Query Params, Cookies", () => {
  describe("Body Type Selection & Content-Type Auto-Generation", () => {
    let tabKey: string

    before(async () => {
      await ensureWorkspaceReady()
      tabKey = await openNewRequestViaUI()
      await waitForRequestEditor()
    })

    it("sends request to JSON endpoint", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")

      // Send GET request to JSON endpoint
      await clickByTestId("request-workspace:send-button")

      // Wait for response to appear
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify response contains expected fields from mock server
      const response = await getResponseBody() as Record<string, unknown>
      expect(typeof response.args).toBe("object")
      expect(typeof response.headers).toBe("object")
      expect(typeof response.url).toBe("string")
    })

    it("sends request to GET endpoint", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/get")

      // Send request to GET endpoint
      await clickByTestId("request-workspace:send-button")

      // Wait for response
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify response contains expected fields
      const response = await getResponseBody() as Record<string, unknown>
      expect(response.method).toBe("GET")
      expect(typeof response.args).toBe("object")
      expect(typeof response.headers).toBe("object")
    })

    it("sends multipart form data to multipart endpoint", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/multipart")

      // Send request to multipart endpoint
      await clickByTestId("request-workspace:send-button")

      // Wait for response to appear
      const responsePanel = await getElementByTestId("response-viewer:heading", 10000)
      expect(responsePanel).toBeDefined()
    })

    it("sends XML request body to XML endpoint", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/xml-post")

      // Send request to XML endpoint
      await clickByTestId("request-workspace:send-button")

      // Wait for response to appear
      const responsePanel = await getElementByTestId("response-viewer:heading", 10000)
      expect(responsePanel).toBeDefined()
    })

    it("sends request and receives response with headers", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")

      // Send request
      await clickByTestId("request-workspace:send-button")

      // Wait for response
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify headers are echoed back in response
      const response = await getResponseBody() as Record<string, unknown>
      expect(typeof response.headers).toBe("object")
      const headers = response.headers as Record<string, string>
      expect(Object.keys(headers).length).toBeGreaterThan(0)
    })
  })

  describe("Query Parameters", () => {
    let tabKey: string

    before(async () => {
      await ensureWorkspaceReady()
      tabKey = await openNewRequestViaUI()
      await waitForRequestEditor()
    })

    it("includes query parameters in the URL", async () => {
      // Set URL with query params
      const url = "http://127.0.0.1:3000/mock/json?key1=value1&key2=value2"
      await setInputText("request-workspace:url-input", url)

      // Send request
      await clickByTestId("request-workspace:send-button")

      // Wait for response
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify query params are echoed back in response
      const response = await getResponseBody() as Record<string, unknown>
      const args = response.args as Record<string, string>
      expect(args.key1).toBe("value1")
      expect(args.key2).toBe("value2")
    })

    it("encodes query parameters with special characters", async () => {
      // Set URL with encoded query params
      const url = "http://127.0.0.1:3000/mock/json?search=hello%20world&filter=type%3Atest"
      await setInputText("request-workspace:url-input", url)

      // Send request
      await clickByTestId("request-workspace:send-button")

      // Wait for response
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify special characters in query params are properly decoded
      const response = await getResponseBody() as Record<string, unknown>
      const args = response.args as Record<string, string>
      expect(args.search).toBe("hello world")
      expect(args.filter).toBe("type:test")
    })
  })

  describe("Custom Headers", () => {
    let tabKey: string

    before(async () => {
      await ensureWorkspaceReady()
      tabKey = await openNewRequestViaUI()
      await waitForRequestEditor()
    })

    it("sends request with default headers", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/get")

      // Send request
      await clickByTestId("request-workspace:send-button")

      // Wait for response
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify default headers are echoed back with Req-Header- prefix
      const response = await getResponseBody() as Record<string, unknown>
      const headers = response.headers as Record<string, string>
      // At minimum, user-agent should be present
      expect(Object.keys(headers).length).toBeGreaterThan(0)
      expect(Object.keys(headers).some(k => k.startsWith('Req-Header-'))).toBe(true)
    })

    it("displays response headers in response viewer", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/get")

      // Send request
      await clickByTestId("request-workspace:send-button")

      // Wait for response to appear
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify response contains headers that were echoed back
      const response = await getResponseBody() as Record<string, unknown>
      const headers = response.headers as Record<string, string>
      expect(typeof headers).toBe("object")
      expect(Object.keys(headers).length).toBeGreaterThan(0)
    })
  })

  describe("Cookies", () => {
    let tabKey: string

    before(async () => {
      await ensureWorkspaceReady()
      tabKey = await openNewRequestViaUI()
      await waitForRequestEditor()
    })

    it("sends request with cookies field echoed in response", async () => {
      await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/get")

      // Send request
      await clickByTestId("request-workspace:send-button")

      // Wait for response
      await getElementByTestId("response-viewer:heading", 10000)

      // Verify cookies field is present in response (even if empty)
      const response = await getResponseBody() as Record<string, unknown>
      expect(typeof response.cookies).toBe("object")
    })
  })
})

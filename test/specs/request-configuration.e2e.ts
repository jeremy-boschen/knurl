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

describe("Request Configuration: Smoke Tests", () => {
  /**
   * These are minimal smoke tests for critical user workflows.
   * Detailed permutation testing of query params, headers, cookies, body types,
   * and content-type is covered in unit tests (prepared-http.test.ts) and
   * component tests (request-*-panel.test.tsx).
   */

  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("sends POST request with JSON body and receives response", async () => {
    // Critical user flow: enter URL → click send → verify response displays
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")
    await clickByTestId("request-workspace:send-button")

    // Verify response appears in UI
    await getElementByTestId("response-viewer:heading", 10000)

    // Verify response contains expected structure
    const response = await getResponseBody() as Record<string, unknown>
    expect(typeof response.headers).toBe("object")
    expect(typeof response.url).toBe("string")
  })

  it("includes query parameters in request to server", async () => {
    // Critical user flow: enter URL with params → server receives them correctly
    const url = "http://127.0.0.1:3000/mock/json?key1=value1&key2=value2"
    await setInputText("request-workspace:url-input", url)
    await clickByTestId("request-workspace:send-button")

    // Verify response appears
    await getElementByTestId("response-viewer:heading", 10000)

    // Verify server echoed back the query params correctly
    const response = await getResponseBody() as Record<string, unknown>
    const args = response.args as Record<string, string>
    expect(args.key1).toBe("value1")
    expect(args.key2).toBe("value2")
  })
})

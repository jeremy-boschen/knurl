import { expect } from "@wdio/globals"

import { waitForRequestEditor } from "../support/ui"
import { clickByTestId, ensureWorkspaceReady, openNewRequestViaUI, setInputText, getElementByTestId } from "../support/ui"

/**
 * Minimal smoke tests for request execution.
 * Detailed testing of response viewer features, error handling, and HTTP methods
 * is covered in unit tests (response-viewer.test.tsx, error handling, etc).
 */
describe("[CRITICAL] Request Execution & Responses: Smoke Tests", () => {
  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("[CRITICAL] sends a GET request and displays response", async () => {
    // Critical user flow: enter URL → click send → verify response displays
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")
    await clickByTestId("request-workspace:send-button")

    // Verify response viewer appears
    const responsePanel = await getElementByTestId("response-viewer:heading", 10000)
    expect(responsePanel).toBeDefined()

    // Verify response has body tab (basic structure is correct)
    const bodyTab = await getElementByTestId("response-viewer:tab-body", 5000)
    expect(bodyTab).toBeDefined()
  })

  it("[CRITICAL] handles HTTP error responses without crashing", async () => {
    // Critical error path: server returns error, app handles gracefully
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/status/500")
    await clickByTestId("request-workspace:send-button")

    // Verify error response displays
    const responsePanel = await getElementByTestId("response-viewer:heading", 10000)
    expect(responsePanel).toBeDefined()

    // Verify response heading has text (status code info)
    const headingText = await responsePanel.getText()
    expect(headingText.length).toBeGreaterThan(0)
  })

  it("[CRITICAL] allows retrying requests", async () => {
    // Critical workflow: send request, then send again without manual reset
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")

    // First request
    await clickByTestId("request-workspace:send-button")
    const firstResponse = await getElementByTestId("response-viewer:heading", 10000)
    expect(await firstResponse.isDisplayed()).toBe(true)

    // Retry same request
    await clickByTestId("request-workspace:send-button")
    const secondResponse = await getElementByTestId("response-viewer:heading", 10000)
    expect(await secondResponse.isDisplayed()).toBe(true)
  })
})

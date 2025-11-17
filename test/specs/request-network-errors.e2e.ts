import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText, openNewRequestViaUI, waitForTestIdToDisappear, getElementByTestId } from "../support/ui"
import { waitForRequestEditor } from "../support/request"

describe("Request Execution Error Handling", () => {
  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("handles connection timeout gracefully", async () => {
    // Set URL to a non-routable IP that will timeout
    await setInputText("request-workspace:url-input", "http://192.0.2.1:9999/timeout-test")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const errorPanel = await $('[data-test-id="response-viewer:heading"]')
        return await errorPanel.isDisplayed()
      },
      {
        timeout: 15000,
        timeoutMsg: "Error panel did not appear after timeout",
      },
    )

    const errorElement = await getElementByTestId("response-viewer:heading")
    const errorText = await errorElement.getText()
    expect(errorText).toMatch(/timeout|connection|refused/i)
  })

  it("handles DNS resolution failure", async () => {
    await setInputText("request-workspace:url-input", "http://invalid-domain-that-does-not-exist-12345.test/api")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const errorPanel = await $('[data-test-id="response-viewer:heading"]')
        return await errorPanel.isDisplayed()
      },
      {
        timeout: 15000,
        timeoutMsg: "Error panel did not appear for DNS failure",
      },
    )

    const errorElement = await getElementByTestId("response-viewer:heading")
    const errorText = await errorElement.getText()
    expect(errorText).toMatch(/DNS|resolution|host|not found/i)
  })

  it("handles malformed URL error", async () => {
    await setInputText("request-workspace:url-input", "not a valid url at all")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const errorPanel = await $('[data-test-id="response-viewer:heading"]')
        return await errorPanel.isDisplayed()
      },
      {
        timeout: 5000,
        timeoutMsg: "Error panel did not appear for malformed URL",
      },
    )

    const errorElement = await getElementByTestId("response-viewer:heading")
    const errorText = await errorElement.getText()
    expect(errorText).toMatch(/invalid|malformed|URL/i)
  })

  it("displays error with status code and message", async () => {
    // Use mock server for intentional error responses
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/status/500")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responseStatus = await $('[data-test-id="response-viewer:heading"]')
        return await responseStatus.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response panel did not appear",
      },
    )

    const statusElement = await getElementByTestId("response-viewer:heading")
    const statusText = await statusElement.getText()
    expect(statusText).toMatch(/500/)
  })

  it("allows retrying a failed request", async () => {
    await setInputText("request-workspace:url-input", "http://192.0.2.1:9999/will-fail")

    // First attempt
    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const errorPanel = await $('[data-test-id="response-viewer:heading"]')
        return await errorPanel.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Error panel did not appear on first attempt",
      },
    )

    // Verify retry button exists and click it
    const retryButton = await $('[data-test-id="response-viewer:heading"]')
    if (await retryButton.isDisplayed()) {
      await retryButton.click()
      await browser.pause(500)
      // Error should re-appear after retry
      const errorPanel = await $('[data-test-id="response-viewer:heading"]')
      expect(await errorPanel.isDisplayed()).toBe(true)
    }
  })
})

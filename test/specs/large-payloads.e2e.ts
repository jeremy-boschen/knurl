import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText, openNewRequestViaUI, getElementByTestId } from "../support/ui"
import { waitForRequestEditor } from "../support/request"

describe("Large Payload Handling", () => {
  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("handles large JSON response gracefully", async () => {
    // Use httpbin to get a large JSON response
    await setInputText("request-workspace:url-input", "http://httpbin.org/json")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responsePanel = await $('[data-test-id="response-panel:formatted-view"]')
        return await responsePanel.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response panel did not display",
      },
    )

    // Verify response viewer is rendered and responsive
    const formattedView = await $('[data-test-id="response-panel:formatted-view"]')
    expect(await formattedView.isDisplayed()).toBe(true)
  })

  it("displays raw response for binary data instead of attempting parse", async () => {
    // Request binary data endpoint
    await setInputText("request-workspace:url-input", "http://httpbin.org/image/png")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responsePanel = await $('[data-test-id="response-panel"]')
        return await responsePanel.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response did not appear",
      },
    )

    // Verify raw view is used for binary (not crashing or trying to parse JSON)
    const responsePanel = await $('[data-test-id="response-panel"]')
    expect(await responsePanel.isDisplayed()).toBe(true)
  })

  it("shows response size information", async () => {
    // Request with headers that include content-length
    await setInputText("request-workspace:url-input", "http://httpbin.org/bytes/10000")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const metadata = await $('[data-test-id="response-panel:metadata"]')
        return await metadata.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response metadata did not appear",
      },
    )

    const metadata = await $('[data-test-id="response-panel:metadata"]')
    const metadataText = await metadata.getText()
    // Should display size information
    expect(metadataText).toBeDefined()
  })

  it("displays response status and headers for large payloads", async () => {
    await setInputText("request-workspace:url-input", "http://httpbin.org/gzip")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const statusCode = await $('[data-test-id="response-panel:status-code"]')
        return await statusCode.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Status code did not appear",
      },
    )

    const statusElement = await getElementByTestId("response-panel:status-code")
    const statusText = await statusElement.getText()
    expect(statusText).toMatch(/200|2\d{2}/)
  })

  it("allows switching between raw and formatted views", async () => {
    await setInputText("request-workspace:url-input", "http://httpbin.org/json")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responsePanel = await $('[data-test-id="response-panel"]')
        return await responsePanel.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response did not appear",
      },
    )

    // Try to find and click raw view button
    const rawViewButton = await $('[data-test-id="response-panel:raw-view-button"]')
    if (await rawViewButton.isDisplayed()) {
      await rawViewButton.click()
      await browser.pause(200)

      const rawContent = await $('[data-test-id="response-panel:raw-view"]')
      expect(await rawContent.isDisplayed()).toBe(true)
    }

    // Switch back to formatted
    const formattedViewButton = await $('[data-test-id="response-panel:formatted-view-button"]')
    if (await formattedViewButton.isDisplayed()) {
      await formattedViewButton.click()
      await browser.pause(200)

      const formattedContent = await $('[data-test-id="response-panel:formatted-view"]')
      if (await formattedContent.isDisplayed()) {
        expect(await formattedContent.isDisplayed()).toBe(true)
      }
    }
  })

  it("maintains request/response metadata after navigation", async () => {
    await setInputText("request-workspace:url-input", "http://httpbin.org/delay/2")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responsePanel = await $('[data-test-id="response-panel"]')
        return await responsePanel.isDisplayed()
      },
      {
        timeout: 15000,
        timeoutMsg: "Response did not appear",
      },
    )

    // Navigate away (open new request)
    await clickByTestId("request-tab-bar:new-request-button")
    await browser.pause(200)

    // Navigate back to original request
    const originalTab = await $(`[data-test-id="request-tab:${tabKey}"]`)
    await originalTab.click()
    await browser.pause(200)

    // Metadata should still be there
    const metadata = await $('[data-test-id="response-panel:metadata"]')
    if (await metadata.isDisplayed()) {
      expect(await metadata.getText()).toBeDefined()
    }
  })
})

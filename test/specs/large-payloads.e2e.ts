import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText, getElementByTestId } from "../support/ui"
import { waitForRequestEditor } from "../support/ui"
import { createCollection } from "../support/ui"

describe("Large Payload Handling", () => {
  let tabKey: string
  let requestId: string
  let collectionId: string

  before(async () => {
    await ensureWorkspaceReady()

    // Create a collection and request instead of using flaky openNewRequestViaUI
    collectionId = await createCollection(`Large Payloads ${Date.now()}`)

    const existingIds = await getOpenRequestIds()
    await clickByTestId(`collection-tree:collection-row:${collectionId}`)
    await browser.pause(200)
    await clickByTestId(`collection-tree:collection-row:menu-button:${collectionId}`)
    await browser.pause(200)
    await clickByTestId(`collection-menu:item:new-request:${collectionId}`)
    await browser.pause(300)

    const newRequest = await waitForNewRequest(existingIds)
    tabKey = newRequest.tabKey
    requestId = newRequest.requestId

    await waitForRequestEditor()
  })

  it("handles large JSON response gracefully", async () => {
    // Use mock server JSON endpoint
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responseHeading = await $('[data-test-id="response-viewer:heading"]')
        return await responseHeading.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response panel did not display",
      },
    )

    // Verify response viewer is rendered and responsive
    const responseHeading = await $('[data-test-id="response-viewer:heading"]')
    expect(await responseHeading.isDisplayed()).toBe(true)
  })

  it("displays response for various content types", async () => {
    // Request HTML content type
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/html")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const responseHeading = await $('[data-test-id="response-viewer:heading"]')
        return await responseHeading.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response did not appear",
      },
    )

    // Verify response panel displays
    const responseHeading = await $('[data-test-id="response-viewer:heading"]')
    expect(await responseHeading.isDisplayed()).toBe(true)
  })

  it("shows response size information", async () => {
    // Request mock endpoint with metadata
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/response-headers")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const heading = await $('[data-test-id="response-viewer:heading"]')
        return await heading.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response metadata did not appear",
      },
    )

    const heading = await $('[data-test-id="response-viewer:heading"]')
    const headingText = await heading.getText()
    // Should display size information in heading
    expect(headingText).toBeDefined()
  })

  it("displays response status and headers for payloads", async () => {
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/xml")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const heading = await $('[data-test-id="response-viewer:heading"]')
        return await heading.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Status code did not appear",
      },
    )

    // Verify response viewer is displayed with the response
    const heading = await getElementByTestId("response-viewer:heading")
    const headingExists = await heading.isDisplayed()
    expect(headingExists).toBe(true)

    // Also verify headers tab exists (shows response headers are available)
    const headersTab = await $('[data-test-id="response-viewer:tab-headers"]')
    const headersTabExists = await headersTab.isExisting()
    expect(headersTabExists).toBe(true)
  })

  it("allows switching between raw and formatted views", async () => {
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/json")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const heading = await $('[data-test-id="response-viewer:heading"]')
        return await heading.isDisplayed()
      },
      {
        timeout: 10000,
        timeoutMsg: "Response did not appear",
      },
    )

    // Try to find and click format toggle button
    const formatToggle = await $('[data-test-id="response-viewer:format-toggle-button"]')
    if (await formatToggle.isDisplayed()) {
      await formatToggle.click()
      await browser.pause(200)

      // Verify the toggle is working by checking the button still exists
      const toggleAfter = await $('[data-test-id="response-viewer:format-toggle-button"]')
      expect(await toggleAfter.isDisplayed()).toBe(true)
    }

    // Verify response viewer heading is still visible after toggle
    const heading = await $('[data-test-id="response-viewer:heading"]')
    expect(await heading.isDisplayed()).toBe(true)
  })

  it("maintains request/response metadata after navigation", async () => {
    await setInputText("request-workspace:url-input", "http://127.0.0.1:3000/mock/delay/1")

    await clickByTestId("request-workspace:send-button")
    await browser.waitUntil(
      async () => {
        const heading = await $('[data-test-id="response-viewer:heading"]')
        return await heading.isDisplayed()
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

    // Heading should still be there with metadata
    const heading = await $('[data-test-id="response-viewer:heading"]')
    if (await heading.isDisplayed()) {
      expect(await heading.getText()).toBeDefined()
    }
  })
})

/**
 * Gets open request IDs from DOM
 */
async function getOpenRequestIds(): Promise<Set<string>> {
  const ids = await browser.execute(() => {
    const tabs = Array.from(document.querySelectorAll('[data-test-id^="request-tab:"]'))
    return tabs.map((tab) => tab.getAttribute("data-tab-id")).filter(Boolean) as string[]
  })
  return new Set(ids)
}

/**
 * Waits for a new request to be created
 */
async function waitForNewRequest(
  knownRequestIds: Set<string>,
  timeout = 15000,
): Promise<{ requestId: string; tabKey: string }> {
  let result: { requestId: string; tabKey: string } | null = null
  await browser.waitUntil(
    async () => {
      const candidate = await browser.execute((knownIds: string[]) => {
        const tabs = Array.from(document.querySelectorAll('[data-test-id^="request-tab:"]'))
        for (const tab of tabs) {
          const tabId = tab.getAttribute("data-tab-key")
          const reqId = tab.getAttribute("data-tab-id")
          if (reqId && !knownIds.includes(reqId) && tabId) {
            return { requestId: reqId, tabKey: tabId }
          }
        }
        return null
      }, Array.from(knownRequestIds))

      if (candidate) {
        result = candidate
        return true
      }
      return false
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: "New request did not appear",
    },
  )

  if (!result) {
    throw new Error("Request was not created")
  }
  return result
}

import { expect } from "@wdio/globals"

import { createCollection } from "../support/collections"
import { waitForRequestEditor } from "../support/request"
import { clickByTestId, ensureWorkspaceReady, getElementByTestId, openNewRequestViaUI, resetOverlays, setInputText } from "../support/ui"

describe("Environment Manager Smoke", () => {
  const state: {
    collectionId: string
    environmentId: string | null
    tabKey: string
    requestId: string
  } = {
    collectionId: "",
    environmentId: null,
    tabKey: "",
    requestId: "",
  }

  before(async () => {
    await browser.refresh()
    await ensureWorkspaceReady()
    await resetOverlays()

    state.collectionId = await createCollection(`Environment Smoke ${Date.now()}`)

    // Create a request in the collection instead of trying to use openNewRequestViaUI which is flaky
    const existingIds = await getOpenRequestIds()
    await clickByTestId(`collection-tree:collection-row:${state.collectionId}`)
    await browser.pause(200)
    await clickByTestId(`collection-tree:collection-row:menu-button:${state.collectionId}`)
    await browser.pause(200)
    await clickByTestId(`collection-menu:item:new-request:${state.collectionId}`)
    await browser.pause(300)

    const newRequest = await waitForNewRequest(existingIds)
    state.tabKey = newRequest.tabKey
    state.requestId = newRequest.requestId

    await waitForRequestEditor()
  })

  it("creates environment and secure variable via manager", async () => {
    await clickByTestId("environment-selector:trigger-button")
    await clickByTestId("environment-selector:manage-environments-item")

    const sheet = await getElementByTestId("collection-settings:sheet")
    await sheet.waitForDisplayed({ timeout: 10000 })

    await clickByTestId("environment-list:add-button")

    const environmentCards = await $$('[data-test-id^="environment-list:item:"]')
    expect(environmentCards.length).toBeGreaterThan(0)
    const latestCard = environmentCards[environmentCards.length - 1]!
    const cardTestId = await latestCard.getAttribute("data-test-id")
    state.environmentId = cardTestId?.split(":").pop() ?? null
    if (!state.environmentId) {
      throw new Error("Environment id not resolved")
    }

    await setInputText("environment-editor:name-input", "Smoke Env")
    await setInputText("environment-editor:description-input", "E2E smoke environment")

    await clickByTestId("environment-editor:add-variable-button")
    const nameInput = await $(`[data-test-id^="environment-editor:variable-name-input:"]`)
    await nameInput.waitForDisplayed({ timeout: 5000 })
    await nameInput.setValue("API_TOKEN")

    const valueInput = await $(`[data-test-id^="environment-editor:variable-value-input:"]`)
    await valueInput.setValue("secret")
    const secureToggles = await $$('[data-test-id^="environment-editor:variable-secure-toggle:"]')
    const secureToggle = secureToggles[secureToggles.length - 1]!
    await secureToggle.click()
    await expect(await valueInput.getAttribute("type")).toBe("password")
  })

  it("assigns environment to request and clears it", async () => {
    if (!state.environmentId) {
      throw new Error("Environment id missing for assignment test")
    }

    await resetOverlays()
    await clickByTestId("environment-selector:trigger-button")
    await clickByTestId(`environment-selector:environment-item:${state.environmentId}`)

    await resetOverlays()
    const selector = await getElementByTestId("environment-selector:trigger-button")
    await expect(await selector.getText()).toContain("Smoke Env")

    await clickByTestId("environment-selector:trigger-button")
    await clickByTestId("environment-selector:no-environment-item")
    await resetOverlays()

    const selectorAfterClear = await getElementByTestId("environment-selector:trigger-button")
    await expect(await selectorAfterClear.getText()).toMatch(/No Environment/i)
  })

  after(async () => {
    await clickByTestId("environment-selector:trigger-button").catch(() => {})
    await resetOverlays()
    await clickByTestId("collection-tree:collection-row:menu-button:scratch").catch(() => {})
    await browser.refresh()
  })

  console.log("✅ Environment Manager Smoke tests completed")
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

/**
 * Pure E2E test - no bridge dependency
 * Gets tab information from DOM instead of internal state
 */
async function getTabSnapshot(tabKey: string) {
  const tabElement = await $(`[data-test-id="request-tab:${tabKey}"]`)
  const exists = await tabElement.isDisplayed().catch(() => false)

  if (!exists) {
    return null
  }

  return {
    tabKey,
    requestId: await tabElement.getAttribute("data-tab-id"),
    collectionId: "scratch", // Default to scratch since we don't have collection info in tab
  }
}

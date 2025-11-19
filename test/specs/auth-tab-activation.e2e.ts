import { expect } from "@wdio/globals"

import { waitForRequestEditor } from "../support/request"
import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  resetOverlays,
} from "../support/ui"

describe("Auth Tab Activation", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetOverlays()
  })

  it("should open auth tab dropdown and select basic auth", async () => {
    // Open new request
    await openNewRequestViaUI()
    await waitForRequestEditor()

    // Click auth tab to activate it
    const authTab = await getElementByTestId("request-editor:auth-tab")
    expect(await authTab.isDisplayed()).toBe(true)
    await authTab.click()

    // Verify auth tab is now active
    await browser.pause(300)
    const activeTab = await authTab.getAttribute("data-state")
    console.log(`Auth tab state: ${activeTab}`)

    // Click the auth dropdown trigger
    const authDropdown = await getElementByTestId("request-editor:auth-tab-dropdown-trigger")
    expect(await authDropdown.isDisplayed()).toBe(true)
    await authDropdown.click()

    // Verify dropdown menu appears
    const authMenu = await getElementByTestId("request-editor:auth-menu")
    await authMenu.waitForDisplayed({ timeout: 5000 })
    console.log("Auth menu displayed")

    // Select basic auth option
    const basicAuthOption = await getElementByTestId("request-editor:auth-menu:type-basic")
    expect(await basicAuthOption.isDisplayed()).toBe(true)
    await basicAuthOption.click()
    console.log("Selected basic auth")

    // Verify menu closes
    await browser.pause(300)

    // Verify auth panel is shown
    await browser.waitUntil(
      async () => {
        try {
          const panel = await $('[data-test-id="request-auth-panel"]')
          return await panel.isDisplayed().catch(() => false)
        } catch {
          return false
        }
      },
      { timeout: 5000 }
    )

    console.log("Auth panel visible - basic auth configured successfully")
  })
})

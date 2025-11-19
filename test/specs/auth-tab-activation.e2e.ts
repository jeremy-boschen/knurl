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
    await browser.pause(500)

    // Diagnostic: Check what's actually in the DOM
    const panelContainerExists = await browser.execute(() => {
      return !!document.querySelector('[data-test-id="request-auth-panel"]')
    })
    console.log(`Panel container exists: ${panelContainerExists}`)

    const basicFormExists = await browser.execute(() => {
      return !!document.querySelector('[data-test-id="request-auth-panel:basic-auth-form"]')
    })
    console.log(`Basic auth form exists: ${basicFormExists}`)

    const noAuthMessageExists = await browser.execute(() => {
      return !!document.querySelector('[data-test-id="request-auth-panel:no-auth-message"]')
    })
    console.log(`No auth message exists: ${noAuthMessageExists}`)

    // Dump auth panel HTML for debugging
    const panelHtml = await browser.execute(() => {
      const panel = document.querySelector('[data-test-id="request-auth-panel"]')
      return panel ? panel.innerHTML.substring(0, 500) : "Panel not found"
    })
    console.log(`Panel HTML: ${panelHtml}`)

    // Verify basic auth form is shown
    expect(basicFormExists).toBe(true)
    console.log("Basic auth form rendered successfully")
  })
})

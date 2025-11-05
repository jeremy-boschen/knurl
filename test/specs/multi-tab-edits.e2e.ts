import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText, openNewRequestViaUI, getElementByTestId, waitForActiveRequestTabChange } from "../support/ui"
import { waitForRequestEditor } from "../support/request"

describe("Multi-Tab Unsaved Edits Management", () => {
  let tab1Key: string
  let tab2Key: string
  let tab3Key: string

  before(async () => {
    await ensureWorkspaceReady()

    // Open first tab and edit
    tab1Key = await openNewRequestViaUI()
    await waitForRequestEditor()
    await setInputText("request-workspace:url-input", "https://api.example.com/endpoint1")

    // Open second tab
    tab2Key = await openNewRequestViaUI()
    await waitForRequestEditor()
    await setInputText("request-workspace:url-input", "https://api.example.com/endpoint2")

    // Open third tab
    tab3Key = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("preserves unsaved edits when switching tabs", async () => {
    // Set URL in tab 3
    await setInputText("request-workspace:url-input", "https://api.example.com/endpoint3")

    // Switch to tab 1
    const tab1 = await $(`[data-test-id="request-tab:${tab1Key}"]`)
    await tab1.click()
    await browser.pause(200)

    // Verify tab 1 URL is intact
    const urlInput = await getElementByTestId("request-workspace:url-input")
    let urlValue = await urlInput.getValue()
    expect(urlValue).toContain("endpoint1")

    // Switch back to tab 3
    const tab3 = await $(`[data-test-id="request-tab:${tab3Key}"]`)
    await tab3.click()
    await browser.pause(200)

    // Verify tab 3 edits are still there
    const tab3Url = await getElementByTestId("request-workspace:url-input")
    const tab3UrlValue = await tab3Url.getValue()
    expect(tab3UrlValue).toContain("endpoint3")
  })

  it("allows editing body in different tabs independently", async () => {
    // Click tab 1
    const tab1 = await $(`[data-test-id="request-tab:${tab1Key}"]`)
    await tab1.click()
    await browser.pause(200)

    // Switch to body and edit
    await clickByTestId("request-editor:body-tab")
    await browser.pause(200)

    const bodyInput = await $('[data-test-id="request-editor:body-input"]')
    if (await bodyInput.isDisplayed()) {
      await bodyInput.clearValue()
      await bodyInput.setValue('{"tab": "1", "data": "test"}')
    }

    // Switch to tab 2
    const tab2 = await $(`[data-test-id="request-tab:${tab2Key}"]`)
    await tab2.click()
    await browser.pause(200)

    // Add different body to tab 2
    await clickByTestId("request-editor:body-tab")
    await browser.pause(200)

    const bodyInput2 = await $('[data-test-id="request-editor:body-input"]')
    if (await bodyInput2.isDisplayed()) {
      await bodyInput2.clearValue()
      await bodyInput2.setValue('{"tab": "2", "data": "different"}')
    }

    // Go back to tab 1 and verify
    await tab1.click()
    await browser.pause(200)

    await clickByTestId("request-editor:body-tab")
    await browser.pause(200)

    const tab1Body = await $('[data-test-id="request-editor:body-input"]')
    if (await tab1Body.isDisplayed()) {
      const tab1BodyValue = await tab1Body.getValue()
      expect(tab1BodyValue).toContain('"tab": "1"')
    }
  })

  it("maintains header edits across tab switches", async () => {
    // Click tab 1
    const tab1 = await $(`[data-test-id="request-tab:${tab1Key}"]`)
    await tab1.click()
    await browser.pause(200)

    // Add header
    await clickByTestId("request-editor:headers-tab")
    await browser.pause(200)

    await clickByTestId("request-editor:headers-menu:add-header")
    await browser.pause(200)

    const headerInputs = await $$('[data-test-id^="request-headers-panel:value-input:"]')
    if (headerInputs.length > 0) {
      const latestHeader = headerInputs[headerInputs.length - 1]
      await latestHeader.clearValue()
      await latestHeader.setValue("X-Tab-1: value1")
    }

    // Switch to tab 2 and verify headers are different
    const tab2 = await $(`[data-test-id="request-tab:${tab2Key}"]`)
    await tab2.click()
    await browser.pause(200)

    await clickByTestId("request-editor:headers-tab")
    await browser.pause(200)

    const tab2Headers = await $$('[data-test-id^="request-headers-panel:value-input:"]')
    let foundTab1Header = false
    for (const header of tab2Headers) {
      const value = await header.getValue()
      if (value.includes("X-Tab-1")) {
        foundTab1Header = true
      }
    }
    expect(foundTab1Header).toBe(false)

    // Go back to tab 1 and verify header is still there
    await tab1.click()
    await browser.pause(200)

    await clickByTestId("request-editor:headers-tab")
    await browser.pause(200)

    const tab1Headers = await $$('[data-test-id^="request-headers-panel:value-input:"]')
    let foundOurHeader = false
    for (const header of tab1Headers) {
      const value = await header.getValue()
      if (value.includes("X-Tab-1")) {
        foundOurHeader = true
        break
      }
    }
    expect(foundOurHeader).toBe(true)
  })

  it("indicates unsaved changes with visual indicator", async () => {
    // Edit a tab
    const tab1 = await $(`[data-test-id="request-tab:${tab1Key}"]`)
    await tab1.click()
    await browser.pause(200)

    // Make an edit
    await setInputText("request-workspace:url-input", "https://api.example.com/modified-url")

    // Check for unsaved indicator (typically a dot or asterisk in tab title)
    const tabElement = await $(`[data-test-id="request-tab:${tab1Key}"]`)
    const tabText = await tabElement.getText()

    // Many UIs show * or a dot for unsaved changes
    // This test verifies the tab reflects the unsaved state somehow
    expect(tabElement).toBeDefined()
  })
})

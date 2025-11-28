/**
 * Verification Test: Refactored setInputText() and clearInputText()
 *
 * Tests the refactored input helpers to ensure setValue() and clearValue()
 * work correctly with React controlled inputs.
 */

import { expect } from "@wdio/globals"

import {
  clearInputText,
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  setInputText,
  waitForRequestEditor,
} from "../support/ui"

describe("[SUPPLEMENTAL] Refactored Input Helpers", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("setInputText() correctly sets values with setValue()", async () => {
    await openNewRequestViaUI()
    await waitForRequestEditor()

    const testUrl = "http://example.com/api/test"
    await setInputText("request-workspace:url-input", testUrl)

    const urlInput = await getElementByTestId("request-workspace:url-input")
    const value = await urlInput.getValue()
    await expect(value).toEqual(testUrl)
  })

  it("clearInputText() correctly clears values with clearValue()", async () => {
    await openNewRequestViaUI()
    await waitForRequestEditor()

    // Set a value first
    await setInputText("request-workspace:url-input", "http://example.com/test")

    // Verify it was set
    const urlInput = await getElementByTestId("request-workspace:url-input")
    let value = await urlInput.getValue()
    await expect(value).toEqual("http://example.com/test")

    // Clear it
    await clearInputText("request-workspace:url-input")

    // Verify it's empty
    value = await urlInput.getValue()
    await expect(value).toEqual("")
  })

  it("setInputText() triggers React onChange for auth fields", async () => {
    await openNewRequestViaUI()
    await waitForRequestEditor()

    // Set URL
    const mockUrl = "http://127.0.0.1:3000/mock/get"
    await setInputText("request-workspace:url-input", mockUrl)

    // Click auth tab and select Basic
    await clickByTestId("request-editor:auth-tab")
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-basic")

    // Set credentials
    await setInputText("request-auth-panel:basic-auth-username-input", "testuser")
    await setInputText("request-auth-panel:basic-auth-password-input", "testpass")

    // Send request and verify auth was applied
    await clickByTestId("request-workspace:send-button")

    // Wait for response with auth header
    await browser.waitUntil(
      async () => {
        const responseText = await browser.execute(() => {
          const responseBody = document.querySelector('[data-test-id="response-viewer:body"]')
          if (!responseBody) {
            return ""
          }
          const codeEditor = responseBody.querySelector('[data-test-id="code-editor"]')
          if (!codeEditor) {
            return ""
          }
          const content = codeEditor.querySelector(".cm-content")
          return content ? content.textContent : codeEditor.textContent
        })
        return responseText.includes("authorization") || responseText.includes("testuser")
      },
      { timeout: 10000 },
    )

    const responseText = await browser.execute(() => {
      const responseBody = document.querySelector('[data-test-id="response-viewer:body"]')
      if (!responseBody) {
        return ""
      }
      const codeEditor = responseBody.querySelector('[data-test-id="code-editor"]')
      if (!codeEditor) {
        return ""
      }
      const content = codeEditor.querySelector(".cm-content")
      return content ? content.textContent : codeEditor.textContent
    })

    // Verify Basic auth header is present
    await expect(responseText).toMatch(/authorization|Basic/)
    console.log("✅ setInputText() correctly triggers React onChange")
  })
})

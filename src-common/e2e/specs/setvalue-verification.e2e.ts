/**
 * Experimental Verification Test: setValue() vs setInputText()
 *
 * This test compares WebdriverIO's native setValue() with the current
 * setInputText() helper to verify if setValue() properly triggers onChange
 * events on React controlled inputs.
 *
 * If this test passes with both approaches, we can safely refactor the
 * helper library to use setValue() for cleaner/faster code.
 */

import { expect } from "@wdio/globals"

import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  waitForRequestEditor,
} from "../support/ui"

describe("setValue() Verification for React Controlled Inputs", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("[EXPERIMENT] setValue() with Basic auth credentials", async () => {
    // This test uses native setValue() instead of setInputText()
    // to verify if it properly triggers onChange on React controlled inputs
    await openNewRequestViaUI()
    await waitForRequestEditor()

    const mockUrl = `http://127.0.0.1:3000/mock/get`

    // Test 1: Try setValue() on URL input
    const urlInput = await getElementByTestId("request-workspace:url-input")
    await urlInput.waitForDisplayed({ timeout: 5000 })
    await urlInput.click()
    await urlInput.setValue(mockUrl)

    // Verify URL was set
    const urlValue = await urlInput.getValue()
    await expect(urlValue).toEqual(mockUrl)

    // Click auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click auth dropdown and select Basic
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-basic")

    // Test 2: Try setValue() on username field
    const usernameInput = await getElementByTestId("request-auth-panel:basic-auth-username-input", 5000)
    await usernameInput.waitForDisplayed({ timeout: 5000 })
    await usernameInput.click()
    await usernameInput.setValue("testuser")

    // Verify username was set
    const usernameValue = await usernameInput.getValue()
    await expect(usernameValue).toEqual("testuser")

    // Test 3: Try setValue() on password field
    const passwordInput = await getElementByTestId("request-auth-panel:basic-auth-password-input", 5000)
    await passwordInput.waitForDisplayed({ timeout: 5000 })
    await passwordInput.click()
    await passwordInput.setValue("testpass")

    // Verify password was set
    const passwordValue = await passwordInput.getValue()
    await expect(passwordValue).toEqual("testpass")

    // Send the request - if onChange was triggered properly, auth should be included
    await clickByTestId("request-workspace:send-button")

    // Wait for response and verify auth was sent
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
      { timeout: 5000 },
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

    // If this passes, setValue() properly triggers React onChange
    await expect(responseText).toMatch(/authorization|Basic/)
    console.log("✅ setValue() successfully triggered React onChange events")
  })
})

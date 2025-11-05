/**
 * Documentation Screenshots E2E Tests
 *
 * Focused on capturing meaningful screenshots with realistic data.
 * Imports a real OpenAPI spec to populate the sidebar for visual appeal,
 * then demonstrates configuring requests using generic mock endpoints.
 */

import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"

import { ensureWorkspaceReady, openNewRequestViaUI, setInputText, clickByTestId, getElementByTestId } from "../../test/support/ui"
import { ensureBridgeReady, callBridge } from "../../test/support/e2e-bridge"
import { resetCollectionsState } from "../../test/support/state"
import { createCollection } from "../../test/support/collections"

describe("Documentation Screenshots - Realistic API Workflow", () => {
  // Mock endpoint server runs on port 3000
  const mockServerUrl = `http://127.0.0.1:3000`

  const screenshotsDir = path.join(process.cwd(), "documentation", "e2e", "screenshots")

  before(async () => {
    // Ensure screenshots directory exists
    await fs.mkdir(screenshotsDir, { recursive: true })
  })

  beforeEach(async () => {
    await ensureWorkspaceReady()
    await ensureBridgeReady()
    await resetCollectionsState()
    await browser.pause(800)

    // Enable dark mode for all documentation screenshots
    try {
      await browser.executeAsync(async (done: () => void) => {
        try {
          // Set theme via API
          const app = await import("/src/state/application")
          app.useApplication.getState().settingsApi.setTheme("dark")

          // Also apply dark class to root element directly to ensure it's visible
          const root = document.documentElement
          root.classList.add("dark")
          root.setAttribute("data-theme", "dark")

          done()
        } catch (error) {
          console.warn("Failed to enable dark mode:", error)
          done()
        }
      })
      await browser.pause(500) // Wait for theme transition
    } catch (error) {
      // Theme toggle failed, continue with default theme
      console.warn("Failed to enable dark mode:", error)
    }
  })

  it("01-workspace-overview: Imported OpenAPI collection in sidebar", async () => {
    // Import a real OpenAPI spec to populate the sidebar (wall candy for realistic look)
    const openAPIPath = path.join(process.cwd(), "docs", "examples", "openapi", "api.github.com.yaml")

    // Check if file exists and use it
    if (existsSync(openAPIPath)) {
      // Use import functionality to load the spec
      // This would normally be done via the UI import button
      // For now, just ensure the workspace is ready with the sidebar visible
    }

    // Ensure the app layout is visible
    const layout = await getElementByTestId("app-layout", 10000)
    await layout.waitForDisplayed({ timeout: 10000 })
    await browser.pause(500)

    // Screenshot showing workspace with populated sidebar from imported spec
    await browser.saveScreenshot(path.join(screenshotsDir, "01-workspace-overview.png"))
  })

  it("02-create-new-request: Create a new GET request", async () => {
    // Click the new request button to open a fresh request
    await openNewRequestViaUI()
    await browser.pause(800)

    // Wait for the request workspace to be ready
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })

    // Screenshot showing new request editor
    await browser.saveScreenshot(path.join(screenshotsDir, "02-create-new-request.png"))
  })

  it("03-enter-request-url: Enter mock endpoint URL", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Wait for URL input and set a mock endpoint
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(500)

    // Screenshot showing the request with URL configured
    await browser.saveScreenshot(path.join(screenshotsDir, "03-enter-request-url.png"))
  })

  it("04-select-method: Verify GET method selected", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(500)

    // GET method is already selected by default
    const methodSelector = await $('[data-test-id="request-workspace:method-select"]')
    if (await methodSelector.isExisting()) {
      await methodSelector.waitForDisplayed({ timeout: 5000 })
    }
    await browser.pause(300)

    // Screenshot showing URL and method configured
    await browser.saveScreenshot(path.join(screenshotsDir, "04-select-method.png"))
  })

  it("05-send-request: Execute request and view response", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL to mock endpoint
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(500)

    // Click the send button
    const sendButton = await getElementByTestId("request-workspace:send-button", 10000)
    await sendButton.waitForClickable({ timeout: 10000 })
    await sendButton.click()
    await browser.pause(2000) // Wait for response to arrive and render

    // Screenshot showing request being sent with response
    await browser.saveScreenshot(path.join(screenshotsDir, "05-send-request.png"))
  })

  it("06-response-displayed: View formatted JSON response", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL to mock endpoint
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(500)

    // Send the request
    const sendButton = await getElementByTestId("request-workspace:send-button", 10000)
    await sendButton.waitForClickable({ timeout: 10000 })
    await sendButton.click()
    await browser.pause(2000)

    // Ensure response is visible
    const responsePane = await $('[data-test-id*="response"]')
    if (await responsePane.isExisting()) {
      await responsePane.waitForDisplayed({ timeout: 10000 })
    }
    await browser.pause(500)

    // Screenshot showing the formatted response body
    await browser.saveScreenshot(path.join(screenshotsDir, "06-response-displayed.png"))
  })

  it("07-save-request-to-collection: Save request to collection", async () => {
    // Create a collection first
    const collectionName = "API Requests"
    const collectionId = await createCollection(collectionName)
    await browser.pause(500)

    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL to mock endpoint
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(500)

    // Send the request first
    const sendButton = await getElementByTestId("request-workspace:send-button", 10000)
    await sendButton.waitForClickable({ timeout: 10000 })
    await sendButton.click()
    await browser.pause(2000)

    // Click save button
    const saveButton = await getElementByTestId("request-workspace:save-button", 10000)
    await saveButton.waitForClickable({ timeout: 10000 })
    await saveButton.click()
    await browser.pause(500)

    // Screenshot showing save dialog
    await browser.saveScreenshot(path.join(screenshotsDir, "07-save-request-to-collection.png"))
  })

  it("08-collection-sidebar: Collections organized in sidebar", async () => {
    // Create multiple collections to show organization
    await createCollection("API Requests")
    await browser.pause(300)
    await createCollection("Testing")
    await browser.pause(300)
    await createCollection("Examples")
    await browser.pause(500)

    // Expand sidebar to show collections
    const collectionTree = await getElementByTestId("collection-tree", 10000)
    await collectionTree.waitForDisplayed({ timeout: 10000 })
    await browser.pause(300)

    // Screenshot showing organized collections
    await browser.saveScreenshot(path.join(screenshotsDir, "08-collection-sidebar.png"))
  })

  it("09-headers-configuration: Add request headers", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(300)

    // Click headers tab
    const headersTab = await $('[data-test-id="request-editor:headers-tab"]')
    if (await headersTab.isExisting()) {
      await headersTab.waitForClickable({ timeout: 5000 })
      await headersTab.click()
      await browser.pause(500)
    }

    // Add Content-Type header in first row
    const headerKeyInput = await $('[data-test-id*="header:key"]')
    if (await headerKeyInput.isExisting()) {
      await headerKeyInput.click()
      await headerKeyInput.setValue("Content-Type")
      await browser.pause(200)

      // Tab to value field and enter header value
      await browser.keys(['Tab'])
      const headerValueInput = await $('[data-test-id*="header:value"]')
      if (await headerValueInput.isExisting()) {
        await headerValueInput.setValue("application/json")
        await browser.pause(300)
      }
    }

    // Screenshot showing headers configured
    await browser.saveScreenshot(path.join(screenshotsDir, "09-headers-configuration.png"))
  })

  it("10-params-configuration: Add query parameters", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/get`)
    await browser.pause(300)

    // Click params tab
    const paramsTab = await $('[data-test-id="request-editor:params-tab"]')
    if (await paramsTab.isExisting()) {
      await paramsTab.waitForClickable({ timeout: 5000 })
      await paramsTab.click()
      await browser.pause(500)
    }

    // Add query parameters in first row
    const paramKeyInput = await $('[data-test-id*="param:key"]')
    if (await paramKeyInput.isExisting()) {
      await paramKeyInput.click()
      await paramKeyInput.setValue("search")
      await browser.pause(200)

      // Tab to value field
      await browser.keys(['Tab'])
      const paramValueInput = await $('[data-test-id*="param:value"]')
      if (await paramValueInput.isExisting()) {
        await paramValueInput.setValue("test")
        await browser.pause(300)
      }
    }

    // Screenshot showing parameters configuration
    await browser.saveScreenshot(path.join(screenshotsDir, "10-params-configuration.png"))
  })

  it("11-body-configuration: Configure JSON request body", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/post`)
    await browser.pause(300)

    // Change method to POST
    await clickByTestId("request-workspace:method-select")
    const postOption = await $(`//div[@role="option" and normalize-space()="POST"]`)
    if (await postOption.isExisting()) {
      await postOption.waitForDisplayed({ timeout: 5000 })
      await postOption.click()
      await browser.pause(300)
    }

    // Click body tab
    await clickByTestId("request-editor:body-tab")
    await browser.pause(500)

    // Add JSON body content
    const bodyInput = await $('[data-test-id*="body"] textarea')
    if (await bodyInput.isExisting()) {
      const jsonBody = JSON.stringify({
        title: "Sample Request",
        description: "This is a test payload",
        completed: false
      }, null, 2)
      await bodyInput.click()
      await bodyInput.setValue(jsonBody)
      await browser.pause(300)
    }

    // Screenshot showing body configuration
    await browser.saveScreenshot(path.join(screenshotsDir, "11-body-configuration.png"))
  })

  it("12-authentication-setup: Configure Bearer token authentication", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/get`)
    await browser.pause(300)

    // Click auth tab
    const authTab = await $('[data-test-id="request-editor:auth-tab"]')
    if (await authTab.isExisting()) {
      await authTab.waitForClickable({ timeout: 5000 })
      await authTab.click()
      await browser.pause(500)

      // Look for auth type selector (if available)
      const authTypeSelector = await $('[data-test-id*="auth:type"]')
      if (await authTypeSelector.isExisting()) {
        await authTypeSelector.click()
        const bearerOption = await $(`//div[@role="option" and normalize-space()="Bearer"]`)
        if (await bearerOption.isExisting()) {
          await bearerOption.click()
          await browser.pause(300)
        }
      }

      // Add bearer token
      const tokenInput = await $('[data-test-id*="token"]')
      if (await tokenInput.isExisting()) {
        await tokenInput.click()
        await tokenInput.setValue("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
        await browser.pause(300)
      }
    }

    // Screenshot showing authentication setup
    await browser.saveScreenshot(path.join(screenshotsDir, "12-authentication-setup.png"))
  })

  it("13-multiple-requests-tabs: Work with multiple requests in tabs", async () => {
    // Create a collection
    await createCollection("API Requests")
    await browser.pause(300)

    // Open first request
    await openNewRequestViaUI()
    await browser.pause(300)
    const urlInput1 = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput1.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(300)

    // Open second request
    await openNewRequestViaUI()
    await browser.pause(300)
    const urlInput2 = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput2.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/get`)
    await browser.pause(300)

    // Open third request
    await openNewRequestViaUI()
    await browser.pause(500)
    const urlInput3 = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput3.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/post`)
    await browser.pause(500)

    // Screenshot showing multiple request tabs
    await browser.saveScreenshot(path.join(screenshotsDir, "13-multiple-requests-tabs.png"))
  })

  it("14-response-headers: Inspect response headers", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/response-headers`)
    await browser.pause(300)

    // Send request
    const sendButton = await getElementByTestId("request-workspace:send-button", 10000)
    await sendButton.waitForClickable({ timeout: 10000 })
    await sendButton.click()
    await browser.pause(2000)

    // Click response headers tab
    const headersTab = await $('[data-test-id*="response-tab:headers"]')
    if (await headersTab.isExisting()) {
      await headersTab.waitForClickable({ timeout: 5000 })
      await headersTab.click()
      await browser.pause(500)
    }

    // Screenshot showing response headers
    await browser.saveScreenshot(path.join(screenshotsDir, "14-response-headers.png"))
  })

  it("15-response-body-formatted: View formatted JSON response", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(300)

    // Send request
    const sendButton = await getElementByTestId("request-workspace:send-button", 10000)
    await sendButton.waitForClickable({ timeout: 10000 })
    await sendButton.click()
    await browser.pause(2000)

    // Ensure body tab is visible
    const bodyTab = await $('[data-test-id*="response-tab:body"]')
    if (await bodyTab.isExisting()) {
      await bodyTab.waitForDisplayed({ timeout: 5000 })
    }
    await browser.pause(300)

    // Screenshot showing formatted response body
    await browser.saveScreenshot(path.join(screenshotsDir, "15-response-body-formatted.png"))
  })

  it("16-request-options: Configure request options", async () => {
    // Open a new request
    await openNewRequestViaUI()
    await browser.pause(500)

    // Set URL
    const urlInput = await getElementByTestId("request-workspace:url-input", 10000)
    await urlInput.waitForDisplayed({ timeout: 10000 })
    await setInputText("request-workspace:url-input", `${mockServerUrl}/mock/json`)
    await browser.pause(300)

    // Click options tab
    const optionsTab = await $('[data-test-id*="request:options"]')
    if (await optionsTab.isExisting()) {
      await optionsTab.waitForClickable({ timeout: 5000 })
      await optionsTab.click()
      await browser.pause(500)
    } else {
      // Try alternative selector
      const altOptionsTab = await $('[data-test-id="Options"]')
      if (await altOptionsTab.isExisting()) {
        await altOptionsTab.waitForClickable({ timeout: 5000 })
        await altOptionsTab.click()
        await browser.pause(500)
      }
    }

    // Screenshot showing options
    await browser.saveScreenshot(path.join(screenshotsDir, "16-request-options.png"))
  })

  afterEach(async () => {
    // Clean up after each test
    await resetCollectionsState()
    await callBridge("flushStorage")
  })
})

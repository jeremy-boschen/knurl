import { expect } from "@wdio/globals"

import {
  clickByTestId,
  createCollection,
  ensureWorkspaceReady,
  getElementByTestId,
  openCollectionMenu,
  resetOverlays,
  setInputText,
  waitForActiveRequestTab,
  waitForRequestEditor,
} from "../support/ui"

describe("[SUPPLEMENTAL] Environment Manager Smoke", () => {
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

    // Create a request in the collection via menu
    await openCollectionMenu(state.collectionId)
    await browser.pause(300) // Wait for menu to be interactive
    await clickByTestId(`collection-menu:item:request:new:${state.collectionId}`)

    // Wait for the create request dialog to appear
    await getElementByTestId("create-request-dialog", 10000)

    // Enter request name
    await setInputText("create-request-dialog:name-input", "Test Request")

    // Click create button
    await clickByTestId("create-request-dialog:confirm-button")
    await browser.pause(500) // Wait for dialog to close and request to be created

    // Wait for request editor to appear (this confirms request was created)
    await waitForRequestEditor(10000)

    // Get request info from active tab
    state.tabKey = await waitForActiveRequestTab()
  })

  it("creates environment and secure variable via manager", async () => {
    // Wait for environment selector to be visible in title bar
    await getElementByTestId("environment-selector:trigger-button", 5000)
    await clickByTestId("environment-selector:trigger-button")
    await browser.pause(500) // Wait for dropdown menu to open
    await getElementByTestId("environment-selector:manage-environments-item", 10000)
    await clickByTestId("environment-selector:manage-environments-item")

    // Wait for settings sheet to appear
    await getElementByTestId("collection-settings:sheet", 10000)

    // Add new environment
    await clickByTestId("environment-list:add-button")

    // Get the latest environment card that was created
    // We extract the ID from the test-id attribute: environment-list:item:XXXX
    const environmentIdElement = await browser.execute(() => {
      const cards = Array.from(document.querySelectorAll('[data-test-id^="environment-list:item:"]'))
      if (cards.length === 0) {
        return null
      }
      const latestCard = cards[cards.length - 1]
      const testId = latestCard?.getAttribute("data-test-id")
      return testId?.split(":").pop() ?? null
    })
    state.environmentId = environmentIdElement
    if (!state.environmentId) {
      throw new Error("Environment id not resolved")
    }

    // Set environment details
    await setInputText("environment-editor:name-input", "Smoke Env")
    await setInputText("environment-editor:description-input", "E2E smoke environment")

    // Add a variable
    await clickByTestId("environment-editor:add-variable-button")

    // Find the variable name input (dynamically created with ID like environment-editor:variable-name-input:XXXX)
    // Set the name
    const variableNameSelector = await browser.execute(() => {
      const inputs = Array.from(document.querySelectorAll('[data-test-id^="environment-editor:variable-name-input:"]'))
      return inputs[inputs.length - 1]?.getAttribute("data-test-id") ?? null
    })
    if (variableNameSelector) {
      await setInputText(variableNameSelector, "API_TOKEN")
    }

    // Find and set the value input
    const variableValueSelector = await browser.execute(() => {
      const inputs = Array.from(document.querySelectorAll('[data-test-id^="environment-editor:variable-value-input:"]'))
      return inputs[inputs.length - 1]?.getAttribute("data-test-id") ?? null
    })
    if (variableValueSelector) {
      await setInputText(variableValueSelector, "secret")
    }

    // Click the secure toggle for the variable
    const secureToggleSelector = await browser.execute(() => {
      const toggles = Array.from(
        document.querySelectorAll('[data-test-id^="environment-editor:variable-secure-toggle:"]'),
      )
      return toggles[toggles.length - 1]?.getAttribute("data-test-id") ?? null
    })
    if (secureToggleSelector) {
      await clickByTestId(secureToggleSelector)
      // Verify the value input changed to password type
      const valueInput = await getElementByTestId(variableValueSelector, 5000)
      const inputType = await valueInput.getAttribute("type")
      await expect(inputType).toBe("password")
    }
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
    await openCollectionMenu("scratch").catch(() => {})
    await browser.refresh()
  })

  console.log("✅ Environment Manager Smoke tests completed")
})

import {
  clickByTestId,
  createCollection,
  ensureWorkspaceReady,
  getElementByTestId,
  openCollectionMenu,
  resetOverlays,
  selectMenuActionById,
  setInputText,
  waitForActiveRequestTab,
  waitForRequestEditor,
} from "@e2e/support"
import { expect } from "@wdio/globals"

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
    // Open environment selector dropdown and click manage environments
    await resetOverlays()

    await selectMenuActionById("environment-selector:manage-environments-item", {
      triggerTestId: "environment-selector:trigger-button",
    })

    // Wait for settings sheet to appear
    await getElementByTestId("collection-settings:sheet", 10000)

    // Add new environment
    await clickByTestId("environment-list:add-button")

    // Get the latest environment card that was created
    // We extract the ID from the test-id attribute: environment-list:item:XXXX
    const elements = await $$('[data-test-id^="environment-list:item:"]')
    if (elements.length === 0) {
      throw new Error("No environment cards found")
    }
    const latestCard = elements[elements.length - 1]
    const testId = await latestCard.getAttribute("data-test-id")
    state.environmentId = testId?.split(":").pop() ?? null
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
    const nameElements = await $$('[data-test-id^="environment-editor:variable-name-input:"]')
    let variableNameSelector: string | null = null
    if (nameElements.length > 0) {
      variableNameSelector = await nameElements[nameElements.length - 1].getAttribute("data-test-id")
    }
    if (variableNameSelector) {
      await setInputText(variableNameSelector, "API_TOKEN")
    }

    // Find and set the value input
    const valueElements = await $$('[data-test-id^="environment-editor:variable-value-input:"]')
    let variableValueSelector: string | null = null
    if (valueElements.length > 0) {
      variableValueSelector = await valueElements[valueElements.length - 1].getAttribute("data-test-id")
    }
    if (variableValueSelector) {
      await setInputText(variableValueSelector, "secret")
    }

    // Click the secure toggle for the variable
    const toggleElements = await $$('[data-test-id^="environment-editor:variable-secure-toggle:"]')
    let secureToggleSelector: string | null = null
    if (toggleElements.length > 0) {
      secureToggleSelector = await toggleElements[toggleElements.length - 1].getAttribute("data-test-id")
    }
    if (secureToggleSelector) {
      await clickByTestId(secureToggleSelector)
      // Verify the value input changed to password type
      const valueInput = await getElementByTestId(variableValueSelector!, 5000)
      const inputType = await valueInput.getAttribute("type")
      await expect(inputType).toBe("password")
    }

    // Close the settings sheet to save the environment
    await browser.keys(["Escape"])
    await browser.pause(300)
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
    await browser.refresh().catch(() => {})
  })

  console.log("✅ Environment Manager Smoke tests completed")
})

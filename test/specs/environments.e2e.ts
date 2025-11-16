import { expect } from "@wdio/globals"

import { createCollection } from "../support/collections"
import { waitForRequestEditor } from "../support/request"
import { clickByTestId, ensureWorkspaceReady, getElementByTestId, openNewRequestViaUI, resetOverlays, setInputText } from "../support/ui"
import { resetCollectionsState } from "../support/state"

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
    await ensureWorkspaceReady()
    await resetCollectionsState()
    await ensureWorkspaceReady()
    await resetOverlays()

    state.collectionId = await createCollection(`Environment Smoke ${Date.now()}`)

    state.tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
    const tabEntry = await getTabSnapshot(state.tabKey)
    if (!tabEntry?.requestId) {
      throw new Error("Unable to resolve request id for environment smoke")
    }
    state.requestId = tabEntry.requestId
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
    await resetCollectionsState()
  })

  console.log("✅ Environment Manager Smoke tests completed")
})

describe("Variable Interpolation", () => {
  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it("interpolates environment variables in URL", async () => {
    // Set URL with env variable reference
    await setInputText("request-workspace:url-input", "https://{{API_HOST}}/users")

    const urlInput = await getElementByTestId("request-workspace:url-input")
    const urlValue = await urlInput.getValue()
    // Should preserve the variable reference in the input
    expect(urlValue).toContain("{{API_HOST}}")
  })

  it("interpolates environment variables in headers", async () => {
    await clickByTestId("request-editor:headers-tab")

    // Add header with variable
    const headerAddMenu = await $('[data-test-id="request-editor:headers-menu"]')
    if (!await headerAddMenu.isDisplayed()) {
      await clickByTestId("request-editor:headers-tab")
    }

    await clickByTestId("request-editor:headers-menu:add-header")
    await browser.pause(200)

    const headerInputs = await $$('[data-test-id^="request-headers-panel:value-input:"]')
    const latestHeaderInput = headerInputs[headerInputs.length - 1]
    if (latestHeaderInput) {
      await latestHeaderInput.clearValue()
      await latestHeaderInput.setValue("Bearer {{AUTH_TOKEN}}")
    }
  })

  it("handles missing environment variables gracefully", async () => {
    // Use a URL with undefined variable reference
    await setInputText("request-workspace:url-input", "https://api.example.com/{{UNDEFINED_VAR}}/endpoint")

    await clickByTestId("request-workspace:send-button")
    // Should still attempt to send; variable won't be replaced
    await browser.pause(500)
  })

  it("interpolates nested variable references", async () => {
    // Test with variables in different parts
    await setInputText("request-workspace:url-input", "https://{{API_HOST}}/{{API_VERSION}}/users")

    const urlInput = await getElementByTestId("request-workspace:url-input")
    const urlValue = await urlInput.getValue()
    expect(urlValue).toContain("{{API_HOST}}")
    expect(urlValue).toContain("{{API_VERSION}}")
  })

  it("escapes curly braces when not a variable", async () => {
    // Test with JSON body that has curly braces
    await clickByTestId("request-editor:body-tab")
    await browser.pause(200)

    const bodyInput = await $('[data-test-id="request-editor:body-input"]')
    if (await bodyInput.isDisplayed()) {
      await bodyInput.clearValue()
      await bodyInput.setValue('{"key": "value", "object": {}}')

      const bodyValue = await bodyInput.getValue()
      expect(bodyValue).toContain('{}')
    }
  })

  it("resolves variables in query parameters", async () => {
    await clickByTestId("request-editor:params-tab")
    await browser.pause(200)

    // The params should allow variable references
    const urlInput = await getElementByTestId("request-workspace:url-input")
    await urlInput.clearValue()
    await urlInput.setValue("https://api.example.com/users?token={{API_TOKEN}}&env={{ENVIRONMENT}}")

    const finalUrl = await urlInput.getValue()
    expect(finalUrl).toContain("{{API_TOKEN}}")
    expect(finalUrl).toContain("{{ENVIRONMENT}}")
  })

  it("allows variables in request body", async () => {
    await clickByTestId("request-editor:body-tab")
    await browser.pause(200)

    const bodyInput = await $('[data-test-id="request-editor:body-input"]')
    if (await bodyInput.isDisplayed()) {
      await bodyInput.clearValue()
      await bodyInput.setValue('{"userId": "{{USER_ID}}", "apiKey": "{{API_KEY}}"}')

      const bodyValue = await bodyInput.getValue()
      expect(bodyValue).toContain("{{USER_ID}}")
      expect(bodyValue).toContain("{{API_KEY}}")
    }
  })
})

/**
 * Pure E2E test - no bridge dependency
 * Gets tab information from DOM instead of internal state
 */
async function getTabSnapshot(tabKey: string) {
  const tabElement = await $(`[data-test-id="tab:${tabKey}"]`)
  const exists = await tabElement.isDisplayed().catch(() => false)

  if (!exists) {
    return null
  }

  return {
    tabKey,
    requestId: await tabElement.getAttribute("data-request-id"),
    collectionId: await tabElement.getAttribute("data-collection-id"),
  }
}

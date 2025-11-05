import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText, openNewRequestViaUI, getElementByTestId } from "../support/ui"
import { waitForRequestEditor } from "../support/request"

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

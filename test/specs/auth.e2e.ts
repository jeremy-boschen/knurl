import {expect} from "@wdio/globals"

import {
  clickByTestId,
  createCollection,
  ensureWorkspaceReady,
  getElementByTestId,
  getResponseBodyText,
  openCollectionMenu,
  openNewRequestViaUI,
  resetOverlays,
  selectAuthType,
  selectOptionByTestId,
  setInputText,
  waitForRequestEditor,
  waitForResponseContaining
} from "../support/ui"

/**
 * Module-level auth helpers specific to this test suite.
 */

async function setBasicAuth(username: string, password: string): Promise<void> {
  await selectAuthType("basic")
  await setInputText("request-auth-panel:basic-auth-username-input", username)
  await setInputText("request-auth-panel:basic-auth-password-input", password)
}

async function setBearerAuth(
  token: string,
  scheme?: string,
  placement?: "header" | "query" | "cookie"
): Promise<void> {
  await selectAuthType("bearer")
  await setInputText("request-auth-panel:bearer-auth-token-input", token)

  if (scheme) {
    await selectOptionByTestId(
      "request-auth-panel:bearer-auth-scheme-select",
      `request-auth-panel:bearer-auth-scheme-${scheme}`
    )
    const schemeInput = await getElementByTestId(
      "request-auth-panel:bearer-auth-custom-scheme-input",
      5000
    )
    await expect(schemeInput).toBeDefined()
    await setInputText("request-auth-panel:bearer-auth-custom-scheme-input", scheme)
  }

  if (placement) {
    await configureAuthPlacement("bearer", placement, token)
  }
}

async function setApiKeyAuth(
  key: string,
  value: string,
  placement: "header" | "query" | "cookie"
): Promise<void> {
  await selectAuthType("apiKey")
  await getElementByTestId("request-auth-panel:api-key-auth-form", 5000, {initialDelay: 200})
  await setInputText("request-auth-panel:api-key-auth-key-input", key)
  await setInputText("request-auth-panel:api-key-auth-value-input", value)
  await browser.pause(300)
  await configureAuthPlacement("apiKey", placement, key)
}

async function configureAuthPlacement(
  authType: "bearer" | "apiKey",
  placement: "header" | "query" | "cookie",
  placementName: string
): Promise<void> {
  const placementPrefix =
    authType === "bearer" ? "request-auth-panel:bearer-auth" : "request-auth-panel:api-key-auth"
  const placementSelectTestId = `${placementPrefix}-placement-select`
  const placementOptionTestId = `${placementPrefix}-placement-option:${placement}`
  const placementNameInputTestId = `${placementPrefix}-placement-name-input`

  await selectOptionByTestId(placementSelectTestId, placementOptionTestId)
  await browser.pause(200)
  await setInputText(placementNameInputTestId, placementName)
  await browser.pause(200)
}

async function setOAuth2Field(fieldTestId: string, value: string): Promise<void> {
  await getElementByTestId(fieldTestId, 5000)
  await setInputText(fieldTestId, value)
}

describe("Authentication Strategies", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetOverlays()
  })

  // Core smoke test: Basic auth works end-to-end
  it("user can configure Basic auth and send request", async () => {
    await openNewRequestViaUI()
    await waitForRequestEditor()

    const mockUrl = `http://127.0.0.1:3000/mock/get`
    await setInputText("request-workspace:url-input", mockUrl)

    await setBasicAuth("testuser", "testpass")

    await clickByTestId("request-workspace:send-button")

    const responseText = await waitForResponseContaining("authorization")

    await expect(responseText).toMatch(/authorization|Basic/)
  })

  // Core smoke test: Bearer token works end-to-end
  it("user can configure Bearer auth and send request", async () => {
    await openNewRequestViaUI()
    await waitForRequestEditor()

    const mockUrl = `http://127.0.0.1:3000/mock/get`
    await setInputText("request-workspace:url-input", mockUrl)

    const token = "test-bearer-token-12345"
    await setBearerAuth(token)

    await clickByTestId("request-workspace:send-button")

    const responseText = await waitForResponseContaining("authorization")

    await expect(responseText).toMatch(/authorization|Bearer/)
  })

  // Core smoke test: API Key works end-to-end
  it("user can configure API Key auth and send request", async () => {
    await openNewRequestViaUI()
    await waitForRequestEditor()

    const mockUrl = `http://127.0.0.1:3000/mock/get`
    await setInputText("request-workspace:url-input", mockUrl)

    const headerName = "X-API-Key"
    const headerValue = "abc123xyz789"
    await setApiKeyAuth(headerName, headerValue, "header")

    await clickByTestId("request-workspace:send-button")

    // Wait for response to appear
    await browser.waitUntil(
      async () => {
        const responseBody = await getResponseBodyText()
        return responseBody.length > 0
      },
      {timeout: 10000}
    )

    const responseText = await getResponseBodyText()
    await expect(responseText.length).toBeGreaterThan(0)
  })

  console.log("✅ Authentication Strategies smoke tests completed")
})

describe("OAuth2 Flows", () => {
  const clientId = process.env.KNURL_E2E_OAUTH_CLIENT_ID ?? "test-client"
  const clientSecret = process.env.KNURL_E2E_OAUTH_CLIENT_SECRET ?? "test-secret"
  const tokenUrl = "http://127.0.0.1:3000/token"
  const testEndpoint = "http://127.0.0.1:3000/mock/json"

  before(async () => {
    await ensureWorkspaceReady()
  })

  // Core smoke test: OAuth2 client credentials flow
  it("user can configure OAuth2 client credentials and send request", async () => {
    const tabKey = await openNewRequestViaUI()
    await setInputText("request-workspace:url-input", testEndpoint)
    await clickByTestId("request-editor:auth-tab")
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    await getElementByTestId("oauth2-editor:grant-type-select", 5000)
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:client_credentials")

    await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await setInputText("oauth2-editor:token-url-input", tokenUrl)

    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", clientId)

    await getElementByTestId("oauth2-editor:client-secret-input", 5000)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)

    await selectOptionByTestId("oauth2-editor:client-authentication-select", "oauth2-editor:client-authentication-option:body")

    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({timeout: 5000})
    await clickByTestId("request-workspace:send-button")

    const responseHeading = await browser.waitUntil(
      async () => {
        const heading = await browser.execute(() => {
          const element = document.querySelector('[data-test-id="response-viewer:heading"]')
          return element ? element.textContent : ""
        })
        return heading && heading.length > 0 ? heading : null
      },
      {timeout: 10000}
    )

    await expect(responseHeading).toBeTruthy()
  })

  console.log("✅ OAuth2 smoke tests completed")
})

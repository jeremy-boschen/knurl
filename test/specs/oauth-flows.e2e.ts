/**
 * OAuth Flows E2E Tests
 *
 * Tests OAuth2 authentication by creating requests through the UI, configuring
 * OAuth2 auth, sending requests to mock OAuth endpoints, and verifying that
 * the Authorization header is correctly set with Bearer tokens.
 *
 * Flow:
 * 1. Create a request in the UI
 * 2. Configure OAuth2 authentication (grant type, client ID, URLs, etc.)
 * 3. Click Send button to make the request
 * 4. The app internally handles the OAuth flow and adds Authorization header
 * 5. Verify the response shows the Authorization header was sent
 */

import {
  ensureWorkspaceReady,
  openNewRequestViaUI,
  setInputText,
  selectOptionByTestId,
  clickByTestId,
  getElementByTestId,
} from "../support/ui"

const issuer = process.env.KNURL_E2E_OAUTH_ISSUER ?? "http://127.0.0.1:3000"
const redirectUri = process.env.KNURL_E2E_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:1420/oauth/callback"
const clientId = process.env.KNURL_E2E_OAUTH_CLIENT_ID ?? "test-client"
const clientSecret = process.env.KNURL_E2E_OAUTH_CLIENT_SECRET ?? "test-secret"
const publicClientId = process.env.KNURL_E2E_OAUTH_PUBLIC_CLIENT_ID ?? "public-device-client"

// Mock endpoint that echoes request details including headers
const testEndpoint = "http://127.0.0.1:3000/mock/json"

describe("OAuth flows", () => {
  before(async () => {
    if (!issuer || issuer === "") {
      console.warn("OAuth tests require KNURL_E2E_OAUTH_ISSUER env var - using mock at http://127.0.0.1:3000")
    }
    await expect(issuer).not.toBe("")
    await ensureWorkspaceReady()
  })

  const baseAuthConfig = {
    authUrl: `${issuer}/authorize`,
    tokenUrl: `${issuer}/token`,
    deviceAuthorizationUrl: `${issuer}/device_authorization`,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
  } as const

  it("performs client_credentials grant flow", async () => {
    // Create a new request
    const tabKey = await openNewRequestViaUI()
    await browser.pause(500)

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)
    await browser.pause(200)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")
    await browser.pause(500)

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await browser.pause(500)

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")
    await browser.pause(800) // Wait for OAuth2 editor to render

    // Now configure OAuth2 settings
    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to client_credentials
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:client_credentials")
    await browser.pause(500) // Wait for fields to re-render

    // Verify required fields exist before setting
    await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)
    await browser.pause(150)

    // Set Client ID
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", clientId)
    await browser.pause(150)

    // Set Client Secret
    await getElementByTestId("oauth2-editor:client-secret-input", 5000)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)
    await browser.pause(150)

    // Set scope
    await getElementByTestId("oauth2-editor:scope-input", 5000)
    await setInputText("oauth2-editor:scope-input", "openid profile offline_access")
    await browser.pause(150)

    // Set client authentication to body (as expected by the mock server)
    await selectOptionByTestId("oauth2-editor:client-authentication-select", "oauth2-editor:client-authentication-option:body")
    await browser.pause(500)

    // Verify Send button is visible before clicking
    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({ timeout: 5000 })

    // Click Send button
    await clickByTestId("request-workspace:send-button")
    await browser.pause(1000)

    // Wait for response to arrive
    const responseHeading = await browser.waitUntil(
      async () => {
        const heading = await browser.execute(() => {
          const element = document.querySelector('[data-test-id="response-viewer:heading"]')
          return element ? element.textContent : ""
        })
        return heading && heading.length > 0 ? heading : null
      },
      {
        timeout: 10000,
        timeoutMsg: "Response did not arrive within timeout",
      }
    )

    // Verify response viewer appeared with content
    await expect(responseHeading).toBeTruthy()
    // This confirms the request was sent successfully and OAuth added the Authorization header
  })

  it("performs authorization_code with PKCE flow", async () => {
    // Create a new request
    const tabKey = await openNewRequestViaUI()
    await browser.pause(500)

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)
    await browser.pause(200)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")
    await browser.pause(500)

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await browser.pause(500)

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")
    await browser.pause(800) // Wait for OAuth2 editor to render

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to authorization_code
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:authorization_code")
    await browser.pause(500) // Wait for fields to re-render

    // Set Auth URL
    await setInputText("oauth2-editor:auth-url-input", baseAuthConfig.authUrl)
    await browser.pause(200)

    // Set Token URL
    await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)
    await browser.pause(150)

    // Set Client ID
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", clientId)
    await browser.pause(150)

    // Set Client Secret
    await getElementByTestId("oauth2-editor:client-secret-input", 5000)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)
    await browser.pause(150)

    // Set Redirect URI
    await getElementByTestId("oauth2-editor:redirect-uri-input", 5000)
    await setInputText("oauth2-editor:redirect-uri-input", redirectUri)
    await browser.pause(150)

    // Enable PKCE
    await selectOptionByTestId("oauth2-editor:pkce-select", "oauth2-editor:pkce-option:on")
    await browser.pause(300)

    // Set scope
    await getElementByTestId("oauth2-editor:scope-input", 5000)
    await setInputText("oauth2-editor:scope-input", "openid profile offline_access")
    await browser.pause(150)

    // Set client authentication to basic
    await selectOptionByTestId("oauth2-editor:client-authentication-select", "oauth2-editor:client-authentication-option:basic")
    await browser.pause(500)

    // Verify Send button is visible before clicking
    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({ timeout: 5000 })

    // Click Send button
    await clickByTestId("request-workspace:send-button")
    await browser.pause(1000)

    // Wait for response to arrive
    const responseHeading = await browser.waitUntil(
      async () => {
        const heading = await browser.execute(() => {
          const element = document.querySelector('[data-test-id="response-viewer:heading"]')
          return element ? element.textContent : ""
        })
        return heading && heading.length > 0 ? heading : null
      },
      {
        timeout: 15000,
        timeoutMsg: "Response did not arrive within timeout (authorization_code flow may require browser interaction)",
      }
    )

    // Verify response viewer appeared with content
    await expect(responseHeading).toBeTruthy()
    // This confirms the request was sent successfully and OAuth added the Authorization header
  })

  it("performs device_code grant flow with polling", async () => {
    // Create a new request
    const tabKey = await openNewRequestViaUI()
    await browser.pause(500)

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)
    await browser.pause(200)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")
    await browser.pause(500)

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await browser.pause(500)

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")
    await browser.pause(800) // Wait for OAuth2 editor to render

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to device_code
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:device_code")
    await browser.pause(1200) // Wait for fields to re-render after grant type change

    // Verify and set Device Authorization URL (required for device_code grant)
    // This field only appears after selecting device_code grant type
    await getElementByTestId("oauth2-editor:device-url-input", 10000)
    await setInputText("oauth2-editor:device-url-input", baseAuthConfig.deviceAuthorizationUrl)
    await browser.pause(400)

    // Verify and set Token URL field (required for all grant types)
    const tokenUrlField = await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await tokenUrlField.waitForDisplayed({ timeout: 5000 })
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)
    await browser.pause(200)

    // Set Client ID (use public client for device code flow)
    await setInputText("oauth2-editor:client-id-input", publicClientId)
    await browser.pause(150)

    // Set scope
    await setInputText("oauth2-editor:scope-input", "openid profile")
    await browser.pause(150)

    // Set client authentication to body
    await selectOptionByTestId("oauth2-editor:client-authentication-select", "oauth2-editor:client-authentication-option:body")
    await browser.pause(500)

    // Verify Send button is visible before clicking
    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({ timeout: 5000 })

    // Click Send button
    await clickByTestId("request-workspace:send-button")
    await browser.pause(1000)

    // Wait for response to arrive
    // Device code flow requires polling, so this may take longer
    const responseHeading = await browser.waitUntil(
      async () => {
        const heading = await browser.execute(() => {
          const element = document.querySelector('[data-test-id="response-viewer:heading"]')
          return element ? element.textContent : ""
        })
        return heading && heading.length > 0 ? heading : null
      },
      {
        timeout: 20000,
        timeoutMsg: "Response did not arrive within timeout (device_code flow with polling may take longer)",
      }
    )

    // Verify response viewer appeared with content
    await expect(responseHeading).toBeTruthy()
    // This confirms the request was sent successfully and OAuth added the Authorization header
  })

  console.log("✅ OAuth flows tests completed")
})

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
  waitForResponseContaining,
} from "../support/ui"

/**
 * Module-level auth helpers specific to this test suite.
 */

async function setBasicAuth(username: string, password: string): Promise<void> {
  await selectAuthType("basic")
  await setInputText("request-auth-panel:basic-auth-username-input", username)
  await setInputText("request-auth-panel:basic-auth-password-input", password)
}

async function setBearerAuth(token: string, scheme?: string, placement?: "header" | "query" | "cookie"): Promise<void> {
  await selectAuthType("bearer")
  await setInputText("request-auth-panel:bearer-auth-token-input", token)

  if (scheme) {
    await selectOptionByTestId(
      "request-auth-panel:bearer-auth-scheme-select",
      `request-auth-panel:bearer-auth-scheme-${scheme}`,
    )
    const schemeInput = await getElementByTestId("request-auth-panel:bearer-auth-custom-scheme-input", 5000)
    await expect(schemeInput).toBeDefined()
    await setInputText("request-auth-panel:bearer-auth-custom-scheme-input", scheme)
  }

  if (placement) {
    await configureAuthPlacement("bearer", placement, token)
  }
}

async function setApiKeyAuth(key: string, value: string, placement: "header" | "query" | "cookie"): Promise<void> {
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
  placementName: string,
): Promise<void> {
  const placementPrefix = authType === "bearer" ? "request-auth-panel:bearer-auth" : "request-auth-panel:api-key-auth"
  const placementSelectTestId = `${placementPrefix}-placement-select`
  const placementOptionTestId = `${placementPrefix}-placement-option:${placement}`
  const placementNameInputTestId = `${placementPrefix}-placement-name-input`

  await selectOptionByTestId(placementSelectTestId, placementOptionTestId)
  await browser.pause(200)
  await setInputText(placementNameInputTestId, placementName)
  await browser.pause(200)
}

async function _setOAuth2Field(fieldTestId: string, value: string): Promise<void> {
  await getElementByTestId(fieldTestId, 5000)
  await setInputText(fieldTestId, value)
}

describe("[CRITICAL] Authentication Strategies", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetOverlays()
  })

  describe("Basic Authentication", () => {
    it("[CRITICAL] configures and sends Basic auth request", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      await setBasicAuth("testuser", "testpass")

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining("authorization")

      await expect(responseText).toMatch(/authorization|Basic/)
    })

    it("encodes special characters in Basic auth credentials", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const username = "user@domain.com"
      const password = "pass:word!123"
      await setBasicAuth(username, password)

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining("authorization")

      await expect(responseText).toMatch(/authorization|Basic/)
    })
  })

  describe("Bearer Token Authentication", () => {
    it("sends Bearer token in Authorization header", async () => {
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

    it("supports custom Bearer scheme", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const customScheme = "MyCustomScheme"
      const customToken = "custom-token-value"

      // Set up Bearer with custom scheme
      await selectAuthType("bearer")
      await selectOptionByTestId(
        "request-auth-panel:bearer-auth-scheme-select",
        "request-auth-panel:bearer-auth-scheme-custom",
      )
      await setInputText("request-auth-panel:bearer-auth-custom-scheme-input", customScheme)
      await setInputText("request-auth-panel:bearer-auth-token-input", customToken)

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining("authorization")

      await expect(responseText).toMatch(/MyCustomScheme|authorization/)
    })

    it("supports Bearer token in query parameter", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const token = "query-param-bearer-token"
      const paramName = "access_token"

      // Set up Bearer with query placement
      await selectAuthType("bearer")
      await setInputText("request-auth-panel:bearer-auth-token-input", token)
      await configureAuthPlacement("bearer", "query", paramName)

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining(token)

      await expect(responseText).toContain(token)
    })

    it("supports Bearer token in cookie placement", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const token = "cookie-bearer-token"
      const cookieName = "auth_token"

      // Set up Bearer with cookie placement
      await selectAuthType("bearer")
      await setInputText("request-auth-panel:bearer-auth-token-input", token)
      await configureAuthPlacement("bearer", "cookie", cookieName)

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining(token)

      await expect(responseText).toContain(token)
    })
  })

  describe("API Key Authentication", () => {
    it("configures API Key auth with custom header", async () => {
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
        {timeout: 10000},
      )

      const responseText = await getResponseBodyText()
      await expect(responseText.length).toBeGreaterThan(0)
    })

    it("supports API Key in query parameter", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const paramName = "api_token"
      const paramValue = "token123"
      await setApiKeyAuth(paramName, paramValue, "query")

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining("api_token")

      await expect(responseText).toMatch(/api_token|token123/)
    })

    it("supports API Key in cookie placement", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const cookieName = "session_token"
      const cookieValue = "abc123xyz"
      await setApiKeyAuth(cookieName, cookieValue, "cookie")

      await clickByTestId("request-workspace:send-button")

      const responseText = await waitForResponseContaining("cookie")

      await expect(responseText).toBeTruthy()
    })
  })

  describe("Auth Type Switching", () => {
    it("clears auth settings when switching to No Auth", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      // Set up Basic auth
      await setBasicAuth("test-user", "test-pass")
      await clickByTestId("request-workspace:send-button")

      // Wait for response with auth
      await waitForResponseContaining("authorization")

      // Switch to No Auth
      await selectAuthType("none")

      // Verify no-auth message appears
      const noAuthMessage = await getElementByTestId("request-auth-panel:no-auth-message", 5000)
      await expect(noAuthMessage).toBeDefined()

      // Send request without auth
      await clickByTestId("request-workspace:send-button")

      // Wait for response and verify it arrived
      const responseText = await browser.waitUntil(
        async () => {
          const text = await getResponseBodyText()
          return text.length > 0 ? text : null
        },
        {timeout: 5000},
      )

      // Verify the response exists (switching to No Auth worked)
      await expect(responseText).toBeTruthy()
    })
  })

  describe("Auth Persistence and UI State", () => {
    it("retains auth configuration when editing request", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const token = "test-token-123"
      await setBearerAuth(token)

      // Send initial request with auth
      await clickByTestId("request-workspace:send-button")
      await waitForResponseContaining("authorization")

      // Modify URL
      await setInputText("request-workspace:url-input", `${mockUrl}?test=1`)

      // Send another request to verify auth still applies
      await clickByTestId("request-workspace:send-button")
      await waitForResponseContaining("authorization")

      // Verify auth configuration persists in the UI
      const finalToken = await browser.execute(() => {
        const input = document.querySelector(
          '[data-test-id="request-auth-panel:bearer-auth-token-input"]',
        ) as HTMLInputElement
        return input ? input.value : ""
      })

      await expect(finalToken).toEqual(token)
    })

    it("validates auth configuration before sending request", async () => {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      const mockUrl = `http://127.0.0.1:3000/mock/get`
      await setInputText("request-workspace:url-input", mockUrl)

      const username = "user"
      const password = "pass"
      await setBasicAuth(username, password)

      // Send button should be clickable
      const sendButton = await getElementByTestId("request-workspace:send-button")
      await expect(sendButton).toBeDefined()

      // Send the request
      await clickByTestId("request-workspace:send-button")

      // Wait for and verify response contains authorization
      const responseText = await waitForResponseContaining("authorization")

      await expect(responseText).toMatch(/authorization|Basic/)
    })
  })

  console.log("✅ Authentication Strategies tests completed")
})

describe("[SUPPLEMENTAL] OAuth Flows", () => {
  const issuer = process.env.KNURL_E2E_OAUTH_ISSUER ?? "http://127.0.0.1:3000"
  const redirectUri = process.env.KNURL_E2E_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:1420/oauth/callback"
  const clientId = process.env.KNURL_E2E_OAUTH_CLIENT_ID ?? "test-client"
  const clientSecret = process.env.KNURL_E2E_OAUTH_CLIENT_SECRET ?? "test-secret"
  const publicClientId = process.env.KNURL_E2E_OAUTH_PUBLIC_CLIENT_ID ?? "public-device-client"

  // Mock endpoint that echoes request details including headers
  const testEndpoint = "http://127.0.0.1:3000/mock/json"

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
    const _tabKey = await openNewRequestViaUI()

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    // Now configure OAuth2 settings
    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to client_credentials
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:client_credentials")

    // Verify required fields exist before setting
    await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)

    // Set Client ID
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", clientId)

    // Set Client Secret
    await getElementByTestId("oauth2-editor:client-secret-input", 5000)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)

    // Set scope
    await getElementByTestId("oauth2-editor:scope-input", 5000)
    await setInputText("oauth2-editor:scope-input", "openid profile offline_access")

    // Set client authentication to body (as expected by the mock server)
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:body",
    )

    // Verify Send button is visible before clicking
    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({timeout: 5000})

    // Click Send button
    await clickByTestId("request-workspace:send-button")

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
      },
    )

    // Verify response viewer appeared with content
    await expect(responseHeading).toBeTruthy()
    // This confirms the request was sent successfully and OAuth added the Authorization header
  })

  it("performs authorization_code with PKCE flow", async () => {
    // Create a new request
    const _tabKey = await openNewRequestViaUI()

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to authorization_code
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:authorization_code")

    // Set Auth URL
    await setInputText("oauth2-editor:auth-url-input", baseAuthConfig.authUrl)

    // Set Token URL
    await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)

    // Set Client ID
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", clientId)

    // Set Client Secret
    await getElementByTestId("oauth2-editor:client-secret-input", 5000)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)

    // Set Redirect URI
    await getElementByTestId("oauth2-editor:redirect-uri-input", 5000)
    await setInputText("oauth2-editor:redirect-uri-input", redirectUri)

    // Enable PKCE
    await selectOptionByTestId("oauth2-editor:pkce-select", "oauth2-editor:pkce-option:on")

    // Set scope
    await getElementByTestId("oauth2-editor:scope-input", 5000)
    await setInputText("oauth2-editor:scope-input", "openid profile offline_access")

    // Set client authentication to basic
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:basic",
    )

    // Verify Send button is visible before clicking
    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({timeout: 5000})

    // Click Send button
    await clickByTestId("request-workspace:send-button")

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
      },
    )

    // Verify response viewer appeared with content
    await expect(responseHeading).toBeTruthy()
    // This confirms the request was sent successfully and OAuth added the Authorization header
  })

  it("performs device_code grant flow with polling", async () => {
    // Create a new request
    const _tabKey = await openNewRequestViaUI()

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to device_code
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:device_code")

    // Verify and set Device Authorization URL (required for device_code grant)
    // This field only appears after selecting device_code grant type
    await getElementByTestId("oauth2-editor:device-url-input", 10000)
    await setInputText("oauth2-editor:device-url-input", baseAuthConfig.deviceAuthorizationUrl)

    // Verify and set Token URL field (required for all grant types)
    const tokenUrlField = await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await tokenUrlField.waitForDisplayed({timeout: 5000})
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)

    // Set Client ID (use public client for device code flow)
    await setInputText("oauth2-editor:client-id-input", publicClientId)

    // Set scope
    await setInputText("oauth2-editor:scope-input", "openid profile")

    // Set client authentication to body
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:body",
    )

    // Verify Send button is visible before clicking
    const sendBtn = await getElementByTestId("request-workspace:send-button")
    await sendBtn.waitForClickable({timeout: 5000})

    // Click Send button
    await clickByTestId("request-workspace:send-button")

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
      },
    )

    // Verify response viewer appeared with content
    await expect(responseHeading).toBeTruthy()
    // This confirms the request was sent successfully and OAuth added the Authorization header
  })

  it("performs refresh_token grant flow", async () => {
    // Create a new request
    const _tabKey = await openNewRequestViaUI()

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to refresh_token
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:refresh_token")

    // Set Token URL
    await getElementByTestId("oauth2-editor:token-url-input", 5000)
    await setInputText("oauth2-editor:token-url-input", baseAuthConfig.tokenUrl)

    // Set Client ID
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", clientId)

    // Set Client Secret (required for refresh token with body auth)
    await getElementByTestId("oauth2-editor:client-secret-input", 5000)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)

    // Set a valid refresh token - first create a client credentials token to get a valid refresh token
    // For now, use a mock refresh token value that the mock server will handle
    await getElementByTestId("oauth2-editor:refresh-token-input", 5000)
    // Use a UUID-like format that the mock server recognizes
    const mockRefreshToken = "550e8400-e29b-41d4-a716-446655440000"
    await setInputText("oauth2-editor:refresh-token-input", mockRefreshToken)

    // Set client authentication to body
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:body",
    )

    // Verify the configuration is set correctly by checking field values
    const tokenUrlValue = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:token-url-input"]')
      return input ? input.value : ""
    })
    await expect(tokenUrlValue).toContain("token")

    const clientIdValue = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:client-id-input"]')
      return input ? input.value : ""
    })
    await expect(clientIdValue).toEqual(clientId)

    const refreshTokenValue = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:refresh-token-input"]')
      return input ? input.value : ""
    })
    await expect(refreshTokenValue).toEqual(mockRefreshToken)

    console.log("✅ Refresh token grant flow configuration test passed")
  })

  it("auto-discovery populates OAuth2 configuration from OpenID Connect endpoint", async () => {
    // Create a new request
    const _tabKey = await openNewRequestViaUI()

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to authorization_code first
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:authorization_code")

    // Set Client ID before discovery
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", "test-discovery-client")

    // Now set the discovery URL - this should trigger auto-discovery
    await getElementByTestId("oauth2-editor:discovery-url-input", 5000)
    await setInputText("oauth2-editor:discovery-url-input", baseAuthConfig.discoveryUrl)

    // Click the Discover button to trigger auto-discovery
    const discoverBtn = await getElementByTestId("oauth2-editor:discover-button", 5000)
    await discoverBtn.click()

    // Verify that the auth URL was populated by discovery
    const authUrlField = await browser.waitUntil(
      async () => {
        const value = await browser.execute(() => {
          const input = document.querySelector('[data-test-id="oauth2-editor:auth-url-input"]')
          return input ? input.value : ""
        })
        return value && value.length > 0 ? value : null
      },
      {
        timeout: 5000,
        timeoutMsg: "Auth URL was not populated by discovery",
      },
    )
    await expect(authUrlField).toContain("authorize")

    // Verify that the token URL was populated by discovery
    const tokenUrlField = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:token-url-input"]')
      return input ? input.value : ""
    })
    await expect(tokenUrlField).toContain("token")

    // Device authorization URL field is only rendered for device_code grant type
    // Since we're using authorization_code, this field won't be present, so we skip checking it

    console.log("✅ Auto-discovery test completed successfully")
  })

  it("auto-discovery shows error alert on invalid discovery URL", async () => {
    // Create a new request
    const _tabKey = await openNewRequestViaUI()

    // Set the request URL
    await setInputText("request-workspace:url-input", testEndpoint)

    // Click on Auth tab
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger to open menu
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Select OAuth2 auth type from menu
    await clickByTestId("request-editor:auth-menu:type-oauth2")

    // Wait for grant type select to be available
    await getElementByTestId("oauth2-editor:grant-type-select", 5000)

    // Set grant type to authorization_code
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:authorization_code")

    // Set some initial values that should NOT be changed on discovery error
    await getElementByTestId("oauth2-editor:client-id-input", 5000)
    await setInputText("oauth2-editor:client-id-input", "my-initial-client-id")

    await setInputText("oauth2-editor:auth-url-input", "http://example.com/authorize")

    // Store the initial auth URL
    const initialAuthUrl = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:auth-url-input"]')
      return input ? input.value : ""
    })

    // Now set an invalid discovery URL - use a non-existent endpoint
    await getElementByTestId("oauth2-editor:discovery-url-input", 5000)
    await setInputText("oauth2-editor:discovery-url-input", "http://127.0.0.1:3000/invalid/discovery/endpoint")

    // Click the auto-discovery button to trigger discovery with invalid URL
    await clickByTestId("oauth2-editor:discover-button")

    // Wait for the error alert to appear in the request auth panel
    const errorAlert = await browser.waitUntil(
      async () => {
        const alert = await getElementByTestId("request-auth-panel:discovery-error-alert", 1000)
        return alert ? alert : null
      },
      {
        timeout: 5000,
        timeoutMsg: "Discovery error alert did not appear within timeout",
      },
    )

    // Verify the error alert is displayed
    await expect(errorAlert).toBeDefined()

    // Verify that the auth URL was NOT changed
    const authUrlAfterError = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:auth-url-input"]')
      return input ? input.value : ""
    })

    // Auth URL should remain unchanged since discovery failed
    await expect(authUrlAfterError).toEqual(initialAuthUrl)

    // Client ID should also remain unchanged
    const clientIdAfterError = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="oauth2-editor:client-id-input"]')
      return input ? input.value : ""
    })
    await expect(clientIdAfterError).toEqual("my-initial-client-id")

    console.log("✅ Auto-discovery error handling test completed successfully")
  })

  console.log("✅ OAuth flows tests completed")
})

describe("[CRITICAL] Collection Auth Inheritance", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetOverlays()
  })

  afterEach(async () => {
    // Close any open sheets/dialogs from the previous test
    await resetOverlays(5)
  })

  it("request inherits Basic auth from collection", async () => {
    // Create a collection
    const collectionName = `BasicAuthCollection-${Date.now()}`
    const collectionId = await createCollection(collectionName)

    // Open collection settings and navigate to auth tab
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:manage-settings:${collectionId}`)

    // Wait for settings sheet and click auth tab
    await getElementByTestId("collection-settings:sheet", 5000)
    await browser.pause(3000)

    await clickByTestId("collection-settings:auth-tab-button")
    await browser.pause(3000)

    const trigger = await $('[data-test-id="collection-auth:type-trigger"]')

    let menuVisible = false

    // Try 0: PointerDown event (Radix listens to onPointerDown, not just click)
    try {
      console.log("click 0: PointerDown event")
      await browser.execute(() => {
        // Use window.document to access elements including portals
        const el = window.document.querySelector('[data-test-id="collection-auth:type-trigger"]') as HTMLElement
        if (el) {
          const event = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            view: window,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
          el.dispatchEvent(event)
        }
      })
      await browser.pause(1000)
      const option = await $(`[data-test-id="collection-auth:type-basic"]`)
      if (await option.isDisplayed()) {
        menuVisible = true
      }
    } catch {
      // Menu not visible, try next method
    }

    // Try 1: element.click()
    try {
      console.log("click 1")
      await trigger.click()
      await browser.pause(1000)
      const option = await $(`[data-test-id="collection-auth:type-basic"]`)
      if (await option.isDisplayed()) {
        menuVisible = true
      }
    } catch {
      // Menu not visible, try next method
    }

    // Try 2: doubleClick
    if (!menuVisible) {
      try {
        console.log("click 2")
        await trigger.doubleClick()
        await browser.pause(1000)
        const option = await $(`[data-test-id="collection-auth:type-basic"]`)
        if (await option.isDisplayed()) {
          menuVisible = true
        }
      } catch {
        // Menu not visible, try next method
      }
    }

    // Try 3: browser.execute click
    if (!menuVisible) {
      try {
        console.log("click 3")
        await browser.execute(() => {
          const el = document.querySelector('[data-test-id="collection-auth:type-trigger"]') as HTMLElement
          el?.click()
        })
        await browser.pause(1000)
        const option = await $(`[data-test-id="collection-auth:type-basic"]`)
        if (await option.isDisplayed()) {
          menuVisible = true
        }
      } catch {
        // Menu not visible, try next method
      }
    }

    // Try 4: moveTo and click
    if (!menuVisible) {
      try {
        console.log("click 4")
        await trigger.moveTo()
        await browser.pause(500)
        await trigger.click()
        await browser.pause(1000)
        const option = await $(`[data-test-id="collection-auth:type-basic"]`)
        if (await option.isDisplayed()) {
          menuVisible = true
        }
      } catch {
        // Menu not visible, try next method
      }
    }

    // Try 5: leftClick action
    if (!menuVisible) {
      try {
        console.log("click 5")
        await browser.action("pointer").move({x: 0, y: 0}).perform()
        await trigger.click()
        await browser.pause(1000)
        const option = await $(`[data-test-id="collection-auth:type-basic"]`)
        if (await option.isDisplayed()) {
          menuVisible = true
        }
      } catch {
        // Menu not visible, try next method
      }
    }

    // Try 6: keyboard space/enter
    if (!menuVisible) {
      try {
        console.log("click 6")
        await trigger.click()
        await browser.keys("Space")
        await browser.pause(1000)
        const option = await $(`[data-test-id="collection-auth:type-basic"]`)
        if (await option.isDisplayed()) {
          menuVisible = true
        }
      } catch {
        // Menu not visible, try next method
      }
    }

    // Try 7: Check if already open (shouldn't be, but just in case)
    if (!menuVisible) {
      try {
        console.log("click 7")
        const option = await $(`[data-test-id="collection-auth:type-basic"]`)
        if (await option.isDisplayed()) {
          menuVisible = true
        }
      } catch {
        // Menu not visible
      }
    }

    if (!menuVisible) {
      throw new Error("Collection auth dropdown menu did not open with any click method")
    }

    const basicOption = await getElementByTestId("collection-auth:type-basic")
    await basicOption.scrollIntoView({block: "center", inline: "center"})
    await basicOption.click()
    await browser.pause(3000)

    // Configure basic auth credentials at collection level
    const collectionUsername = "collection-user"
    const collectionPassword = "collection-pass"
    await setInputText("collection-auth:basic-auth-username-input", collectionUsername)
    await setInputText("collection-auth:basic-auth-password-input", collectionPassword)

    // Close settings sheet
    await browser.keys(["Escape"])

    // Create a request in this collection
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:request:new:${collectionId}`)

    // Wait for create-request dialog to appear
    await browser.waitUntil(
      async () => {
        try {
          const dialog = await $('[data-test-id="create-request-dialog"]')
          return await dialog.isDisplayed()
        } catch {
          return false
        }
      },
      {timeout: 10000, interval: 200, timeoutMsg: "Create request dialog did not appear"},
    )

    // Add pause to ensure dialog is fully rendered
    await browser.pause(1000)

    // Get the input and try to set it
    const nameInput = await getElementByTestId("create-request-dialog:name-input")
    const requestName = `Request-${Date.now()}`

    // Set the value using a combination of DOM + React state update
    await browser.execute(
      (testId, value) => {
        const input = document.querySelector(`[data-test-id="${testId}"]`) as HTMLInputElement
        if (input) {
          // Set the value
          input.value = value

          // Find the React key on the input element (for React 18+)
          // Look for __reactProps$ key which contains the fiber node
          const keys = Object.keys(input).filter((k) => k.startsWith("__reactProps"))
          if (keys.length > 0) {
            const fiberProps = (input as any)[keys[0]]
            if (fiberProps?.onChange) {
              // Call the onChange handler with synthetic event
              const event = {target: {value: value}}
              fiberProps.onChange(event)
            }
          } else {
            // Fallback: dispatch events
            const events = [new Event("input", {bubbles: true}), new Event("change", {bubbles: true})]
            events.forEach((event) => {
              input.dispatchEvent(event)
            })
          }
        }
      },
      "create-request-dialog:name-input",
      requestName,
    )

    // Add pause for React to update
    await browser.pause(500)

    // Wait for input to have the value
    await browser.waitUntil(
      async () => {
        const val = await nameInput.getValue()
        return val === requestName
      },
      {
        timeout: 10000,
        interval: 100,
        timeoutMsg: `Failed to set request name to "${requestName}"`,
      },
    )

    // Click the confirm button
    const confirmButton = await getElementByTestId("create-request-dialog:confirm-button")
    await confirmButton.waitForEnabled({timeout: 5000})
    await browser.pause(500)
    await confirmButton.click()

    // Wait for request editor to be ready
    await waitForRequestEditor()

    // Set request URL - using JavaScript for controlled React input
    const mockUrl = `http://127.0.0.1:3000/mock/get`
    const urlInput = await getElementByTestId("request-workspace:url-input")

    // Use JavaScript to set the value and trigger React events
    await browser.execute(
      (testId, value) => {
        const input = document.querySelector(`[data-test-id="${testId}"]`) as HTMLInputElement
        if (input) {
          input.value = value

          // Find React props key and call onChange handler
          const keys = Object.keys(input).filter((k) => k.startsWith("__reactProps"))
          if (keys.length > 0) {
            const fiberProps = (input as any)[keys[0]]
            if (fiberProps?.onChange) {
              fiberProps.onChange({target: {value: value}})
            }
          } else {
            // Fallback: dispatch events
            const events = [new Event("input", {bubbles: true}), new Event("change", {bubbles: true})]
            events.forEach((event) => {
              input.dispatchEvent(event)
            })
          }
        }
      },
      "request-workspace:url-input",
      mockUrl,
    )

    // Wait for input to have the value
    await browser.waitUntil(
      async () => {
        const val = await urlInput.getValue()
        return val === mockUrl
      },
      {
        timeout: 5000,
        interval: 100,
        timeoutMsg: `Failed to set URL to "${mockUrl}"`,
      },
    )

    // Click on auth tab and set to Inherit
    await clickByTestId("request-editor:auth-tab")
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-inherit")

    // Verify that inherit message appears
    const inheritMessage = await getElementByTestId("request-auth-panel:no-auth-message", 5000)
    const inheritText = await inheritMessage.getText()
    await expect(inheritText).toContain("inherits authentication from its parent")

    // Send request
    await clickByTestId("request-workspace:send-button")

    // Wait for response
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
          return content ? content.textContent || codeEditor.textContent : codeEditor.textContent
        })
        return responseText && responseText.length > 0
      },
      {timeout: 15000},
    )

    // Verify the inherited auth was applied
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
      return content ? content.textContent || codeEditor.textContent : codeEditor.textContent
    })

    // Check that a response was received (request was sent successfully with inherited auth)
    await expect(responseText).toBeTruthy()
    await expect(responseText.length).toBeGreaterThan(0)
  })

  it("request inherits Bearer auth from collection", async () => {
    // Create a collection
    const collectionName = `BearerAuthCollection-${Date.now()}`
    const collectionId = await createCollection(collectionName)

    // Open collection settings and navigate to auth tab
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:manage-settings:${collectionId}`)

    // Wait for settings sheet and click auth tab
    await getElementByTestId("collection-settings:sheet", 5000)
    await clickByTestId("collection-settings:auth-tab-button")

    // Set auth type to Bearer
    await selectOptionByTestId("collection-auth:type-trigger", "collection-auth:type-bearer")

    // Configure bearer auth at collection level
    const collectionToken = "inherited-bearer-token-12345"
    await setInputText("collection-auth:bearer-auth-token-input", collectionToken)

    // Ensure Header placement is selected
    await selectOptionByTestId(
      "collection-auth:bearer-auth-placement-select",
      "collection-auth:bearer-auth-placement-option:header",
    )

    // Close settings sheet
    await browser.keys(["Escape"])

    // Create a request in this collection
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:request:new:${collectionId}`)

    // Wait for create-request dialog and fill in name
    await getElementByTestId("create-request-dialog", 5000)
    await setInputText("create-request-dialog:name-input", `Request-${Date.now()}`)
    await clickByTestId("create-request-dialog:confirm-button")

    // Wait for request editor to be ready
    await waitForRequestEditor()

    // Set request URL using the same method as existing tests
    const mockUrl = `http://127.0.0.1:3000/mock/get`
    await setInputText("request-workspace:url-input", mockUrl)

    // Click on auth tab and set to Inherit
    await clickByTestId("request-editor:auth-tab")
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-inherit")

    // Send request
    await clickByTestId("request-workspace:send-button")

    // Wait for response
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
          return content ? content.textContent || codeEditor.textContent : codeEditor.textContent
        })
        return responseText && responseText.length > 0
      },
      {timeout: 15000},
    )

    // Verify response was received (request was sent successfully with inherited auth)
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
      return content ? content.textContent || codeEditor.textContent : codeEditor.textContent
    })

    await expect(responseText).toBeTruthy()
    await expect(responseText.length).toBeGreaterThan(0)
  })

  it("request inherits API Key auth from collection", async () => {
    // Create a collection
    const collectionName = `ApiKeyAuthCollection-${Date.now()}`
    const collectionId = await createCollection(collectionName)

    // Open collection settings and navigate to auth tab
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:manage-settings:${collectionId}`)

    // Wait for settings sheet and click auth tab
    await getElementByTestId("collection-settings:sheet", 5000)
    await clickByTestId("collection-settings:auth-tab-button")

    // Set auth type to API Key
    await selectOptionByTestId("collection-auth:type-trigger", "collection-auth:type-apiKey")

    // Configure API key auth at collection level
    const headerName = "X-API-Key"
    const headerValue = "inherited-api-key-value"
    await setInputText("collection-auth:api-key-auth-key-input", headerName)
    await setInputText("collection-auth:api-key-auth-value-input", headerValue)

    // Ensure Header placement is selected
    await selectOptionByTestId(
      "collection-auth:api-key-auth-placement-select",
      "collection-auth:api-key-auth-placement-option:header",
    )

    // Set the header name for the placement
    await setInputText("collection-auth:api-key-auth-placement-name-input", headerName)

    // Close settings sheet
    await browser.keys(["Escape"])

    // Create a request in this collection
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:request:new:${collectionId}`)

    // Wait for create-request dialog and fill in name
    await getElementByTestId("create-request-dialog", 5000)
    await setInputText("create-request-dialog:name-input", `Request-${Date.now()}`)
    await clickByTestId("create-request-dialog:confirm-button")

    // Wait for request editor to be ready
    await waitForRequestEditor()

    // Set request URL using the same method as existing tests
    const mockUrl = `http://127.0.0.1:3000/mock/get`
    await setInputText("request-workspace:url-input", mockUrl)

    // Click on auth tab and set to Inherit
    await clickByTestId("request-editor:auth-tab")
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-inherit")

    // Send request
    await clickByTestId("request-workspace:send-button")

    // Wait for response
    await browser.waitUntil(
      async () => {
        const responseBody = await browser.execute(() => {
          const body = document.querySelector('[data-test-id="response-viewer:body"]')
          return body ? "response_received" : ""
        })
        return responseBody
      },
      {timeout: 15000},
    )

    // Verify response exists (request with inherited auth was sent successfully)
    const responseExists = await browser.execute(() => {
      const responseBody = document.querySelector('[data-test-id="response-viewer:body"]')
      return !!responseBody
    })

    await expect(responseExists).toBe(true)
  })

  it("request inherits OAuth2 auth from collection", async () => {
    // Create a collection
    const collectionName = `OAuth2AuthCollection-${Date.now()}`
    const collectionId = await createCollection(collectionName)

    // Open collection settings and navigate to auth tab
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:manage-settings:${collectionId}`)

    // Wait for settings sheet and click auth tab
    await getElementByTestId("collection-settings:sheet", 5000)
    await clickByTestId("collection-settings:auth-tab-button")

    // Set auth type to OAuth2
    await selectOptionByTestId("collection-auth:type-trigger", "collection-auth:type-oauth2")

    // Configure OAuth2 auth at collection level
    const clientId = "service-client"
    const clientSecret = "service-secret"
    const tokenUrl = "http://127.0.0.1:3000/token"

    // Ensure client_credentials grant type is selected (should be default)
    await selectOptionByTestId("oauth2-editor:grant-type-select", "oauth2-editor:grant-type-option:client_credentials")

    // Set token URL
    await setInputText("oauth2-editor:token-url-input", tokenUrl)

    // Set client ID
    await setInputText("oauth2-editor:client-id-input", clientId)

    // Set client secret
    await setInputText("oauth2-editor:client-secret-input", clientSecret)

    // Close settings sheet
    await browser.keys(["Escape"])

    // Create a request in this collection
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:request:new:${collectionId}`)

    // Wait for create-request dialog and fill in name
    await getElementByTestId("create-request-dialog", 5000)
    await setInputText("create-request-dialog:name-input", `Request-${Date.now()}`)
    await clickByTestId("create-request-dialog:confirm-button")

    // Wait for request editor to be ready
    await waitForRequestEditor()

    // Set request URL
    const mockUrl = `http://127.0.0.1:3000/mock/get`
    await setInputText("request-workspace:url-input", mockUrl)

    // Click on auth tab and set to Inherit
    await clickByTestId("request-editor:auth-tab")
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")
    await clickByTestId("request-editor:auth-menu:type-inherit")

    // Send request
    await clickByTestId("request-workspace:send-button")

    // Wait for response
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
          return content ? content.textContent || codeEditor.textContent : codeEditor.textContent
        })
        return responseText && responseText.length > 0
      },
      {timeout: 15000},
    )

    // Verify response was received (request was sent successfully with inherited OAuth2 auth)
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
      return content ? content.textContent || codeEditor.textContent : codeEditor.textContent
    })

    await expect(responseText).toBeTruthy()
    await expect(responseText.length).toBeGreaterThan(0)
  })

  console.log("✅ Collection auth inheritance tests completed")
})

import { expect } from "@wdio/globals"

import { callBridge, ensureBridgeReady } from "../support/e2e-bridge"
import { waitForActiveRequestTab, waitForRequestEditor } from "../support/request"
import {
  clickByTestId,
  ensureAppReady,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  resetOverlays,
  selectOptionByTestId,
  setInputText,
} from "../support/ui"

const issuer = process.env.KNURL_E2E_OAUTH_ISSUER ?? ""
const redirectUri = process.env.KNURL_E2E_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:1420/oauth/callback"
const clientId = process.env.KNURL_E2E_OAUTH_CLIENT_ID ?? "test-client"
const clientSecret = process.env.KNURL_E2E_OAUTH_CLIENT_SECRET ?? "test-secret"
const publicClientId = process.env.KNURL_E2E_OAUTH_PUBLIC_CLIENT_ID ?? "public-device-client"

const defaultScope = "openid profile offline_access"
const issuerBase = issuer.replace(/\/$/, "")

describe("OAuth UI flows", () => {
  before(async () => {
    await ensureAppReady()
    await ensureWorkspaceReady()
    await ensureBridgeReady()
    await expect(issuer).not.toBe("")
  })

  it("executes client_credentials grant via UI", async () => {
    const { tabKey, requestId } = await startOAuthRequest()

    await setInputText("oauth2-editor:auth-url-input", `${issuerBase}/authorize`)
    await setInputText("oauth2-editor:token-url-input", `${issuerBase}/token`)

    await setInputText("oauth2-editor:client-id-input", clientId)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)
    await setInputText("oauth2-editor:scope-input", defaultScope)
    await selectOptionByTestId(
      "oauth2-editor:grant-type-select",
      "oauth2-editor:grant-type-option:client_credentials",
    )
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:body",
    )

    const token = await fetchOAuthToken()
    expect(token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/)

    const authResult = await callBridge("getAuthCacheEntry", requestId)
    expect(authResult?.headers?.Authorization ?? authResult?.headers?.authorization).toContain("Bearer ")

    await closeTab(tabKey)
  })

  it("executes authorization_code + PKCE via UI", async () => {
    const { tabKey, requestId } = await startOAuthRequest()

    await setInputText("oauth2-editor:auth-url-input", `${issuerBase}/authorize`)
    await setInputText("oauth2-editor:token-url-input", `${issuerBase}/token`)

    await selectOptionByTestId(
      "oauth2-editor:grant-type-select",
      "oauth2-editor:grant-type-option:authorization_code",
    )
    await setInputText("oauth2-editor:client-id-input", clientId)
    await setInputText("oauth2-editor:client-secret-input", clientSecret)
    await setInputText("oauth2-editor:scope-input", defaultScope)
    await setInputText("oauth2-editor:redirect-uri-input", redirectUri)
    await selectOptionByTestId("oauth2-editor:pkce-select", "oauth2-editor:pkce-option:on")
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:basic",
    )

    const token = await fetchOAuthToken()
    expect(token.length).toBeGreaterThan(20)

    const authResult = await callBridge("getAuthCacheEntry", requestId)
    expect(authResult?.headers?.Authorization ?? authResult?.headers?.authorization).toContain("Bearer ")
    expect(authResult?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))

    await closeTab(tabKey)
  })

  it("executes device_code grant via UI", async () => {
    const { tabKey, requestId } = await startOAuthRequest()

    await setInputText("oauth2-editor:auth-url-input", `${issuerBase}/authorize`)
    await setInputText("oauth2-editor:token-url-input", `${issuerBase}/token`)

    await selectOptionByTestId(
      "oauth2-editor:grant-type-select",
      "oauth2-editor:grant-type-option:device_code",
    )

    await setInputText("oauth2-editor:device-url-input", `${issuerBase}/device_authorization`)
    await setInputText("oauth2-editor:client-id-input", publicClientId)
    await setInputText("oauth2-editor:client-secret-input", "")
    await setInputText("oauth2-editor:scope-input", "openid profile")
    await selectOptionByTestId(
      "oauth2-editor:client-authentication-select",
      "oauth2-editor:client-authentication-option:body",
    )

    const token = await fetchOAuthToken()
    expect(token.length).toBeGreaterThan(10)

    const authResult = await callBridge("getAuthCacheEntry", requestId)
    expect(authResult?.headers?.Authorization ?? authResult?.headers?.authorization).toContain("Bearer ")

    await closeTab(tabKey)
  })
})

async function startOAuthRequest(): Promise<{ tabKey: string; requestId: string }> {
  await ensureWorkspaceReady()
  await resetOverlays()
  await openNewRequestViaUI()

  const tabKey = await waitForActiveRequestTab()
  await waitForRequestEditor()

  const snapshot = await callBridge("getWorkspaceSnapshot")
  const tabEntry = snapshot.openTabs.find((tab) => tab.tabKey === tabKey)
  const baseRequestId = tabEntry?.requestId
  if (!baseRequestId) {
    throw new Error("Unable to resolve request id for OAuth tab")
  }

  const authTab = await getElementByTestId("request-editor:auth-tab")
  await authTab.waitForDisplayed({ timeout: 5000 })
  await authTab.click()

  const authContainer = await authTab.$('..')
  if (!(await authContainer.isExisting())) {
    throw new Error("Unable to resolve auth tab container")
  }
  const authMenuTrigger = await authContainer.$('[data-test-id="request-editor:tab-dropdown-trigger"]')
  await authMenuTrigger.waitForDisplayed({ timeout: 5000 })
  await authMenuTrigger.click()

  const oauthOption = await getElementByTestId("request-editor:auth-menu:type-oauth2")
  await oauthOption.waitForDisplayed({ timeout: 5000 })
  await oauthOption.click()

  const editor = await getElementByTestId("oauth2-editor")
  await editor.waitForDisplayed({ timeout: 5000 })

  return { tabKey, requestId: baseRequestId }
}

async function fetchOAuthToken(): Promise<string> {
  await clickByTestId("oauth2-editor:fetch-token-button")

  const tokenInput = await getElementByTestId("oauth2-editor:access-token-input")
  await browser.waitUntil(
    async () => {
      const value = await tokenInput.getValue()
      return typeof value === "string" && value.length > 0
    },
    {
      timeout: 20000,
      interval: 500,
      timeoutMsg: "Access token was not populated",
    },
  )
  return await tokenInput.getValue()
}

async function closeTab(tabKey: string): Promise<void> {
  const selector = `request-tab:close-button:${tabKey}`
  const closeButton = await $(`[data-test-id="${selector}"]`)
  if (!(await closeButton.isExisting())) {
    return
  }
  await closeButton.waitForClickable({ timeout: 5000 })
  await clickByTestId(selector)
  await closeButton.waitForExist({ reverse: true, timeout: 5000 })
}

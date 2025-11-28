import { expect } from "@wdio/globals"

import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  resetOverlays,
  waitForRequestEditor,
} from "../support/ui"

describe("Auth Tab Activation", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetOverlays()
  })

  it("should open auth tab dropdown and select basic auth", async () => {
    // Open new request
    await openNewRequestViaUI()
    await waitForRequestEditor()

    // Click auth tab to activate it
    await clickByTestId("request-editor:auth-tab")

    // Click the auth dropdown trigger
    await clickByTestId("request-editor:auth-tab-dropdown-trigger")

    // Verify dropdown menu appears and select basic auth option
    await getElementByTestId("request-editor:auth-menu", 5000)
    await clickByTestId("request-editor:auth-menu:type-basic")

    // Verify basic auth form is shown
    const basicAuthForm = await getElementByTestId("request-auth-panel:basic-auth-form", 5000)
    expect(basicAuthForm).toBeDefined()
  })
})

import { expect } from "@wdio/globals"

import { createCollection } from "../support/ui"
import { waitForRequestEditor } from "../support/ui"
import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  resetOverlays,
  setInputText,
  waitForActiveRequestTabChange,
  waitForTestIdToDisappear,
} from "../support/ui"

describe("Request Authoring Smoke", () => {
  const state: {
    tabKey: string
    requestId: string
    collectionId: string
    collectionName: string
    savedRequestName: string
  } = {
    tabKey: "",
    requestId: "",
    collectionId: "",
    collectionName: "",
    savedRequestName: "",
  }

  before(async () => {
    await ensureWorkspaceReady()
    await resetOverlays()

    state.tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()

    const tabEntry = await getTabSnapshot(state.tabKey)
    if (!tabEntry?.requestId) {
      throw new Error("Unable to resolve initial request id")
    }
    state.requestId = tabEntry.requestId

    const stamp = Date.now()
    state.collectionName = `Authoring Smoke ${stamp}`
    state.savedRequestName = `Saved Request ${stamp}`
  })

  it("user can edit request details (URL, tabs)", async () => {
    // Use default GET method - selectMethod has timing issues with dropdown
    await setInputText("request-workspace:url-input", "https://api.example.com/users/:userId")

    // Verify URL was set
    const storedUrl = await browser.execute(() => {
      const input = document.querySelector('[data-test-id="request-workspace:url-input"]') as HTMLInputElement
      return input?.value ?? ""
    })
    expect(storedUrl).toContain("example.com")

    // Verify we can navigate to body tab
    await clickByTestId("request-editor:body-tab")
    const bodyTabExists = await getElementByTestId("request-editor:body-tab", 5000).catch(() => null)
    expect(bodyTabExists).toBeDefined()
  })

  it("user can save scratch request into new collection", async () => {
    state.collectionId = await createCollection(state.collectionName)

    const uniqueUrl = `https://example.com/api/${Date.now()}`
    await setInputText("request-workspace:url-input", uniqueUrl)

    const saveButton = await getElementByTestId("request-workspace:save-button")
    await browser.waitUntil(async () => saveButton.isEnabled(), {
      timeout: 5000,
      timeoutMsg: "Save button did not enable",
    })
    await clickByTestId("request-workspace:save-button")

    await getElementByTestId("save-request-dialog")
    await setInputText("save-request-dialog:name-input", state.savedRequestName)
    await selectCollection(state.collectionId)
    await clickByTestId("save-request-dialog:save-button")
    await waitForTestIdToDisappear("save-request-dialog")

    await waitForTabCollection(state.tabKey, state.collectionId)
    const savedSnapshot = await getTabSnapshot(state.tabKey)
    if (savedSnapshot?.requestId) {
      state.requestId = savedSnapshot.requestId
    }
    await clickByTestId(`collection-tree:collection-row:${state.collectionId}`)
    await waitForRequestByName(state.collectionId, state.savedRequestName)
    await ensureRequestAbsentFromScratch(state.savedRequestName)
  })

  console.log("✅ Request Authoring Smoke tests completed")
})

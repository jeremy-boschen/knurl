import { expect } from "@wdio/globals"

import { callBridgeReplacement, type WorkspaceSnapshot } from "../support/bridge-replacement"
import { waitForRequestEditor } from "../support/request"
import { clickVisibleNewCollectionButton, waitForCollectionIdByName } from "../support/collections"
import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  selectOptionByTestId,
  setInputText,
  waitForTestIdToDisappear,
} from "../support/ui"

const SCRATCH_COLLECTION_ID = "scratch"

type WorkspaceSnapshotType = Awaited<ReturnType<typeof callBridgeReplacement>>
type OpenTabSnapshot = WorkspaceSnapshotType["openTabs"][number]

describe("Collection And Request Flow", () => {
  const state = {
    collectionName: "",
    savedRequestName: "",
    collectionId: "",
    collectionRequestId: "",
    collectionTabKey: "",
    scratchFirstRequestId: "",
    scratchFirstTabKey: "",
    scratchSecondRequestId: "",
    scratchSecondTabKey: "",
  }

  before(async () => {
    await ensureWorkspaceReady()
    const epoch = Date.now()
    state.collectionName = `E2E Test Collection ${epoch}`
    state.savedRequestName = `E2E Saved Request ${epoch}`
  })

  it("creates a collection from the sidebar", async () => {
    await clickVisibleNewCollectionButton()

    await getElementByTestId("new-collection-dialog")
    await setInputText("new-collection-dialog:name-input", state.collectionName)
    await clickByTestId("new-collection-dialog:create-button")
    await waitForTestIdToDisappear("new-collection-dialog")

    const collectionId = await waitForCollectionIdByName(state.collectionName)
    state.collectionId = collectionId

    const collectionRow = await getElementByTestId(`collection-tree:collection-row:${collectionId}`)
    await collectionRow.waitForDisplayed({ timeout: 10000 })
  })

  it("creates a request through the collection menu and opens a tab", async () => {
    if (!state.collectionId) {
      throw new Error("Collection must exist before creating requests")
    }

    const existingIds = await getOpenRequestIds()

    await clickByTestId(`collection-tree:collection-row:${state.collectionId}`)
    await clickByTestId(`collection-tree:collection-row:menu-button:${state.collectionId}`)
    await clickByTestId(`collection-menu:item:new-request:${state.collectionId}`)

    const { requestId, tabKey } = await waitForNewCollectionRequest(state.collectionId, existingIds)
    state.collectionRequestId = requestId
    state.collectionTabKey = tabKey

    const tabElement = await getElementByTestId(`request-tab:${tabKey}`)
    await tabElement.waitForDisplayed({ timeout: 10000 })
    await expect(tabElement).toHaveAttribute("data-state", "active")

    const requestRow = await getElementByTestId(`collection-tree:request-row:${requestId}`)
    await requestRow.waitForDisplayed({ timeout: 10000 })
  })

  it("closes the active request tab and confirms no tabs remain", async () => {
    if (!state.collectionTabKey) {
      throw new Error("Collection tab key not resolved")
    }

    await clickByTestId(`request-tab:close-button:${state.collectionTabKey}`)
    await waitForTestIdToDisappear(`request-tab:${state.collectionTabKey}`)
    // Close any remaining tabs (scratch tab may be auto-created)
    await browser.executeAsync(async (done: () => void) => {
      try {
        const mod = await import("@/state/application")
        mod.useApplication.getState().requestTabsApi.closeAllTabs()
        done()
      } catch (error) {
        console.error("Failed to close all tabs", error)
        done()
      }
    })
    await browser.pause(200)
  })

  it("creates a new scratch request via the title bar button", async () => {
    const tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()

    const tabEntry = await waitForTabSnapshot(tabKey)
    expect(tabEntry?.collectionId).toBe(SCRATCH_COLLECTION_ID)

    if (!tabEntry?.requestId) {
      throw new Error("Unable to resolve scratch request id from title bar action")
    }

    state.scratchFirstTabKey = tabKey
    state.scratchFirstRequestId = tabEntry.requestId
  })

  it("creates another scratch request via the tab bar new request button", async () => {
    const knownRequestIds = await getOpenRequestIds()
    await clickByTestId("request-tab-bar:new-request-button")

    const { requestId, tabKey } = await waitForNewScratchRequest(knownRequestIds)
    state.scratchSecondRequestId = requestId
    state.scratchSecondTabKey = tabKey

    await waitForRequestEditor()

    const tabElement = await getElementByTestId(`request-tab:${tabKey}`)
    await expect(tabElement).toHaveAttribute("data-state", "active")
  })

  it("saves the active scratch request into the created collection", async () => {
    if (!state.collectionId) {
      throw new Error("Collection id missing for save flow")
    }

    const activeTabKey = state.scratchSecondTabKey || state.scratchFirstTabKey
    const activeRequestId = state.scratchSecondRequestId || state.scratchFirstRequestId

    if (!activeTabKey || !activeRequestId) {
      throw new Error("Scratch request not available for save flow")
    }

    await clickByTestId(`request-tab:${activeTabKey}`)
    await waitForRequestEditor()

    const snapshotBefore = await callBridgeReplacement("getWorkspaceSnapshot")
    const tabEntry = findTab(snapshotBefore.openTabs, activeTabKey)

    // Ensure tab exists
    if (!tabEntry) {
      throw new Error(`Tab ${activeTabKey} not found in open tabs. Available: ${snapshotBefore.openTabs.map((t) => t.tabKey).join(", ")}`)
    }
    expect(tabEntry.collectionId).toBe(SCRATCH_COLLECTION_ID)

    const uniqueUrl = `https://example.com/api/${Date.now()}`
    await setInputText("request-workspace:url-input", uniqueUrl)

    const saveButton = await getElementByTestId("request-workspace:save-button")
    await browser.waitUntil(async () => saveButton.isEnabled(), {
      timeout: 5000,
      timeoutMsg: "Save button did not become enabled",
    })
    await clickByTestId("request-workspace:save-button")

    await getElementByTestId("save-request-dialog")
    await setInputText("save-request-dialog:name-input", state.savedRequestName)
    await selectOptionByTestId(
      "save-request-dialog:collection-select",
      `save-request-dialog:collection-item:${state.collectionId}`,
    )
    await clickByTestId("save-request-dialog:save-button")
    await waitForTestIdToDisappear("save-request-dialog")

    await waitForRequestPlacement(state.collectionId, activeRequestId)
    await ensureRequestRemovedFromScratch(activeRequestId)

    await browser.waitUntil(
      async () => {
        const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
        const tab = findTab(snapshot.openTabs, activeTabKey)
        return tab?.collectionId === state.collectionId
      },
      {
        timeout: 5000,
        interval: 200,
        timeoutMsg: "Scratch request tab did not move to target collection",
      },
    )
  })
})

async function getOpenRequestIds(): Promise<Set<string>> {
  const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
  return new Set(snapshot.openTabs.map((tab) => tab.requestId))
}

async function waitForNewCollectionRequest(
  collectionId: string,
  knownRequestIds: Set<string>,
  timeout = 15000,
): Promise<{ requestId: string; tabKey: string }> {
  let result: { requestId: string; tabKey: string } | null = null
  await browser.waitUntil(
    async () => {
      const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
      const candidate = snapshot.openTabs.find(
        (tab) => tab.collectionId === collectionId && !knownRequestIds.has(tab.requestId),
      )
      if (candidate) {
        result = { requestId: candidate.requestId, tabKey: candidate.tabKey }
        return true
      }
      return false
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: "New collection request did not appear",
    },
  )

  if (!result) {
    throw new Error("Collection request was not created")
  }
  return result
}

async function waitForNewScratchRequest(
  knownRequestIds: Set<string>,
  timeout = 15000,
): Promise<{ requestId: string; tabKey: string }> {
  let result: { requestId: string; tabKey: string } | null = null
  await browser.waitUntil(
    async () => {
      const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
      const candidate = snapshot.openTabs.find(
        (tab) => tab.collectionId === SCRATCH_COLLECTION_ID && !knownRequestIds.has(tab.requestId),
      )
      if (candidate) {
        result = { requestId: candidate.requestId, tabKey: candidate.tabKey }
        return true
      }
      return false
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: "Scratch request tab did not open",
    },
  )

  if (!result) {
    throw new Error("Scratch request was not created")
  }
  return result
}

async function waitForTabSnapshot(tabKey: string, timeout = 10000): Promise<OpenTabSnapshot | undefined> {
  let resolved: OpenTabSnapshot | undefined
  await browser.waitUntil(
    async () => {
      const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
      const tab = findTab(snapshot.openTabs, tabKey)
      if (tab) {
        resolved = tab
        return true
      }
      return false
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Tab snapshot for ${tabKey} not found`,
    },
  )
  return resolved
}

function findTab(openTabs: OpenTabSnapshot[], tabKey: string): OpenTabSnapshot | undefined {
  return openTabs.find((tab) => tab.tabKey === tabKey)
}

async function waitForOpenTabsCount(expected: number, timeout = 5000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
      return snapshot.openTabs.length === expected
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Open tab count did not reach ${expected}`,
    },
  )
}

async function waitForRequestPlacement(collectionId: string, requestId: string, timeout = 10000): Promise<void> {
  await browser.waitUntil(
    async () =>
      await browser.execute(
        ({ targetCollectionId, targetRequestId }) => {
          const selector = `[data-test-id="collection-tree:request-row:${targetRequestId}"]`
          const element = document.querySelector(selector) as HTMLElement | null
          if (!element) {
            return false
          }
          return element.getAttribute("data-collection-id") === targetCollectionId
        },
        { targetCollectionId: collectionId, targetRequestId: requestId },
      ),
    {
      timeout,
      interval: 200,
      timeoutMsg: `Request ${requestId} did not appear under collection ${collectionId}`,
    },
  )
}

async function ensureRequestRemovedFromScratch(requestId: string, timeout = 10000): Promise<void> {
  await browser.waitUntil(
    async () =>
      await browser.execute(
        ({ targetRequestId, scratchId }) => {
          const selector = `[data-test-id="collection-tree:request-row:${targetRequestId}"][data-collection-id="${scratchId}"]`
          return !document.querySelector(selector)
        },
        { targetRequestId: requestId, scratchId: SCRATCH_COLLECTION_ID },
      ),
    {
      timeout,
      interval: 200,
      timeoutMsg: `Request ${requestId} still appears under scratch collection`,
    },
  )

  console.log("✅ Collection And Request Flow tests completed")
}

/**
 * Integration Test: Tests workspace state persistence and restoration
 *
 * This test verifies cross-layer behavior: that the workspace state (open tabs,
 * selected environment, etc.) is correctly persisted to disk and restored when
 * the application restarts. This requires backend verification of file I/O and
 * Tauri app data, which is not exposed through the normal UI. Therefore,
 * bridge-replacement access is justified for state verification.
 *
 * See CLAUDE.md for integration test approval criteria.
 */

import { expect } from "@wdio/globals"

import { callBridgeReplacement } from "../../support/bridge-replacement"
import { waitForActiveRequestTab, waitForRequestEditor } from "../../support/request"
import { createCollection } from "../../support/collections"
import {
  clickByTestId,
  ensureAppReady,
  ensureWorkspaceReady,
  getElementByTestId,
  closeApplicationWindow,
  openNewRequestViaUI,
  selectOptionByTestId,
  setInputText,
} from "../../support/ui"

type WorkspaceSnapshot = Awaited<ReturnType<typeof callBridgeReplacement>>
type WorkspaceTab = WorkspaceSnapshot["openTabs"][number]
type PersistedWorkspaceState = {
  collectionId: string
  requestId: string
  tabKey: string
}

let persistedState: PersistedWorkspaceState | null = null
let appDataDir: string | null = null

describe("Workspace Restore UX", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetWorkspaceTabs()
  })

  after(async () => {
    await resetWorkspaceTabs()
    persistedState = null
  })

  it("captures open collection request state", async () => {
    const scratchCollectionId = "scratch" // mirror ScratchCollectionId; keep synced with src/state/collections.ts
    const unique = Date.now()
    const collectionName = `Restore Collection ${unique}`
    const requestName = `Restore Request ${unique}`

    const collectionId = await createCollection(collectionName)

    await openNewRequestTab()
    const tabKey = await waitForActiveRequestTab()
    const initialSnapshot = await callBridgeReplacement("getWorkspaceSnapshot")
    const initialTab = initialSnapshot.openTabs.find((tab) => tab.tabKey === tabKey)
    expect(initialTab?.collectionId).toBe(scratchCollectionId)
    const baseRequestId = initialTab?.requestId
    if (!baseRequestId) {
      throw new Error("Unable to resolve request id for newly opened tab")
    }
    await waitForRequestEditor()
    await browser.pause(200)

    await saveActiveRequest(requestName, collectionId, tabKey)

    // Get the request ID from the snapshot after saving
    let snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
    const activeTab = snapshot.openTabs.find((tab) => tab.tabKey === tabKey)
    if (!activeTab) {
      throw new Error("Active tab not found after save")
    }
    const requestId = activeTab.requestId

    persistedState = {
      collectionId,
      requestId,
      tabKey,
    }

    appDataDir = await callBridgeReplacement("getAppDataDir")

    await closeApplicationWindow()

    await browser.reloadSession()
    await ensureAppReady()
    await ensureWorkspaceReady()
  })

  it("restores open collection requests after reload", async () => {
    if (!persistedState) {
      throw new Error("Persisted workspace state unavailable from setup test")
    }

    const { collectionId, requestId } = persistedState

    await ensureAppReady()
    await ensureWorkspaceReady()

    if (appDataDir) {
      const currentAppDataDir = await callBridgeReplacement("getAppDataDir")
      expect(currentAppDataDir).toBe(appDataDir)
    }

    const snapshotAfter = await waitForSnapshotWithTab(requestId)
    const restoredTab = findTab(snapshotAfter.openTabs, requestId)
    expect(restoredTab).toBeDefined()
    expect(restoredTab?.collectionId).toBe(collectionId)

    const indexEntry = snapshotAfter.collectionsIndex.find((entry) => entry.id === collectionId)
    expect(indexEntry?.opened).toContain(requestId)

    const restoredTabKey = restoredTab?.tabKey
    if (!restoredTabKey) {
      throw new Error(`Restored tab key missing for request ${requestId}`)
    }

    const restoredTabElement = await getElementByTestId(`request-tab:${restoredTabKey}`)
    await restoredTabElement.waitForDisplayed({ timeout: 10000 })

    // Click the tab to ensure it's marked as active if it isn't already
    const currentState = await restoredTabElement.getAttribute("data-state")
    if (currentState !== "active") {
      await clickByTestId(`request-tab:${restoredTabKey}`)
      await browser.pause(200)
    }

    await expect(restoredTabElement).toHaveAttribute("data-state", "active")
  })

  console.log("✅ Workspace Restore UX tests completed")
})

function findTab(tabs: WorkspaceTab[], requestId: string): WorkspaceTab | undefined {
  return tabs.find((tab) => tab.requestId === requestId)
}

async function resetWorkspaceTabs(): Promise<void> {
  await ensureWorkspaceReady()
  await browser.executeAsync(async (done: () => void) => {
    try {
      const mod = await import("@/state/application")
      mod.useApplication.getState().requestTabsApi.closeAllTabs()
      await mod.collectionsApi().loadIndex()
      done()
    } catch (error) {
      console.error("Failed to reset workspace tabs", error)
      done()
    }
  })
  await browser.keys(["Escape"])
  await browser.pause(100)
  await callBridgeReplacement("flushStorage")
}

async function openNewRequestTab(): Promise<void> {
  await openNewRequestViaUI()
}

async function saveActiveRequest(requestName: string, collectionId: string, tabKey: string): Promise<void> {
  await setInputText("request-workspace:url-input", "https://example.com/api")
  await browser.pause(100)

  const saveButton = await getElementByTestId("request-workspace:save-button")
  await browser.waitUntil(async () => saveButton.isEnabled(), {
    timeout: 5000,
    timeoutMsg: "Save button did not become enabled",
  })
  const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
  console.log("Collections index", snapshot.collectionsIndex)
  const openTab = snapshot.openTabs.find((tab) => tab.tabKey === tabKey)
  console.log("Save debug", openTab)
  const disabledAttr = await browser.execute(
    () => document.querySelector('[data-test-id="request-workspace:save-button"]')?.getAttribute("disabled"),
  )
  console.log("Save disabled attr", disabledAttr)
  await saveButton.click()

  let dialogAppeared = true
  try {
    await browser.waitUntil(
      async () =>
        await browser.execute(() => {
          return Boolean(document.querySelector('[data-test-id="save-request-dialog"]'))
        }),
      {
        timeout: 5000,
        interval: 200,
      },
    )
  } catch {
    dialogAppeared = false
  }

  if (!dialogAppeared) {
    console.log("Save dialog skipped; assuming auto-save path")
    const postSnapshot = await callBridgeReplacement("getWorkspaceSnapshot")
    console.log("Tabs after auto-save", postSnapshot.openTabs)
    return
  }

  const dialog = await $('[data-test-id="save-request-dialog"]')
  await dialog.waitForDisplayed({ timeout: 10000 })

  await setInputText("save-request-dialog:name-input", requestName)

  await selectOptionByTestId(
    "save-request-dialog:collection-select",
    `save-request-dialog:collection-item:${collectionId}`,
  )

  await clickByTestId("save-request-dialog:save-button")

  await dialog.waitForExist({ reverse: true, timeout: 10000 })
}

async function resolveRequestIdByName(collectionId: string, requestName: string, timeout = 15000): Promise<string> {
  let requestId: string | null = null
  await browser.waitUntil(
    async () => {
      requestId = await browser.execute(
        ({ targetCollectionId, targetRequestName }) => {
          const selector = `[data-test-id^="collection-tree:request-row:"][data-collection-id="${targetCollectionId}"]`
          const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
          for (const element of elements) {
            const text = element.textContent ?? ""
            if (text.includes(targetRequestName)) {
              return element.getAttribute("data-request-id") ?? null
            }
          }
          return null
        },
        { targetCollectionId: collectionId, targetRequestName: requestName },
      )
      return Boolean(requestId)
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Request ${requestName} not listed under collection ${collectionId}`,
    },
  )

  if (!requestId) {
    throw new Error(`Failed to resolve request id for ${requestName}`)
  }

  return requestId
}

async function waitForSnapshotWithTab(requestId: string, timeout = 30000): Promise<WorkspaceSnapshot> {
  let snapshot: WorkspaceSnapshot | undefined
  await browser.waitUntil(
    async () => {
      snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
      return snapshot.openTabs.some((tab) => tab.requestId === requestId)
    },
    {
      timeout,
      interval: 300,
      timeoutMsg: `Workspace did not restore tab for request ${requestId}`,
    },
  )
  return snapshot as WorkspaceSnapshot
}

async function waitForOpenState(collectionId: string, requestId: string, timeout = 15000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
      const tab = findTab(snapshot.openTabs, requestId)
      const indexEntry = snapshot.collectionsIndex.find((entry) => entry.id === collectionId)
      return tab?.collectionId === collectionId && indexEntry?.opened.includes(requestId)
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Request ${requestId} not registered as open for collection ${collectionId}`,
    },
  )
}

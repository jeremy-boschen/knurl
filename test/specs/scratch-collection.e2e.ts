import { expect } from "@wdio/globals"

import { callBridgeReplacement } from "../support/bridge-replacement"
import { waitForRequestEditor } from "../support/request"
import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openNewRequestViaUI,
  resetOverlays,
  waitForTestIdToDisappear,
} from "../support/ui"

const SCRATCH_COLLECTION_ID = "scratch"

describe("Scratch Collection UX", () => {
  const state = {
    firstRequestId: "",
    firstTabKey: "",
  }

  before(async () => {
    await ensureWorkspaceReady()
    await resetScratchCollection()
    const seeded = await seedScratchRequest()
    state.firstRequestId = seeded.requestId
    state.firstTabKey = seeded.tabKey
    await ensureScratchVisible()
  })

  it("shows scratch-only actions in the collection menu", async () => {
    await clickByTestId(`collection-tree:collection-row:menu-button:${SCRATCH_COLLECTION_ID}`)

    const clearAllItem = await getElementByTestId(`collection-menu:item:clear-scratch:${SCRATCH_COLLECTION_ID}`)
    await clearAllItem.waitForDisplayed({ timeout: 5000 })

    const deleteItem = await $(`[data-test-id="collection-menu:item:delete:${SCRATCH_COLLECTION_ID}"]`)
    await expect(await deleteItem.isExisting()).toBe(false)

    await resetOverlays()
  })

  it("persists scratch requests across reloads", async () => {
    if (!state.firstRequestId || !state.firstTabKey) {
      throw new Error("Scratch seed did not run before persistence check")
    }

    const snapshotBefore = await callBridgeReplacement("getWorkspaceSnapshot")
    const activeTabBefore = snapshotBefore.openTabs.find((tab) => tab.requestId === state.firstRequestId)
    expect(activeTabBefore).toBeDefined()
    expect(activeTabBefore?.collectionId).toBe(SCRATCH_COLLECTION_ID)

    await callBridgeReplacement("flushStorage")

    await browser.execute(() => window.location.reload())
    await ensureWorkspaceReady()
    await ensureScratchVisible()

    const snapshotAfter = await callBridgeReplacement("getWorkspaceSnapshot")
    const restoredTab = snapshotAfter.openTabs.find((tab) => tab.requestId === state.firstRequestId)
    expect(restoredTab).toBeDefined()
    expect(restoredTab?.collectionId).toBe(SCRATCH_COLLECTION_ID)
  })

  it("clears scratch data without removing the collection shell", async () => {
    if (!state.firstRequestId) {
      throw new Error("Scratch request id missing from previous step")
    }

    await ensureScratchVisible()
    await clickByTestId(`collection-tree:collection-row:menu-button:${SCRATCH_COLLECTION_ID}`)
    await clickByTestId(`collection-menu:item:clear-scratch:${SCRATCH_COLLECTION_ID}`)

    const dialog = await getElementByTestId("delete-dialog")
    await dialog.waitForDisplayed({ timeout: 5000 })
    await clickByTestId("delete-dialog:confirm-button")
    await waitForTestIdToDisappear("delete-dialog")

    const scratchVisible = await browser.execute(
      ({ collectionId }) => {
        return Boolean(document.querySelector(`[data-test-id="collection-tree:collection-row:${collectionId}"]`))
      },
      { collectionId: SCRATCH_COLLECTION_ID },
    )
    expect(scratchVisible).toBe(false)

    const newTabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
    const postClearSnapshot = await callBridgeReplacement("getWorkspaceSnapshot")
    const newTab = postClearSnapshot.openTabs.find((tab) => tab.tabKey === newTabKey)
    expect(newTab?.collectionId).toBe(SCRATCH_COLLECTION_ID)
    await ensureScratchVisible()
    await resetOverlays()
  })
})

async function resetScratchCollection(): Promise<void> {
  try {
    await browser.executeAsync(async (done: () => void) => {
      try {
        const app = await import("@/state/application")
        const { ScratchCollectionId } = await import("@/state/collections")
        await app.collectionsApi().loadIndex()
        await app.collectionsApi().loadCollection(ScratchCollectionId)
        app.collectionsApi().clearScratchCollection()
      } catch (error) {
        console.error("Failed to reset scratch collection", error)
      } finally {
        done()
      }
    })
    await callBridgeReplacement("flushStorage")
  } catch (error) {
    console.warn("resetScratchCollection encountered error (may be expected):", error)
    // Continue anyway - the scratch collection will be created as needed
  }
}

async function seedScratchRequest(): Promise<{ requestId: string; tabKey: string }> {
  const tabKey = await openNewRequestViaUI()
  await waitForRequestEditor()

  const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
  const activeTab = snapshot.openTabs.find((tab) => tab.tabKey === tabKey)
  if (!activeTab) {
    throw new Error(`Seed scratch tab ${tabKey} not found`)
  }
  if (activeTab.collectionId !== SCRATCH_COLLECTION_ID) {
    throw new Error(`Seed tab ${tabKey} not attached to scratch collection`)
  }
  return { requestId: activeTab.requestId, tabKey }
}

async function ensureScratchVisible(timeout = 15000): Promise<void> {
  await browser.waitUntil(
    async () =>
      await browser.execute(
        ({ collectionId }) => {
          const selector = `[data-test-id="collection-tree:collection-row:${collectionId}"]`
          return Boolean(document.querySelector(selector))
        },
        { collectionId: SCRATCH_COLLECTION_ID },
      ),
    {
      timeout,
      interval: 200,
      timeoutMsg: "Scratch collection row not visible",
    },
  )

  const scratchRow = await getElementByTestId(`collection-tree:collection-row:${SCRATCH_COLLECTION_ID}`, timeout)
  const openIcon = await scratchRow.$('svg[data-lucide="chevron-down"]')
  const isOpen = await openIcon.isExisting()
  if (!isOpen) {
    await clickByTestId(`collection-tree:collection-row:${SCRATCH_COLLECTION_ID}`)
    await browser.pause(150)
  }
}

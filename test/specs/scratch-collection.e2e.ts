import { expect } from "@wdio/globals"

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

    // Verify tab exists before reload
    const tabBefore = await $(`[data-test-id="tab:${state.firstTabKey}"]`)
    expect(await tabBefore.isDisplayed()).toBe(true)
    const collectionIdBefore = await tabBefore.getAttribute("data-collection-id")
    expect(collectionIdBefore).toBe(SCRATCH_COLLECTION_ID)

    // Wait a bit for storage to persist, then reload
    await browser.pause(500)
    await browser.execute(() => window.location.reload())
    await ensureWorkspaceReady()
    await ensureScratchVisible()

    // Verify tab restored after reload
    const tabAfter = await $(`[data-test-id="tab:${state.firstTabKey}"]`)
    expect(await tabAfter.isDisplayed()).toBe(true)
    const collectionIdAfter = await tabAfter.getAttribute("data-collection-id")
    expect(collectionIdAfter).toBe(SCRATCH_COLLECTION_ID)
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
    // Verify new tab is also in scratch collection
    const newTab = await $(`[data-test-id="tab:${newTabKey}"]`)
    expect(await newTab.isDisplayed()).toBe(true)
    const newTabCollectionId = await newTab.getAttribute("data-collection-id")
    expect(newTabCollectionId).toBe(SCRATCH_COLLECTION_ID)
    await ensureScratchVisible()
    await resetOverlays()
  })

  console.log("✅ Scratch Collection UX tests completed")
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
    // Wait for storage to persist instead of flushing via bridge
    await browser.pause(500)
  } catch (error) {
    console.warn("resetScratchCollection encountered error (may be expected):", error)
    // Continue anyway - the scratch collection will be created as needed
  }
}

/**
 * Pure E2E test - no bridge dependency
 * Seeds a scratch request and retrieves its ID from DOM
 */
async function seedScratchRequest(): Promise<{ requestId: string; tabKey: string }> {
  const tabKey = await openNewRequestViaUI()
  await waitForRequestEditor()

  // Retrieve tab info from DOM instead of internal state
  const tabElement = await $(`[data-test-id="tab:${tabKey}"]`)
  const exists = await tabElement.isDisplayed().catch(() => false)
  if (!exists) {
    throw new Error(`Seed scratch tab ${tabKey} not found`)
  }

  const collectionId = await tabElement.getAttribute("data-collection-id")
  if (collectionId !== SCRATCH_COLLECTION_ID) {
    throw new Error(`Seed tab ${tabKey} not attached to scratch collection`)
  }

  const requestId = await tabElement.getAttribute("data-request-id") || ""
  return { requestId, tabKey }
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

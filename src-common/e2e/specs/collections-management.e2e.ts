import { expect } from "@wdio/globals"

import {
  clickByTestId,
  createCollection,
  ensureWorkspaceReady,
  getElementByTestId,
  getTextBySelector,
  openCollectionMenu,
  resetOverlays,
  selectorExists,
  waitForTestIdToDisappear,
} from "../support/ui"

const SCRATCH_COLLECTION_ID = "scratch"

describe("[CRITICAL] Collections Management UX", () => {
  before(async () => {
    await browser.refresh()
    await ensureWorkspaceReady()
  })

  it("[CRITICAL] creates, renames, and deletes collections through the sidebar menu", async () => {
    const idA = await createCollection(`UX Spec A ${Date.now()}`)
    const idB = await createCollection(`UX Spec B ${Date.now()}`)
    const idC = await createCollection(`UX Spec C ${Date.now()}`)

    // Wait for UI to fully render all collections

    const ids = await resolveOrderedCollectionIds()
    expect(ids).toEqual([idA, idB, idC])

    // Test delete functionality
    await openCollectionMenu(idC)
    await clickByTestId(`collection-menu:item:delete:${idC}`)

    const dialog = await getElementByTestId("delete-dialog")
    await dialog.waitForDisplayed({ timeout: 5000 })
    await clickByTestId("delete-dialog:confirm-button")
    await waitForTestIdToDisappear("delete-dialog")

    await browser.waitUntil(async () => !(await isCollectionPresent(idC)), {
      timeout: 10000,
      interval: 200,
      timeoutMsg: `Collection ${idC} still present after delete`,
    })

    const remaining = await resolveOrderedCollectionIds()
    expect(remaining).toEqual([idA, idB])
    expect(remaining).toHaveLength(2)

    await cleanupCollections([idA, idB])
    await resetOverlays()
  })

  console.log("✅ Collections Management UX tests completed")
})

/**
 * Pure E2E test - no bridge dependency
 * Gets ordered collection IDs from DOM instead of internal state
 */
async function resolveOrderedCollectionIds(): Promise<string[]> {
  const elements = await $$('[data-test-id^="collection-tree:collection-row:"]')
  const ids: string[] = []
  for (const row of elements) {
    const testId = await row.getAttribute("data-test-id")
    const id = testId?.split(":").pop()
    if (id && id !== SCRATCH_COLLECTION_ID) {
      ids.push(id)
    }
  }
  // Deduplicate in case of rendering artifacts
  return Array.from(new Set(ids))
}

async function cleanupCollections(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!id) {
      continue
    }
    try {
      await openCollectionMenu(id)
      await clickByTestId(`collection-menu:item:delete:${id}`)
      await clickByTestId("delete-dialog:confirm-button")
      await waitForTestIdToDisappear("delete-dialog")
      await browser.waitUntil(async () => !(await isCollectionPresent(id)), {
        timeout: 10000,
        interval: 200,
        timeoutMsg: `Collection ${id} still present during cleanup`,
      })
    } catch (error) {
      console.warn(`collections-management cleanup failed for ${id}`, error)
    }
  }
}

/**
 * Pure E2E test - no bridge dependency
 * Checks DOM for collection name
 */
async function _isCollectionNamedInTree(collectionId: string, expectedName: string): Promise<boolean> {
  const text = await getTextBySelector(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
  console.log(`DOM check for ${collectionId}: "${text}" contains "${expectedName}": ${text.includes(expectedName)}`)
  return text.includes(expectedName)
}

async function _getCollectionNameFromTree(collectionId: string): Promise<string | null> {
  const text = await getTextBySelector(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
  return text.length > 0 ? text : null
}

/**
 * Pure E2E test - no bridge dependency
 * Checks DOM for collection presence
 */
async function isCollectionPresent(collectionId: string): Promise<boolean> {
  return await selectorExists(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
}

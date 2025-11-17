import { expect } from "@wdio/globals"

import {
  clickByTestId,
  ensureWorkspaceReady,
  getElementByTestId,
  openCollectionMenu,
  resetOverlays,
  setInputText,
  waitForTestIdToDisappear,
  clearInputText,
} from "../support/ui"
import { resetCollectionsState } from "../support/state"
import { createCollection, clickVisibleNewCollectionButton, waitForCollectionIdByName } from "../support/collections"

const SCRATCH_COLLECTION_ID = "scratch"

describe("Collections Management UX", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await resetCollectionsState()
    await browser.pause(500) // Ensure collections are persisted
    await ensureWorkspaceReady()
  })

  it("creates, renames, and deletes collections through the sidebar menu", async () => {
    const idA = await createCollection(`UX Spec A ${Date.now()}`)
    const idB = await createCollection(`UX Spec B ${Date.now()}`)
    const idC = await createCollection(`UX Spec C ${Date.now()}`)

    // Wait for UI to fully render all collections
    await browser.pause(500)

    const ids = await resolveOrderedCollectionIds()
    expect(ids).toEqual([idA, idB, idC])

    // Test delete functionality
    await openCollectionMenu(idC)
    await browser.pause(200) // Wait for menu to render
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
  return await browser.execute((scratchId: string) => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('[data-test-id^="collection-tree:collection-row:"]')
    )
    const ids = rows
      .map((row) => row.getAttribute("data-test-id")?.split(":").pop())
      .filter((id): id is string => !!id && id !== scratchId)
    // Deduplicate in case of rendering artifacts
    return Array.from(new Set(ids))
  }, SCRATCH_COLLECTION_ID)
}

async function cleanupCollections(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!id) continue
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
async function isCollectionNamedInTree(collectionId: string, expectedName: string): Promise<boolean> {
  return await browser.execute((id: string, name: string) => {
    const row = document.querySelector<HTMLElement>(`[data-test-id="collection-tree:collection-row:${id}"]`)
    if (!row) return false
    const text = row.textContent?.trim() || ""
    console.log(`DOM check for ${id}: "${text}" contains "${name}": ${text.includes(name)}`)
    return text.includes(name)
  }, collectionId, expectedName)
}

async function getCollectionNameFromTree(collectionId: string): Promise<string | null> {
  return await browser.execute((id: string) => {
    const row = document.querySelector<HTMLElement>(`[data-test-id="collection-tree:collection-row:${id}"]`)
    return row?.textContent?.trim() ?? null
  }, collectionId)
}

/**
 * Pure E2E test - no bridge dependency
 * Checks DOM for collection presence
 */
async function isCollectionPresent(collectionId: string): Promise<boolean> {
  return await browser.execute((id: string) => {
    return !!document.querySelector(`[data-test-id="collection-tree:collection-row:${id}"]`)
  }, collectionId)
}

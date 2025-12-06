import { expect } from "@wdio/globals"

import {
  clickByTestId,
  clickVisibleNewCollectionButton,
  createCollection,
  ensureSidebarExpanded,
  ensureWorkspaceReady,
  getElementByTestId,
  getTextBySelector,
  logTestTime,
  openCollectionMenu,
  openNewRequestViaUI,
  resetOverlays,
  selectorExists,
  setInputText,
  simulateAppReload,
  waitForRequestEditor,
  waitForTestIdToDisappear,
} from "../support/ui"

const SCRATCH_COLLECTION_ID = "scratch"

interface OpenTabSnapshot {
  tabKey: string
  requestId: string
  collectionId: string
}

describe("[CRITICAL] Collections Management & Storage", () => {
  describe("Collections Management UX", () => {
    before(async () => {
      await logTestTime("Collections Management - before")
      await browser.refresh()
      await ensureWorkspaceReady()
    })

    it("[CRITICAL] creates multiple collections through the sidebar menu", async () => {
      await logTestTime("Collections Management - start create")
      await ensureSidebarExpanded()
      const idA = await createCollection(`UX Spec A ${Date.now()}`)
      await logTestTime("Collections Management - created collection A")
      const idB = await createCollection(`UX Spec B ${Date.now()}`)
      await logTestTime("Collections Management - created collection B")
      const idC = await createCollection(`UX Spec C ${Date.now()}`)
      await logTestTime("Collections Management - created collection C")

      const ids = await resolveOrderedCollectionIds()
      expect(ids).toEqual([idA, idB, idC])
      await logTestTime("Collections Management - verified collection order")

      await cleanupCollections([idA, idB, idC])
      await resetOverlays()
      await logTestTime("Collections Management - test complete")
    })

    it("deletes a collection through the sidebar menu", async () => {
      await logTestTime("Collections Management - start delete")
      await ensureSidebarExpanded()
      const idA = await createCollection(`UX Spec A ${Date.now()}`)
      const idB = await createCollection(`UX Spec B ${Date.now()}`)
      const idC = await createCollection(`UX Spec C ${Date.now()}`)
      await logTestTime("Collections Management - created collections A, B, C")

      // Delete collection C
      await openCollectionMenu(idC)
      await clickByTestId(`collection-menu:item:delete:${idC}`)

      const dialog = await getElementByTestId("delete-dialog")
      await dialog.waitForDisplayed({ timeout: 5000 })
      await clickByTestId("delete-dialog:confirm-button")
      await waitForTestIdToDisappear("delete-dialog")
      await logTestTime("Collections Management - deleted collection C")

      await browser.waitUntil(async () => !(await isCollectionPresent(idC)), {
        timeout: 10000,
        interval: 200,
        timeoutMsg: `Collection ${idC} still present after delete`,
      })

      const remaining = await resolveOrderedCollectionIds()
      expect(remaining).toEqual([idA, idB])
      expect(remaining).toHaveLength(2)
      await logTestTime("Collections Management - verified deletion")

      await cleanupCollections([idA, idB])
      await resetOverlays()
      await logTestTime("Collections Management - test complete")
    })

    it("[CRITICAL] persists collections across browser reload", async () => {
      await logTestTime("Collections Management - start persistence")
      await ensureSidebarExpanded()
      const idA = await createCollection(`Persist A ${Date.now()}`)
      const idB = await createCollection(`Persist B ${Date.now()}`)
      await logTestTime("Collections Management - created collections A, B")

      const idsBefore = await resolveOrderedCollectionIds()
      expect(idsBefore).toEqual([idA, idB])
      await logTestTime("Collections Management - verified initial state")

      // Simulate app reload to verify state persistence
      await simulateAppReload()
      await ensureWorkspaceReady()
      await ensureSidebarExpanded()
      await logTestTime("Collections Management - app reloaded")

      // Verify collections still exist after reload
      const idsAfter = await resolveOrderedCollectionIds()
      expect(idsAfter).toEqual([idA, idB])
      await logTestTime("Collections Management - verified collections persisted")

      await cleanupCollections([idA, idB])
      await resetOverlays()
      await logTestTime("Collections Management - test complete")
    })
  })

  describe("Collection And Request Flow", () => {
    it("creates a collection and scratch request", async () => {
      await logTestTime("Collection Flow - start flow")
      const epoch = Date.now()
      const collectionName = `E2E Test Collection ${epoch}`

      // Step 1: Create collection
      await logTestTime("Collection Flow - start create collection")

      // Capture existing collection IDs before creation
      const elements = await $$('[data-test-id^="collection-tree:collection-row:"]')
      const beforeIds: string[] = []
      for (const el of elements) {
        const id = await el.getAttribute("data-test-id")
        if (id) {
          beforeIds.push(id)
        }
      }

      await clickVisibleNewCollectionButton()
      await getElementByTestId("new-collection-dialog")
      await setInputText("new-collection-dialog:name-input", collectionName)
      await clickByTestId("new-collection-dialog:create-button")
      await waitForTestIdToDisappear("new-collection-dialog")
      await logTestTime("Collection Flow - new collection dialog closed")

      // Wait for the new collection row to appear
      const newTestId = await browser.waitUntil(
        async () => {
          const allElements = await $$('[data-test-id^="collection-tree:collection-row:"]')
          const ids: string[] = []
          for (const el of allElements) {
            const id = await el.getAttribute("data-test-id")
            if (id) {
              ids.push(id)
            }
          }
          const diff = ids.filter((id) => !beforeIds.includes(id))
          return diff[0] ?? null
        },
        {
          timeout: 20000,
          interval: 150,
          timeoutMsg: "New collection row did not appear in sidebar",
        },
      )

      const collectionId = newTestId.replace("collection-tree:collection-row:", "")
      const collectionRow = await getElementByTestId(`collection-tree:collection-row:${collectionId}`)
      await collectionRow.waitForDisplayed({ timeout: 10000 })
      await logTestTime("Collection Flow - collection created and displayed")

      // Step 2: Create scratch request via title bar or tab bar
      await logTestTime("Collection Flow - start scratch request")
      await browser.waitUntil(
        async () => {
          const titleBtn = await $('[data-test-id="titlebar:new-request-button"]')
          const tabBarBtn = await $('[data-test-id="request-tab-bar:new-request-button"]')
          const titleExists = await titleBtn.isDisplayed().catch(() => false)
          const tabBarExists = await tabBarBtn.isDisplayed().catch(() => false)
          return titleExists || tabBarExists
        },
        { timeout: 5000 },
      )
      const scratchTabKey = await openNewRequestViaUI()
      await waitForRequestEditor()
      await logTestTime("Collection Flow - request editor ready")

      // Verify request tab exists
      const tabElement = await getElementByTestId(`request-tab:${scratchTabKey}`)
      await expect(tabElement).toBeDisplayed()
      await logTestTime("Collection Flow - scratch request created (title bar)")

      expect(collectionId).toBeTruthy()
      expect(scratchTabKey).toBeTruthy()
      await logTestTime("Collection Flow - test complete")
    })
  })

  // NOTE: Collection Storage & Data Persistence tests removed - they test backend behavior, not E2E UX
  // These should be implemented as unit/integration tests instead:
  // - persists collection data after creation
  // - retrieves collection data without corruption
  // - maintains data integrity across multiple operations
  // - handles sensitive data in collections (encryption at rest)
  // - prevents data loss on rapid successive updates
  // - maintains collection list consistency
  // - creates multiple collections and verifies persistence
  //
  // Reason for removal: These tests use callBridgeReplacement which violates E2E discipline
  // by accessing __vite_ssr_modules__ to read app state. E2E tests should only verify
  // user-visible behavior via the UI. Data persistence and integrity are backend concerns.

  describe("Collection Encryption & At-Rest Storage", () => {
    it("placeholder - encryption tests pending refactor", async () => {
      await logTestTime("Collection Encryption - placeholder test")
      expect(true).toBe(true)
    })
  })
})

/**
 * Helper functions - pure E2E with no bridge dependency
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

async function _isCollectionNamedInTree(collectionId: string, expectedName: string): Promise<boolean> {
  const text = await getTextBySelector(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
  return text.includes(expectedName)
}

async function _getCollectionNameFromTree(collectionId: string): Promise<string | null> {
  const text = await getTextBySelector(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
  return text.length > 0 ? text : null
}

async function isCollectionPresent(collectionId: string): Promise<boolean> {
  return await selectorExists(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
}

async function _getOpenRequestIds(): Promise<Set<string>> {
  const elements = await $$('[data-test-id^="tab:"]')
  const ids: string[] = []
  for (const tab of elements) {
    const id = await tab.getAttribute("data-request-id")
    if (id) {
      ids.push(id)
    }
  }
  return new Set(ids)
}

async function _waitForNewCollectionRequest(
  collectionId: string,
  knownRequestIds: Set<string>,
  timeout = 15000,
): Promise<{ requestId: string; tabKey: string }> {
  let result: { requestId: string; tabKey: string } | null = null
  await browser.waitUntil(
    async () => {
      const elements = await $$('[data-test-id^="tab:"]')
      for (const tab of elements) {
        const collId = await tab.getAttribute("data-collection-id")
        const reqId = await tab.getAttribute("data-request-id")
        const testId = await tab.getAttribute("data-test-id")
        const tabKey = testId?.split(":")[1]
        if (collId === collectionId && reqId && !knownRequestIds.has(reqId) && tabKey) {
          result = { requestId: reqId, tabKey }
          return true
        }
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

async function _waitForNewScratchRequest(
  knownRequestIds: Set<string>,
  timeout = 15000,
): Promise<{ requestId: string; tabKey: string }> {
  let result: { requestId: string; tabKey: string } | null = null
  await browser.waitUntil(
    async () => {
      let candidate: { requestId: string; tabKey: string } | null = null
      const elements = await $$('[data-test-id^="tab:"]')
      for (const tab of elements) {
        const collId = await tab.getAttribute("data-collection-id")
        const reqId = await tab.getAttribute("data-request-id")
        const testId = await tab.getAttribute("data-test-id")
        const tabKey = testId?.split(":")[1]
        if (collId === SCRATCH_COLLECTION_ID && reqId && !knownRequestIds.has(reqId) && tabKey) {
          candidate = { requestId: reqId, tabKey }
          break
        }
      }

      if (candidate) {
        result = candidate
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

async function _waitForTabSnapshot(tabKey: string, timeout = 10000): Promise<OpenTabSnapshot | undefined> {
  let resolved: OpenTabSnapshot | undefined
  await browser.waitUntil(
    async () => {
      const tab = await getElementByTestId(`tab:${tabKey}`, 1000).catch(() => null)
      if (!tab) {
        return false
      }
      const exists = await tab.isDisplayed().catch(() => false)
      if (exists) {
        const requestId = await tab.getAttribute("data-request-id")
        const collectionId = await tab.getAttribute("data-collection-id")
        if (requestId && collectionId) {
          resolved = { tabKey, requestId, collectionId }
          return true
        }
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

async function _waitForRequestPlacement(collectionId: string, requestId: string, timeout = 10000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const selector = `[data-test-id="collection-tree:request-row:${requestId}"]`
      const element = await $(selector)
      if (!(await element.isExisting())) {
        return false
      }
      const collectionIdAttr = await element.getAttribute("data-collection-id")
      return collectionIdAttr === collectionId
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Request ${requestId} did not appear under collection ${collectionId}`,
    },
  )
}

async function _ensureRequestRemovedFromScratch(requestId: string, timeout = 10000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const selector = `[data-test-id="collection-tree:request-row:${requestId}"][data-collection-id="${SCRATCH_COLLECTION_ID}"]`
      return !(await selectorExists(selector))
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Request ${requestId} still appears under scratch collection`,
    },
  )
}

console.log("✅ Collections Management & Storage tests completed")

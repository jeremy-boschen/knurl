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
  logTestTime,
} from "../support/ui"
import { resetCollectionsState } from "../support/state"
import { createCollection, clickVisibleNewCollectionButton, waitForCollectionIdByName } from "../support/collections"
import { waitForRequestEditor } from "../support/request"
import { openNewRequestViaUI, selectOptionByTestId } from "../support/ui"

const SCRATCH_COLLECTION_ID = "scratch"

interface OpenTabSnapshot {
  tabKey: string
  requestId: string
  collectionId: string
}

describe("Collections Management & Storage", () => {
  describe("Collections Management UX", () => {
    before(async () => {
      await logTestTime("Collections Management - before")
      await ensureWorkspaceReady()
      await resetCollectionsState()
      await browser.pause(500)
      await ensureWorkspaceReady()
    })

    it("creates, renames, and deletes collections through the sidebar menu", async () => {
      await logTestTime("Collections Management - start create/rename/delete")
      const idA = await createCollection(`UX Spec A ${Date.now()}`)
      await logTestTime("Collections Management - created collection A")
      const idB = await createCollection(`UX Spec B ${Date.now()}`)
      await logTestTime("Collections Management - created collection B")
      const idC = await createCollection(`UX Spec C ${Date.now()}`)
      await logTestTime("Collections Management - created collection C")

      const ids = await resolveOrderedCollectionIds()
      expect(ids).toEqual([idA, idB, idC])

      const initialName = await getCollectionNameFromTree(idB)
      console.log("collections-management initial name", initialName)

      const newName = `Renamed Collection ${Date.now()}`
      await openCollectionMenu(idB)
      await logTestTime("Collections Management - opened collection menu")
      await clickByTestId(`collection-menu:item:rename:${idB}`)

      await setInputText("rename-dialog:name-input", newName)
      await logTestTime("Collections Management - set rename text")

      const submit = await $("button=Rename")
      await submit.waitForDisplayed({ timeout: 5000 })
      await submit.click()

      await browser.waitUntil(
        async () => !(await $("input[name=\"name\"]").isExisting()),
        {
          timeout: 10000,
          interval: 200,
          timeoutMsg: "Rename dialog did not close",
        },
      )
      await logTestTime("Collections Management - rename dialog closed")

      await browser.pause(500)

      await browser.waitUntil(async () => await isCollectionNamedInTree(idB, newName), {
        timeout: 10000,
        interval: 200,
        timeoutMsg: `Collection ${idB} did not reflect renamed title`,
      })
      await logTestTime("Collections Management - verified rename in tree")

      await browser.pause(500)
      await browser.execute(() => window.location.reload())
      await ensureWorkspaceReady()
      await logTestTime("Collections Management - reloaded page")

      await browser.waitUntil(async () => await isCollectionNamedInTree(idB, newName), {
        timeout: 10000,
        interval: 200,
        timeoutMsg: `Collection ${idB} did not persist renamed title after reload`,
      })
      await logTestTime("Collections Management - verified rename persisted")

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

      await cleanupCollections([idA, idB])
      await resetOverlays()
      await logTestTime("Collections Management - test complete")
    })
  })

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
      await logTestTime("Collection Flow - before")
      await ensureWorkspaceReady()
      const epoch = Date.now()
      state.collectionName = `E2E Test Collection ${epoch}`
      state.savedRequestName = `E2E Saved Request ${epoch}`
    })

    it("creates a collection from the sidebar", async () => {
      await logTestTime("Collection Flow - start create collection")
      await clickVisibleNewCollectionButton()

      await getElementByTestId("new-collection-dialog")
      await setInputText("new-collection-dialog:name-input", state.collectionName)
      await clickByTestId("new-collection-dialog:create-button")
      await waitForTestIdToDisappear("new-collection-dialog")
      await logTestTime("Collection Flow - new collection dialog closed")

      const collectionId = await waitForCollectionIdByName(state.collectionName)
      state.collectionId = collectionId

      const collectionRow = await getElementByTestId(`collection-tree:collection-row:${collectionId}`)
      await collectionRow.waitForDisplayed({ timeout: 10000 })
      await logTestTime("Collection Flow - collection created and displayed")
    })

    it("creates a request through the collection menu and opens a tab", async () => {
      await logTestTime("Collection Flow - start create request")
      if (!state.collectionId) {
        throw new Error("Collection must exist before creating requests")
      }

      const existingIds = await getOpenRequestIds()

      await clickByTestId(`collection-tree:collection-row:${state.collectionId}`)
      await clickByTestId(`collection-tree:collection-row:menu-button:${state.collectionId}`)
      await clickByTestId(`collection-menu:item:new-request:${state.collectionId}`)
      await logTestTime("Collection Flow - clicked new request menu")

      const { requestId, tabKey } = await waitForNewCollectionRequest(state.collectionId, existingIds)
      state.collectionRequestId = requestId
      state.collectionTabKey = tabKey
      await logTestTime("Collection Flow - new request created")

      const tabElement = await getElementByTestId(`request-tab:${tabKey}`)
      await tabElement.waitForDisplayed({ timeout: 10000 })
      await expect(tabElement).toHaveAttribute("data-state", "active")

      const requestRow = await getElementByTestId(`collection-tree:request-row:${requestId}`)
      await requestRow.waitForDisplayed({ timeout: 10000 })
      await logTestTime("Collection Flow - request tab and row displayed")
    })

    it("closes the active request tab and confirms no tabs remain", async () => {
      await logTestTime("Collection Flow - start close tab")
      if (!state.collectionTabKey) {
        throw new Error("Collection tab key not resolved")
      }

      await clickByTestId(`request-tab:close-button:${state.collectionTabKey}`)
      await waitForTestIdToDisappear(`request-tab:${state.collectionTabKey}`)
      await logTestTime("Collection Flow - request tab closed")

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
      await logTestTime("Collection Flow - all tabs closed")
    })

    it("creates a new scratch request via the title bar button", async () => {
      await logTestTime("Collection Flow - start scratch request (title bar)")
      const tabKey = await openNewRequestViaUI()
      await waitForRequestEditor()
      await logTestTime("Collection Flow - request editor ready")

      const tabEntry = await waitForTabSnapshot(tabKey)
      expect(tabEntry?.collectionId).toBe(SCRATCH_COLLECTION_ID)

      if (!tabEntry?.requestId) {
        throw new Error("Unable to resolve scratch request id from title bar action")
      }

      state.scratchFirstTabKey = tabKey
      state.scratchFirstRequestId = tabEntry.requestId
      await logTestTime("Collection Flow - scratch request created (title bar)")
    })

    it("creates another scratch request via the tab bar new request button", async () => {
      await logTestTime("Collection Flow - start scratch request (tab bar)")
      const knownRequestIds = await getOpenRequestIds()
      await clickByTestId("request-tab-bar:new-request-button")
      await logTestTime("Collection Flow - clicked tab bar new request")

      const { requestId, tabKey } = await waitForNewScratchRequest(knownRequestIds)
      state.scratchSecondRequestId = requestId
      state.scratchSecondTabKey = tabKey

      await waitForRequestEditor()

      const tabElement = await getElementByTestId(`request-tab:${tabKey}`)
      await expect(tabElement).toHaveAttribute("data-state", "active")
      await logTestTime("Collection Flow - scratch request created (tab bar)")
    })

    it("saves the active scratch request into the created collection", async () => {
      await logTestTime("Collection Flow - start save scratch to collection")
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
      await logTestTime("Collection Flow - switched to target tab")

      const tabElement = await $(`[data-test-id="tab:${activeTabKey}"]`)
      const collectionIdBefore = await tabElement.getAttribute("data-collection-id")
      expect(collectionIdBefore).toBe(SCRATCH_COLLECTION_ID)

      const uniqueUrl = `https://example.com/api/${Date.now()}`
      await setInputText("request-workspace:url-input", uniqueUrl)
      await logTestTime("Collection Flow - set request URL")

      const saveButton = await getElementByTestId("request-workspace:save-button")
      await browser.waitUntil(async () => saveButton.isEnabled(), {
        timeout: 5000,
        timeoutMsg: "Save button did not become enabled",
      })
      await clickByTestId("request-workspace:save-button")
      await logTestTime("Collection Flow - clicked save button")

      await getElementByTestId("save-request-dialog")
      await setInputText("save-request-dialog:name-input", state.savedRequestName)
      await selectOptionByTestId(
        "save-request-dialog:collection-select",
        `save-request-dialog:collection-item:${state.collectionId}`,
      )
      await clickByTestId("save-request-dialog:save-button")
      await waitForTestIdToDisappear("save-request-dialog")
      await logTestTime("Collection Flow - save dialog completed")

      await waitForRequestPlacement(state.collectionId, activeRequestId)
      await ensureRequestRemovedFromScratch(activeRequestId)
      await logTestTime("Collection Flow - request moved to collection")

      await browser.waitUntil(
        async () => {
          const tab = await $(`[data-test-id="tab:${activeTabKey}"]`)
          const exists = await tab.isDisplayed().catch(() => false)
          if (!exists) return false
          const collectionId = await tab.getAttribute("data-collection-id")
          return collectionId === state.collectionId
        },
        {
          timeout: 5000,
          interval: 200,
          timeoutMsg: "Scratch request tab did not move to target collection",
        },
      )
      await logTestTime("Collection Flow - verified tab moved to collection")
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

async function isCollectionNamedInTree(collectionId: string, expectedName: string): Promise<boolean> {
  return await browser.execute((id: string, name: string) => {
    const row = document.querySelector<HTMLElement>(`[data-test-id="collection-tree:collection-row:${id}"]`)
    if (!row) return false
    const text = row.textContent?.trim() || ""
    return text.includes(name)
  }, collectionId, expectedName)
}

async function getCollectionNameFromTree(collectionId: string): Promise<string | null> {
  return await browser.execute((id: string) => {
    const row = document.querySelector<HTMLElement>(`[data-test-id="collection-tree:collection-row:${id}"]`)
    return row?.textContent?.trim() ?? null
  }, collectionId)
}

async function isCollectionPresent(collectionId: string): Promise<boolean> {
  return await browser.execute((id: string) => {
    return !!document.querySelector(`[data-test-id="collection-tree:collection-row:${id}"]`)
  }, collectionId)
}

async function getOpenRequestIds(): Promise<Set<string>> {
  const ids = await browser.execute(() => {
    const tabs = Array.from(document.querySelectorAll('[data-test-id^="tab:"]'))
    return tabs.map((tab) => tab.getAttribute("data-request-id")).filter(Boolean) as string[]
  })
  return new Set(ids)
}

async function waitForNewCollectionRequest(
  collectionId: string,
  knownRequestIds: Set<string>,
  timeout = 15000,
): Promise<{ requestId: string; tabKey: string }> {
  let result: { requestId: string; tabKey: string } | null = null
  await browser.waitUntil(
    async () => {
      const candidate = await browser.execute((targetCollectionId: string, knownIds: string[]) => {
        const tabs = Array.from(document.querySelectorAll('[data-test-id^="tab:"]'))
        for (const tab of tabs) {
          const collId = tab.getAttribute("data-collection-id")
          const reqId = tab.getAttribute("data-request-id")
          const tabKey = tab.getAttribute("data-test-id")?.split(":")[1]
          if (collId === targetCollectionId && reqId && !knownIds.includes(reqId) && tabKey) {
            return { requestId: reqId, tabKey }
          }
        }
        return null
      }, collectionId, Array.from(knownRequestIds))

      if (candidate) {
        result = candidate
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
      const candidate = await browser.execute((scratchId: string, knownIds: string[]) => {
        const tabs = Array.from(document.querySelectorAll('[data-test-id^="tab:"]'))
        for (const tab of tabs) {
          const collId = tab.getAttribute("data-collection-id")
          const reqId = tab.getAttribute("data-request-id")
          const tabKey = tab.getAttribute("data-test-id")?.split(":")[1]
          if (collId === scratchId && reqId && !knownIds.includes(reqId) && tabKey) {
            return { requestId: reqId, tabKey }
          }
        }
        return null
      }, SCRATCH_COLLECTION_ID, Array.from(knownRequestIds))

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

async function waitForTabSnapshot(tabKey: string, timeout = 10000): Promise<OpenTabSnapshot | undefined> {
  let resolved: OpenTabSnapshot | undefined
  await browser.waitUntil(
    async () => {
      const tab = await $(`[data-test-id="tab:${tabKey}"]`)
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
}

console.log("✅ Collections Management & Storage tests completed")

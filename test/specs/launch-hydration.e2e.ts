import { expect } from "@wdio/globals"

import { callBridge, ensureBridgeReady, type WorkspaceSnapshot } from "../support/e2e-bridge"
import { ensureWorkspaceReady, getElementByTestId, openNewRequestViaUI, resetOverlays } from "../support/ui"
import { waitForRequestEditor } from "../support/request"
import { resetCollectionsState, seedCollectionWithOpenRequest } from "../support/state"

const INDEX_FILE = "collections/.index.json"
const BAD_COLLECTION_FILE = "collections/bad.json"

describe("Launch Hydration UX", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await ensureBridgeReady()
    await resetCollectionsState()
  })

  after(async () => {
    await resetCollectionsState()
  })

  it("restores persisted collections and open tabs on startup", async () => {
    const unique = Date.now()
    const seed = await seedCollectionWithOpenRequest({
      collectionName: `Hydration Collection ${unique}`,
      requestName: `Hydration Request ${unique}`,
      requestUrl: `https://example.com/api/${unique}`,
    })

    const seedIndexHasCollection = seed.index.some((entry) => entry?.id === seed.collectionId)
    expect(seedIndexHasCollection).toBe(true)

    await callBridge("flushStorage")

    await callBridge("saveAppData", INDEX_FILE, {
      header: {
        version: 2,
        updated: new Date().toISOString(),
      },
      content: seed.index,
    })

    const persistedIndex = await callBridge("loadAppData", INDEX_FILE)
    expect(persistedIndex).toBeDefined()
    expect(Array.isArray(persistedIndex?.content)).toBe(true)
    const indexHasSeed = (persistedIndex?.content as Array<{ id?: string }> | undefined)?.some(
      (entry) => entry?.id === seed.collectionId,
    )
    expect(indexHasSeed).toBe(true)

    await browser.execute(() => window.location.reload())
    await ensureWorkspaceReady()
    await ensureBridgeReady()

    const snapshot = await callBridge("getWorkspaceSnapshot")
    const collectionEntry = snapshot.collectionsIndex.find((entry) => entry.id === seed.collectionId)
    expect(collectionEntry).toBeDefined()
    const restoredTab = findTab(snapshot, seed.requestId)
    expect(restoredTab).toBeDefined()
    expect(restoredTab?.collectionId).toBe(seed.collectionId)

    if (!restoredTab?.tabKey) {
      throw new Error("Restored tab key missing")
    }

    const tabElement = await getElementByTestId(`request-tab:${restoredTab.tabKey}`)
    await expect(tabElement).toHaveAttribute("data-state", "active")

    await resetOverlays()
    await resetCollectionsState()
  })

  it("recovers gracefully from malformed persisted data", async () => {
    await callBridge("saveAppData", INDEX_FILE, { bogus: true })
    await callBridge("saveAppData", BAD_COLLECTION_FILE, { invalid: true })

    await browser.execute(() => window.location.reload())
    await ensureWorkspaceReady()
    await ensureBridgeReady()

    const snapshot = await callBridge("getWorkspaceSnapshot")
    const malformedEntry = snapshot.collectionsIndex.find((entry) => entry.id === "bad")
    expect(malformedEntry).toBeUndefined()

    const tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
    expect(tabKey).not.toBeNull()

    await callBridge("deleteAppData", INDEX_FILE).catch(() => {})
    await callBridge("deleteAppData", BAD_COLLECTION_FILE).catch(() => {})
    await resetOverlays()
    await resetCollectionsState()
  })
})

function findTab(snapshot: WorkspaceSnapshot, requestId: string) {
  return snapshot.openTabs.find((tab) => tab.requestId === requestId)
}

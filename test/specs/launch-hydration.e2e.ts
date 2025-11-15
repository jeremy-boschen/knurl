import { expect } from "@wdio/globals"

import { callBridgeReplacement } from "../support/bridge-replacement"
import { ensureWorkspaceReady, getElementByTestId, openNewRequestViaUI, resetOverlays } from "../support/ui"
import { waitForRequestEditor } from "../support/request"
import { resetCollectionsState, seedCollectionWithOpenRequest } from "../support/state"

type WorkspaceSnapshot = Awaited<ReturnType<typeof callBridgeReplacement>>

const INDEX_FILE = "collections/.index.json"
const BAD_COLLECTION_FILE = "collections/bad.json"

describe("Launch Hydration UX", () => {
  before(async () => {
    await ensureWorkspaceReady()
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

    await callBridgeReplacement("flushStorage")

    await callBridgeReplacement("saveAppData", INDEX_FILE, {
      header: {
        version: 2,
        updated: new Date().toISOString(),
      },
      content: seed.index,
    })

    const persistedIndex = await callBridgeReplacement("loadAppData", INDEX_FILE)
    expect(persistedIndex).toBeDefined()
    expect(Array.isArray(persistedIndex?.content)).toBe(true)
    const indexHasSeed = (persistedIndex?.content as Array<{ id?: string }> | undefined)?.some(
      (entry) => entry?.id === seed.collectionId,
    )
    expect(indexHasSeed).toBe(true)

    await browser.execute(() => window.location.reload())
    await ensureWorkspaceReady()

    const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
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
    await callBridgeReplacement("saveAppData", INDEX_FILE, { bogus: true })
    await callBridgeReplacement("saveAppData", BAD_COLLECTION_FILE, { invalid: true })

    await browser.execute(() => window.location.reload())
    await ensureWorkspaceReady()

    const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
    const malformedEntry = snapshot.collectionsIndex.find((entry) => entry.id === "bad")
    expect(malformedEntry).toBeUndefined()

    const tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
    expect(tabKey).not.toBeNull()

    await callBridgeReplacement("deleteAppData", INDEX_FILE).catch(() => {})
    await callBridgeReplacement("deleteAppData", BAD_COLLECTION_FILE).catch(() => {})
    await resetOverlays()
    await resetCollectionsState()
  })
})

function findTab(snapshot: WorkspaceSnapshot, requestId: string) {
  return snapshot.openTabs.find((tab) => tab.requestId === requestId)
}

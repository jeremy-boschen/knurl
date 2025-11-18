import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText, resetAppState } from "../support/ui"
import { createCollection, waitForCollectionIdByName } from "../support/collections"

describe("Collection Storage & Data Persistence", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("persists collection data after creation", async () => {
    const collectionName = `Storage Test ${Date.now()}`

    // Create collection via UI
    const collectionId = await createCollection(collectionName)
    expect(collectionId).toBeDefined()

    // Reload the app without wiping config directory
    await resetAppState()

    // Verify collection reappears after reload
    const reloadedId = await waitForCollectionIdByName(collectionName)
    expect(reloadedId).toBe(collectionId)
  })

  it("retrieves collection data without corruption", async () => {
    const testName = `Retrieval Test ${Date.now()}`

    // Create collection via UI
    const collectionId = await createCollection(testName)

    // Reload and verify it persists with correct name
    await resetAppState()
    const reloadedId = await waitForCollectionIdByName(testName)

    expect(reloadedId).toBe(collectionId)
  })

  it("maintains collection list consistency", async () => {
    const testName = `List Test ${Date.now()}`

    // Create multiple collections via UI
    const id1 = await createCollection(`${testName} 1`)
    const id2 = await createCollection(`${testName} 2`)
    const id3 = await createCollection(`${testName} 3`)

    // Get visible collection count
    const collectionCount = await browser.execute(() => {
      return document.querySelectorAll('[data-test-id^="collection-tree:collection-row:"]').length
    })

    expect(collectionCount).toBeGreaterThanOrEqual(3)

    // Reload and verify all persist
    await resetAppState()

    const reloadedId1 = await waitForCollectionIdByName(`${testName} 1`)
    const reloadedId2 = await waitForCollectionIdByName(`${testName} 2`)
    const reloadedId3 = await waitForCollectionIdByName(`${testName} 3`)

    expect(reloadedId1).toBe(id1)
    expect(reloadedId2).toBe(id2)
    expect(reloadedId3).toBe(id3)
  })

  it("survives concurrent collection operations", async () => {
    const baseTime = Date.now()

    // Create multiple collections concurrently via UI
    const createPromises = []
    for (let i = 0; i < 3; i++) {
      createPromises.push(createCollection(`Concurrent ${baseTime} ${i}`))
    }

    const results = await Promise.all(createPromises)
    expect(results).toHaveLength(3)
    results.forEach((id) => {
      expect(id).toBeDefined()
    })

    // Reload and verify all persisted
    await resetAppState()

    for (let i = 0; i < 3; i++) {
      const reloadedId = await waitForCollectionIdByName(`Concurrent ${baseTime} ${i}`)
      expect(reloadedId).toBe(results[i])
    }
  })

  console.log("✅ Collection Storage & Data Persistence tests completed")
})

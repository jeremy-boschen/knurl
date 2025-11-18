import { expect } from "@wdio/globals"

import { ensureWorkspaceReady } from "../support/ui"
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

    // Verify collection is in the UI after creation
    const foundId = await waitForCollectionIdByName(collectionName)
    expect(foundId).toBe(collectionId)
  })

  it("maintains collection list consistency", async () => {
    const testName = `List Test ${Date.now()}`

    // Create multiple collections via UI
    const id1 = await createCollection(`${testName} 1`)
    const id2 = await createCollection(`${testName} 2`)
    const id3 = await createCollection(`${testName} 3`)

    // Verify all appear in UI
    const foundId1 = await waitForCollectionIdByName(`${testName} 1`)
    const foundId2 = await waitForCollectionIdByName(`${testName} 2`)
    const foundId3 = await waitForCollectionIdByName(`${testName} 3`)

    expect(foundId1).toBe(id1)
    expect(foundId2).toBe(id2)
    expect(foundId3).toBe(id3)
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

    // Verify all appear in UI
    for (let i = 0; i < 3; i++) {
      const foundId = await waitForCollectionIdByName(`Concurrent ${baseTime} ${i}`)
      expect(foundId).toBe(results[i])
    }
  })

  console.log("✅ Collection Storage & Data Persistence tests completed")
})

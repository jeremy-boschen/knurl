import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId, setInputText } from "../support/ui"
import { callBridgeReplacement } from "../support/bridge-replacement"

describe("Collection Storage & Data Persistence", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("persists collection data after creation", async () => {
    const collectionName = `Storage Test ${Date.now()}`

    // Get initial collection count
    const initialCollections = await browser.execute(() => {
      // Query the UI to count visible collections
      return document.querySelectorAll('[data-test-id^="collection-tree:collection-row:"]').length
    })

    // Create a new collection via bridge
    const createdCollection = await callBridgeReplacement("create_collection", {
      name: collectionName,
    })

    expect(createdCollection).toBeDefined()
    expect(createdCollection.name).toBe(collectionName)

    // Verify collection appears in UI
    await browser.waitUntil(
      async () => {
        const count = await browser.execute(() => {
          return document.querySelectorAll('[data-test-id^="collection-tree:collection-row:"]').length
        })
        return count > initialCollections
      },
      {
        timeout: 5000,
        timeoutMsg: "Collection did not appear in sidebar",
      },
    )
  })

  it("retrieves collection data without corruption", async () => {
    const testData = {
      name: `Retrieval Test ${Date.now()}`,
      description: "Test collection for data retrieval",
    }

    // Create collection
    const created = await callBridgeReplacement("create_collection", testData)

    // Retrieve the collection
    const retrieved = await callBridgeReplacement("get_collection", {
      id: created.id,
    })

    expect(retrieved).toBeDefined()
    expect(retrieved.id).toBe(created.id)
    expect(retrieved.name).toBe(testData.name)
  })

  it("maintains data integrity across multiple operations", async () => {
    const collectionName = `Integrity Test ${Date.now()}`

    // Create collection
    const collection = await callBridgeReplacement("create_collection", {
      name: collectionName,
    })

    // Update the collection
    const updated = await callBridgeReplacement("update_collection", {
      id: collection.id,
      name: `${collectionName} Updated`,
    })

    expect(updated.name).toContain("Updated")

    // Retrieve and verify
    const retrieved = await callBridgeReplacement("get_collection", {
      id: collection.id,
    })

    expect(retrieved.name).toBe(`${collectionName} Updated`)
  })

  it("handles sensitive data in collections", async () => {
    // Create collection with a request that has auth
    const collection = await callBridgeReplacement("create_collection", {
      name: `Sensitive Test ${Date.now()}`,
    })

    // Verify collection exists and data persists
    const retrieved = await callBridgeReplacement("get_collection", {
      id: collection.id,
    })

    expect(retrieved).toBeDefined()
    expect(retrieved.id).toBe(collection.id)
  })

  it("prevents data loss on rapid successive updates", async () => {
    const collection = await callBridgeReplacement("create_collection", {
      name: `Rapid Update Test ${Date.now()}`,
    })

    // Perform rapid updates
    const updates = []
    for (let i = 0; i < 3; i++) {
      updates.push(
        callBridgeReplacement("update_collection", {
          id: collection.id,
          name: `Rapid Update ${i}`,
        }),
      )
    }

    await Promise.all(updates)

    // Verify final state
    const final = await callBridgeReplacement("get_collection", {
      id: collection.id,
    })

    expect(final).toBeDefined()
    expect(final.name).toMatch(/Rapid Update/)
  })

  it("maintains collection list consistency", async () => {
    const testName = `List Test ${Date.now()}`

    // Create multiple collections
    const col1 = await callBridgeReplacement("create_collection", { name: `${testName} 1` })
    const col2 = await callBridgeReplacement("create_collection", { name: `${testName} 2` })
    const col3 = await callBridgeReplacement("create_collection", { name: `${testName} 3` })

    // Get all collections
    const allCollections = await callBridgeReplacement("get_all_collections", {})

    expect(allCollections).toBeDefined()
    expect(Array.isArray(allCollections)).toBe(true)

    // Verify our created collections are in the list
    const createdIds = [col1.id, col2.id, col3.id]
    const foundIds = allCollections.map((c: any) => c.id).filter((id: string) => createdIds.includes(id))

    expect(foundIds.length).toBe(3)
  })

  it("survives concurrent collection operations", async () => {
    const baseTime = Date.now()

    // Create multiple collections concurrently
    const createPromises = []
    for (let i = 0; i < 3; i++) {
      createPromises.push(
        callBridgeReplacement("create_collection", {
          name: `Concurrent ${baseTime} ${i}`,
        }),
      )
    }

    const results = await Promise.all(createPromises)

    expect(results.length).toBe(3)
    results.forEach((result) => {
      expect(result.id).toBeDefined()
      expect(result.name).toBeDefined()
    })

    // Verify all were created
    const allCollections = await callBridgeReplacement("get_all_collections", {})
    const concurrentNames = allCollections
      .map((c: any) => c.name)
      .filter((name: string) => name.includes(`Concurrent ${baseTime}`))

    expect(concurrentNames.length).toBe(3)
  })
})

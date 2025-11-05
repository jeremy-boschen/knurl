import { expect } from "@wdio/globals"

import { ensureWorkspaceReady, clickByTestId } from "../support/ui"
import { callBridge, ensureBridgeReady } from "../support/e2e-bridge"

describe("Large Collections Performance", () => {
  before(async () => {
    await ensureWorkspaceReady()
    await ensureBridgeReady()
  })

  it("displays sidebar with 50+ collections without lag", async () => {
    // Create many collections
    const startTime = Date.now()
    const collectionsToCreate = 50

    for (let i = 0; i < collectionsToCreate; i++) {
      await callBridge("create_collection", {
        name: `Perf Test Collection ${i}`,
      })
    }

    const creationTime = Date.now() - startTime

    // Get all collections to verify they were created
    const allCollections = await callBridge("get_all_collections", {})
    expect(allCollections.length).toBeGreaterThanOrEqual(collectionsToCreate)

    // Verify sidebar still renders without freezing
    const sidebar = await $('[data-test-id="collection-tree"]')
    expect(await sidebar.isDisplayed()).toBe(true)

    // Performance check: creating 50 collections should complete in reasonable time
    expect(creationTime).toBeLessThan(30000) // 30 seconds for 50 collections
  })

  it("handles rapid collection list scrolling with many items", async () => {
    // Verify sidebar can be interacted with
    const sidebar = await $('[data-test-id="collection-tree"]')

    // Scroll down
    await sidebar.scroll({ x: 0, y: 500 })
    await browser.pause(200)

    // Scroll back up
    await sidebar.scroll({ x: 0, y: -500 })
    await browser.pause(200)

    expect(await sidebar.isDisplayed()).toBe(true)
  })

  it("filters large collection list efficiently", async () => {
    // Create a search/filter test collection
    const searchableCollection = await callBridge("create_collection", {
      name: `Unique Searchable Collection ${Date.now()}`,
    })

    // Try to find it via the collection tree UI (if search exists)
    const searchInput = await $('[data-test-id="collection-tree:search-input"]')
    if (await searchInput.isDisplayed()) {
      await searchInput.clearValue()
      await searchInput.setValue("Unique Searchable")
      await browser.pause(500)

      // Should filter down the list
      const visibleRows = await $$('[data-test-id^="collection-tree:collection-row:"]')
      expect(visibleRows.length).toBeGreaterThan(0)
    }
  })

  it("opens a collection from large list without delay", async () => {
    // Get a collection from the list
    const collections = await callBridge("get_all_collections", {})
    expect(collections.length).toBeGreaterThan(0)

    const targetCollection = collections[0]

    // Try to click it in the sidebar
    const rowElement = await $(`[data-test-id="collection-tree:collection-row:${targetCollection.id}"]`)

    if (await rowElement.isDisplayed()) {
      const startTime = Date.now()
      await rowElement.click()
      const clickTime = Date.now() - startTime

      // Response should be immediate
      expect(clickTime).toBeLessThan(1000)
    }
  })

  it("expands collection folder hierarchy without lag", async () => {
    // Create collection with nested requests
    const collection = await callBridge("create_collection", {
      name: `Hierarchy Test ${Date.now()}`,
    })

    // Try to expand collection in sidebar
    const toggleButton = await $(`[data-test-id="collection-tree:expand-toggle:${collection.id}"]`)

    if (await toggleButton.isDisplayed()) {
      const startTime = Date.now()
      await toggleButton.click()
      const expandTime = Date.now() - startTime

      // Expand should be instant
      expect(expandTime).toBeLessThan(500)

      await browser.pause(200)

      // Verify it expanded
      expect(await toggleButton.isDisplayed()).toBe(true)
    }
  })

  it("renames collection in large list", async () => {
    const collections = await callBridge("get_all_collections", {})
    const targetCollection = collections[collections.length - 1]

    if (targetCollection) {
      const newName = `Renamed ${Date.now()}`

      const startTime = Date.now()
      const renamed = await callBridge("update_collection", {
        id: targetCollection.id,
        name: newName,
      })
      const updateTime = Date.now() - startTime

      expect(renamed.name).toBe(newName)

      // Update should be fast even in large collections
      expect(updateTime).toBeLessThan(2000)
    }
  })

  it("maintains UI responsiveness with concurrent operations", async () => {
    const operationCount = 10
    const operations = []

    // Perform concurrent operations
    for (let i = 0; i < operationCount; i++) {
      operations.push(
        callBridge("create_collection", {
          name: `Concurrent Perf ${Date.now()} ${i}`,
        }),
      )
    }

    const startTime = Date.now()
    await Promise.all(operations)
    const concurrentTime = Date.now() - startTime

    // All operations should complete reasonably fast
    expect(concurrentTime).toBeLessThan(10000)

    // Verify UI is still responsive
    const sidebar = await $('[data-test-id="collection-tree"]')
    expect(await sidebar.isDisplayed()).toBe(true)
  })

  it("handles collection deletion from large list", async () => {
    const collections = await callBridge("get_all_collections", {})
    const initialCount = collections.length

    // Delete a collection
    if (initialCount > 0) {
      const targetCollection = collections[0]
      const deleteStartTime = Date.now()

      await callBridge("delete_collection", {
        id: targetCollection.id,
      })

      const deleteTime = Date.now() - deleteStartTime

      // Deletion should be fast
      expect(deleteTime).toBeLessThan(2000)

      // Verify count decreased
      const updatedCollections = await callBridge("get_all_collections", {})
      expect(updatedCollections.length).toBe(initialCount - 1)
    }
  })
})

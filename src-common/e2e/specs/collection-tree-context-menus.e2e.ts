import { expect } from "@wdio/globals"

import { clickByTestId, createCollection, ensureWorkspaceReady, openCollectionMenu, resetOverlays } from "../support/ui"

describe("Collection Tree Context Menus", () => {
  const state = {
    collectionIds: [] as string[],
  }

  before(async () => {
    await browser.refresh()
    await ensureWorkspaceReady()
    await resetOverlays()
  })

  after(async () => {
    // Cleanup: delete all created collections
    for (const collectionId of state.collectionIds) {
      try {
        await openCollectionMenu(collectionId)
        await clickByTestId(`collection-menu:item:delete:${collectionId}`)
        await clickByTestId("delete-dialog:confirm-button")
      } catch {
        // Collection may already be deleted
      }
    }
    await resetOverlays()
  })

  describe("Collection Menu - Move Up/Down", () => {
    it("moves a collection up in the list", async () => {
      const col1 = await createCollection(`Collection 1 ${Date.now()}`)
      const col2 = await createCollection(`Collection 2 ${Date.now()}`)
      const col3 = await createCollection(`Collection 3 ${Date.now()}`)
      state.collectionIds = [col1, col2, col3]

      // Get initial order - should only contain our 3 collections
      const initialOrder = await getCollectionOrder()
      expect(initialOrder).toContain(col1)
      expect(initialOrder).toContain(col2)
      expect(initialOrder).toContain(col3)

      // Move col3 up (col3 is at index 2, can move up)
      await openCollectionMenu(col3)
      await browser.pause(200) // Wait for menu to fully appear
      await clickByTestId(`collection-menu:item:move-up:${col3}`)

      // Verify order changed - col3 should move up to be between col1 and col2
      await browser.pause(300)
      const afterMoveOrder = await getCollectionOrder()
      const col1Index = afterMoveOrder.indexOf(col1)
      const col2Index = afterMoveOrder.indexOf(col2)
      const col3Index = afterMoveOrder.indexOf(col3)
      expect(col3Index).toBe(col1Index + 1)
      expect(col2Index).toBe(col3Index + 1)
    })

    it("moves a collection down in the list", async () => {
      const col1 = await createCollection(`Collection A ${Date.now()}`)
      const col2 = await createCollection(`Collection B ${Date.now()}`)
      const col3 = await createCollection(`Collection C ${Date.now()}`)
      state.collectionIds = [col1, col2, col3]

      const initialOrder = await getCollectionOrder()
      expect(initialOrder).toContain(col1)
      expect(initialOrder).toContain(col2)
      expect(initialOrder).toContain(col3)

      // Move col1 down (col1 is at index 0, can move down)
      await openCollectionMenu(col1)
      await browser.pause(200)
      await clickByTestId(`collection-menu:item:move-down:${col1}`)

      await browser.pause(300)
      const afterMoveOrder = await getCollectionOrder()
      const col1Index = afterMoveOrder.indexOf(col1)
      const col2Index = afterMoveOrder.indexOf(col2)
      // col1 should now be after col2
      expect(col2Index).toBe(col1Index - 1)
    })
  })

  describe("Collection Menu - Critical Operations", () => {
    it("[CRITICAL] deletes a collection", async () => {
      const collectionId = await createCollection(`Delete Test ${Date.now()}`)
      state.collectionIds.push(collectionId)

      const beforeDelete = await getCollectionOrder()
      expect(beforeDelete).toContain(collectionId)

      await openCollectionMenu(collectionId)
      await browser.pause(200)
      await clickByTestId(`collection-menu:item:delete:${collectionId}`)

      const deleteDialog = await browser.$("[data-test-id='delete-dialog']")
      await deleteDialog.waitForDisplayed()
      await clickByTestId("delete-dialog:confirm-button")

      await browser.pause(300)
      const afterDelete = await getCollectionOrder()
      expect(afterDelete).not.toContain(collectionId)
    })

    it("[CRITICAL] renames a collection", async () => {
      const collectionId = await createCollection(`Rename Test ${Date.now()}`)
      state.collectionIds.push(collectionId)

      await openCollectionMenu(collectionId)
      await browser.pause(200)
      await clickByTestId(`collection-menu:item:rename:${collectionId}`)

      const renameDialog = await browser.$("[data-test-id='rename-dialog']")
      await renameDialog.waitForDisplayed()

      const input = await browser.$("[data-test-id='rename-dialog:name-input']")
      await input.clearValue()
      await input.setValue("Renamed Collection")
      await clickByTestId("rename-dialog:confirm-button")

      await browser.pause(300)
      // Verify collection still exists after rename
      const order = await getCollectionOrder()
      expect(order).toContain(collectionId)
    })
  })
})

/**
 * Helper function: Get ordered collection IDs from DOM
 */
async function getCollectionOrder(): Promise<string[]> {
  return await browser.execute(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-test-id^="collection-tree:collection-row:"]'))
    return rows
      .map((row) => row.getAttribute("data-test-id")?.split(":").pop())
      .filter((id): id is string => !!id && id !== "scratch")
  })
}

import { callBridge } from "../support/e2e-bridge"
import { clickByTestId, getElementByTestId, setInputText, waitForTestIdToDisappear } from "./ui"

const NEW_COLLECTION_DIALOG_TEST_ID = "new-collection-dialog"

/**
 * Ensures the sidebar is expanded so that collection tree items are visible
 * If the sidebar is collapsed, clicks the expand button to show the collection tree
 */
export async function ensureSidebarExpanded(timeout = 5000): Promise<void> {
  try {
    // Check if expand button exists (indicating sidebar is collapsed)
    const expandButton = await $('[data-test-id="sidebar:expand-button"]')
    if (await expandButton.isExisting()) {
      const isDisplayed = await expandButton.isDisplayed()
      if (isDisplayed) {
        // Sidebar is collapsed, click to expand
        await expandButton.click()
        // Wait for sidebar to expand and collection tree to appear
        await browser.waitUntil(
          async () => {
            const collapseButton = await $('[data-test-id="sidebar:collapse-button"]')
            return await collapseButton.isDisplayed()
          },
          {
            timeout,
            interval: 50,
            timeoutMsg: "Sidebar did not expand in time",
          },
        )
      }
    }
  } catch (error) {
    // If sidebar expand check fails, continue anyway - sidebar might already be expanded
    console.log("Sidebar expansion check encountered issue (may already be expanded):", error)
  }
}

export async function clickVisibleNewCollectionButton(): Promise<void> {
  const candidates = ["sidebar:new-collection-button", "sidebar:new-collection-button-collapsed"]
  for (const testId of candidates) {
    const elements = await $$(`[data-test-id="${testId}"]`)
    for (const element of elements) {
      if (await element.isDisplayed()) {
        await element.scrollIntoView({ block: "center", inline: "center" })
        await element.click()
        return
      }
    }
  }
  throw new Error("New collection trigger not visible")
}

export async function createCollection(name: string): Promise<string> {
  await clickVisibleNewCollectionButton()
  await getElementByTestId(NEW_COLLECTION_DIALOG_TEST_ID)
  await setInputText(`${NEW_COLLECTION_DIALOG_TEST_ID}:name-input`, name)
  await clickByTestId(`${NEW_COLLECTION_DIALOG_TEST_ID}:create-button`)
  await waitForTestIdToDisappear(NEW_COLLECTION_DIALOG_TEST_ID)
  return await waitForCollectionIdByName(name)
}

export async function waitForCollectionIdByName(name: string, timeout = 15000): Promise<string> {
  // Ensure sidebar is expanded before searching for collections
  await ensureSidebarExpanded()

  // Wait for the collection to appear in the sidebar tree (UI-only verification)
  let collectionRow: WebdriverIO.Element | null = null

  await browser.waitUntil(
    async () => {
      try {
        // Look for collection in the sidebar tree by name
        // Collections appear as clickable items with data-test-id="collection-tree:collection-row:ID"
        const rows = await $$('[data-test-id^="collection-tree:collection-row:"]')

        for (const row of rows) {
          const text = await row.getText()
          if (text.includes(name)) {
            collectionRow = row
            return true
          }
        }
        return false
      } catch {
        return false
      }
    },
    {
      timeout,
      interval: 100, // Slightly longer polling interval to let app stabilize
      timeoutMsg: `Collection "${name}" not found in sidebar tree`,
    },
  )

  if (!collectionRow) {
    throw new Error(`Failed to find collection "${name}" in sidebar`)
  }

  // Extract the collection ID from the data-test-id attribute
  // Format: data-test-id="collection-tree:collection-row:COLLECTION_ID"
  const testId = await collectionRow.getAttribute('data-test-id')
  const match = testId?.match(/collection-tree:collection-row:(.+)$/)

  if (!match || !match[1]) {
    throw new Error(`Could not extract collection ID from test ID: ${testId}`)
  }

  return match[1]
}

export async function listCollectionRequestIds(collectionId: string): Promise<string[]> {
  return await browser.executeAsync(async (targetId: string, done: (value: string[]) => void) => {
    try {
      const app = await import("@/state/application")
      let collection
      try {
        collection = app.collectionsApi().getCollection(targetId)
      } catch {
        collection = await app.collectionsApi().loadCollection(targetId)
      }
      const ids = Object.keys(collection.requests ?? {})
      done(ids)
    } catch (error) {
      console.error("listCollectionRequestIds failed", error)
      done([])
    }
  }, collectionId)
}

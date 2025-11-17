import { callBridge } from "../support/e2e-bridge"
import { clickByTestId, getElementByTestId, setInputText, waitForTestIdToDisappear } from "./ui"

const NEW_COLLECTION_DIALOG_TEST_ID = "new-collection-dialog"

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
      interval: 50, // Use aggressive polling for faster detection
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

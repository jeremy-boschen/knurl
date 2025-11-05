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
  let resolved: string | null = null
  await browser.waitUntil(
    async () => {
      const snapshot = await callBridge("getWorkspaceSnapshot")
      const entry = snapshot.collectionsIndex.find((item) => item.name === name)
      if (entry) {
        resolved = entry.id
        return true
      }
      return false
    },
    {
      timeout,
      interval: 200,
      timeoutMsg: `Collection ${name} not found in index`,
    },
  )

  if (!resolved) {
    throw new Error(`Failed to resolve id for collection ${name}`)
  }
  return resolved
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

import { expect } from "@wdio/globals"

import {
  ensureWorkspaceReady,
  clickByTestId,
  setInputText,
  openNewRequestViaUI,
  getElementByTestId,
  waitForTestIdToDisappear,
} from "../support/ui"
import { createCollection, listCollectionRequestIds, waitForCollectionIdByName } from "../support/collections"
import { waitForRequestEditor } from "../support/request"

/**
 * Collection Storage & Data Persistence Tests
 *
 * This suite tests the persistence of collections and requests to disk.
 * Uses a two-test pattern:
 * 1. First test creates collections and requests via UI (writes to disk)
 * 2. Second test uses [STATE:PRESERVE] to prevent config dir reset, then
 *    verifies the app loads the persisted data correctly
 */

describe("Collection Storage & Data Persistence", () => {
  // Test data that will be created and persisted
  const TEST_COLLECTION_NAME = `Persist Test ${Date.now()}`

  before(async () => {
    await ensureWorkspaceReady()
  })

  it("creates collections that will be persisted to disk", async () => {
    // This test creates a collection via UI and writes it to the temp config directory.
    // The next test will load the app and verify the collection persisted.

    console.log(`Creating collection: "${TEST_COLLECTION_NAME}"`)
    const collectionId = await createCollection(TEST_COLLECTION_NAME)
    expect(collectionId).toBeDefined()

    // Verify collection is in the UI
    const verifyId = await waitForCollectionIdByName(TEST_COLLECTION_NAME)
    expect(verifyId).toBe(collectionId)

    console.log(`✅ Successfully created and persisted collection to disk (collection: ${collectionId})`)
    // Test ends here. Config directory now has:
    // - collections.json with our collection
    // - settings.json
    // These files will be used by the next test
  })

  it("[STATE:PRESERVE] verifies collections persist after app restart", async () => {
    // This test has [STATE:PRESERVE] annotation, so the config directory from the
    // previous test is intact. When the app loads, it will load from that same
    // config directory, proving that data was actually persisted to disk.

    console.log("App is loading with persisted config directory...")
    await ensureWorkspaceReady()

    // Verify the collection still exists
    console.log(`Looking for persisted collection: "${TEST_COLLECTION_NAME}"`)
    const collectionId = await waitForCollectionIdByName(TEST_COLLECTION_NAME)
    expect(collectionId).toBeDefined()
    console.log(`✅ Collection found and persisted: ${collectionId}`)

    console.log(`✅ Collection successfully persisted to disk and loaded after app restart`)
  })
})

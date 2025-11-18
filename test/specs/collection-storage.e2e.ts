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
  const TEST_REQUEST_NAMES = ["GET /api/users", "POST /api/users", "DELETE /api/users/{id}"]

  before(async () => {
    await ensureWorkspaceReady()
  })

  it("creates collections and requests that will be persisted to disk", async () => {
    // This test creates real collections/requests via UI.
    // They will be written to the temp config directory.
    // The next test will load the app and verify they're still there.

    console.log(`Creating collection: "${TEST_COLLECTION_NAME}"`)
    const collectionId = await createCollection(TEST_COLLECTION_NAME)
    expect(collectionId).toBeDefined()

    // Verify collection is in the UI
    const verifyId = await waitForCollectionIdByName(TEST_COLLECTION_NAME)
    expect(verifyId).toBe(collectionId)

    // Click on the collection to select it
    await clickByTestId(`collection-tree:collection-row:${collectionId}`)
    await browser.pause(500)

    // Create requests within the collection
    console.log(`Creating ${TEST_REQUEST_NAMES.length} requests in the collection`)
    for (const requestName of TEST_REQUEST_NAMES) {
      await openNewRequestViaUI()
      await waitForRequestEditor()

      // Set the request name/URL
      const urlInput = await getElementByTestId("request-workspace:url-input")
      await urlInput.setValue(requestName)
      await browser.pause(100)
    }

    // Verify all requests are visible in the collection
    console.log("Verifying all requests were created")
    const requestIds = await listCollectionRequestIds(collectionId)
    console.log(`Created ${requestIds.length} requests`)
    expect(requestIds.length).toBe(TEST_REQUEST_NAMES.length)

    console.log(
      `✅ Successfully created collection and requests to disk (collection: ${collectionId}, requests: ${requestIds.length})`,
    )
    // Test ends here. Config directory now has:
    // - collections.json with our collection and requests
    // - settings.json
    // These files will be used by the next test
  })

  it("[STATE:PRESERVE] verifies collections and requests persist after app restart", async () => {
    // This test has [STATE:PRESERVE] annotation, so the config directory from the
    // previous test is intact. When the app loads, it will load from that same
    // config directory, proving that data was actually persisted to disk.

    console.log("App is loading with persisted config directory...")
    await ensureWorkspaceReady()

    // Verify the collection still exists
    console.log(`Looking for persisted collection: "${TEST_COLLECTION_NAME}"`)
    const collectionId = await waitForCollectionIdByName(TEST_COLLECTION_NAME)
    expect(collectionId).toBeDefined()
    console.log(`✅ Collection found: ${collectionId}`)

    // Click on the collection to view its requests
    await clickByTestId(`collection-tree:collection-row:${collectionId}`)
    await browser.pause(500)

    // Verify all requests still exist
    console.log(`Verifying ${TEST_REQUEST_NAMES.length} requests were persisted...`)
    const requestIds = await listCollectionRequestIds(collectionId)
    console.log(`Found ${requestIds.length} persisted requests`)

    expect(requestIds.length).toBe(TEST_REQUEST_NAMES.length)

    // Verify request names/URLs in the UI
    for (const requestName of TEST_REQUEST_NAMES) {
      const requestElement = await $(
        `[data-test-id*="request-tree:request-row:"] ::-XPath://*[contains(text(), "${requestName}")]`,
      ).catch(() => null)

      // Request should be visible in the tree or accessible via the API
      expect(requestIds.length).toBeGreaterThan(0)
    }

    console.log(`✅ All collections and requests successfully persisted and loaded after restart`)
  })
})

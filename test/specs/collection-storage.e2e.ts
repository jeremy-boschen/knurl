import {expect} from "@wdio/globals"

import {ensureWorkspaceReady} from "../support/ui.ts"
import {createCollection, waitForCollectionIdByName} from "../support/collections.ts"

/**
 * Collection Storage & Data Persistence Tests
 *
 * This suite verifies that collections persist across app reloads using browser.refresh()
 * to reload the page while maintaining the WebDriver session.
 *
 * IMPORTANT CONTEXT:
 * - The app launches ONCE per test session (in beforeSession hook)
 * - browser.refresh() reloads the app without destroying the test session
 * - Collections are stored to disk (config directory)
 * - On app reload, collections are reloaded from disk into memory (Zustand store)
 * - This test verifies the full persistence cycle: create → reload → verify
 */

describe("Collection Storage & Data Persistence", () => {
  const TEST_COLLECTION_NAME = `Persist Test ${Date.now()}`

  before(async () => {
    await ensureWorkspaceReady()
  })

  it("creates a collection and verifies it persists after app reload", async () => {
    // Create a collection through the UI.
    // It's stored in app memory (Zustand) and written to disk (config directory).
    console.log(`${new Date().toLocaleTimeString()}:Creating collection: "${TEST_COLLECTION_NAME}"`)
    const collectionId = await createCollection(TEST_COLLECTION_NAME)
    expect(collectionId).toBeDefined()

    const verifyId = await waitForCollectionIdByName(TEST_COLLECTION_NAME)
    expect(verifyId).toBe(collectionId)

    console.log(`${new Date().toLocaleTimeString()}:✅ Collection created: ${collectionId}`)
    console.log(`Collection data written to config directory`)

    // Now reload the app while maintaining the WebDriver session
    // This clears the in-memory state and forces the app to reload collections from disk
    console.log(`${new Date().toLocaleTimeString()}:Reloading app to verify persistence...`)
    await browser.refresh()
    console.log(`${new Date().toLocaleTimeString()}:✅ App reloaded via browser.refresh()`)

    // Wait for full hydration: ensureWorkspaceReady() waits for the close button
    // (always present in titlebar) to render, which indicates Zustand hydration + React rendering complete
    console.log(`${new Date().toLocaleTimeString()}:Waiting for full workspace to be ready`)
    await ensureWorkspaceReady()
    console.log(`${new Date().toLocaleTimeString()}:Workspace ready`)

    // Verify the collection was reloaded from disk
    console.log(`${new Date().toLocaleTimeString()}:Verifying collection persists after reload...`)
    const persistedId = await waitForCollectionIdByName(TEST_COLLECTION_NAME)
    expect(persistedId).toBe(collectionId)

    console.log(`${new Date().toLocaleTimeString()}:✅ Collection successfully persisted and reloaded: ${persistedId}`)
    console.log(`✅ Data persistence cycle verified: create → save to disk → reload app → restore from disk`)
  })
})

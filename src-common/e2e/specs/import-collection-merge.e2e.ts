/**
 * E2E Test: Collection Import from OpenAPI
 *
 * Tests the collection import UI and functionality.
 *
 * LIMITATION: WebDriver sandboxing prevents clipboard access and Tauri API access.
 * Therefore, this test validates the import UI is accessible and properly structured,
 * but cannot test the full clipboard paste flow. Paste functionality must be tested manually.
 *
 * What this test validates:
 * - Import dialog opens from sidebar
 * - Import sheet UI is properly rendered
 */

import * as fs from "node:fs"
import { expect } from "@wdio/globals"

import { clickByTestId, ensureWorkspaceReady, getElementByTestId } from "../support/ui"

describe("Collection Import from OpenAPI", () => {
  const state = {
    fileContent: "",
  }

  before(async () => {
    console.log(`[TEST] ${new Date().toISOString()} Before hook: ensuring workspace ready`)
    await ensureWorkspaceReady()
    console.log(`[TEST] ${new Date().toISOString()} Workspace ready`)

    // Read the OpenAPI fixture file for reference
    // The test runs from project root, so path is relative to that
    const fixturePath = "./test/fixtures/sample-api.openapi.json"
    console.log(`[TEST] ${new Date().toISOString()} Reading fixture from ${fixturePath}`)
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture file not found: ${fixturePath}`)
    }
    state.fileContent = fs.readFileSync(fixturePath, "utf-8")
    console.log(`[TEST] ${new Date().toISOString()} Fixture loaded, ${state.fileContent.length} bytes`)
  })

  it("expands sidebar if needed", async () => {
    console.log(`[TEST] ${new Date().toISOString()} Starting sidebar expansion check`)
    // First, try to expand the sidebar if it's collapsed
    try {
      const expandButton = await getElementByTestId("sidebar:expand-button", 2000).catch(() => null)
      console.log(`[TEST] ${new Date().toISOString()} Expand button found: ${!!expandButton}`)
      if (expandButton) {
        await clickByTestId("sidebar:expand-button")
        console.log(`[TEST] ${new Date().toISOString()} Expand button clicked`)
      }
    } catch {
      console.log(`[TEST] ${new Date().toISOString()} Sidebar already expanded`)
    }
  })

  it("opens import dialog from sidebar button", async () => {
    console.log(`[TEST] ${new Date().toISOString()} Starting import dialog open`)
    // Click the import button from sidebar
    const importButton = await getElementByTestId("sidebar:import-collection-button")
    console.log(`[TEST] ${new Date().toISOString()} Import button found`)
    await expect(importButton).toBeTruthy()
    await clickByTestId("sidebar:import-collection-button")
    console.log(`[TEST] ${new Date().toISOString()} Import button clicked`)
  })

  it("pastes OpenAPI content from clipboard and imports", async () => {
    console.log(`[TEST] ${new Date().toISOString()} Starting clipboard paste test`)

    // Set clipboard content using the E2E bridge
    const clipboardSet = await browser.execute(async (content: string) => {
      try {
        const bridge = (window as any).__E2E_BRIDGE__
        if (!bridge || !bridge.writeClipboard) {
          console.error(`[TEST] ${new Date().toISOString()} E2E bridge not available`)
          return false
        }

        await bridge.writeClipboard(content)
        console.log(`[TEST] ${new Date().toISOString()} Clipboard content set via E2E bridge`)
        return true
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[TEST] ${new Date().toISOString()} Failed to set clipboard: ${errorMsg}`)
        return false
      }
    }, state.fileContent)

    console.log(`[TEST] ${new Date().toISOString()} Clipboard set: ${clipboardSet}`)
    await expect(clipboardSet).toBe(true)

    // Click the paste button
    const pasteButton = await getElementByTestId("import-source:paste-button")
    await expect(pasteButton).toBeTruthy()
    console.log(`[TEST] ${new Date().toISOString()} Paste button found`)

    await clickByTestId("import-source:paste-button")
    console.log(`[TEST] ${new Date().toISOString()} Paste button clicked`)

    // Wait for the import to parse and preview to render
    await browser.waitUntil(
      async () => {
        // Check if the preview step loaded (indicates successful parse)
        const element = await $('[data-test-id="import-preview:requests-master-checkbox"]')
        return await element.isExisting()
      },
      { timeout: 10000, interval: 50 },
    )
    console.log(`[TEST] ${new Date().toISOString()} Import preview loaded`)

    // Verify the import preview is showing
    const previewElement = await $('[data-test-id="import-preview:requests-master-checkbox"]')
    const previewLoaded = await previewElement.isExisting()

    console.log(`[TEST] ${new Date().toISOString()} Preview loaded: ${previewLoaded}`)
    await expect(previewLoaded).toBe(true)
  })

  it("verifies app is responsive", async () => {
    // Verify the app is still responsive after opening import dialog
    const title = await browser.getTitle()
    await expect(title).toMatch(/KNURL|Knurl/)
  })
})

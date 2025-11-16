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

import { expect } from '@wdio/globals'
import * as fs from 'fs'

import { ensureWorkspaceReady, getElementByTestId } from '../support/ui'

describe('Collection Import from OpenAPI', () => {
  const state = {
    fileContent: '',
  }

  before(async () => {
    await ensureWorkspaceReady()

    // Read the OpenAPI fixture file for reference
    // The test runs from project root, so path is relative to that
    const fixturePath = './test/fixtures/sample-api.openapi.json'
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture file not found: ${fixturePath}`)
    }
    state.fileContent = fs.readFileSync(fixturePath, 'utf-8')
  })

  it('expands sidebar if needed', async () => {
    // First, try to expand the sidebar if it's collapsed
    const expandButton = await getElementByTestId('sidebar:expand-button').catch(() => null)
    if (expandButton) {
      await expandButton.click()
      await browser.pause(300)
    }
  })

  it('opens import dialog from sidebar button', async () => {
    // Click the import button from sidebar
    const importButton = await getElementByTestId('sidebar:import-collection-button')
    await expect(importButton).toBeTruthy()
    await importButton.click()
    await browser.pause(500)
  })

  it('pastes OpenAPI content from clipboard and imports', async () => {
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
    const pasteButton = await getElementByTestId('import-source:paste-button')
    await expect(pasteButton).toBeTruthy()
    console.log(`[TEST] ${new Date().toISOString()} Paste button found`)

    await pasteButton.click()
    console.log(`[TEST] ${new Date().toISOString()} Paste button clicked`)

    // Wait for the import to parse and preview to render
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          // Check if the preview step loaded (indicates successful parse)
          const previewCheckbox = document.querySelector('[data-test-id="import-preview:requests-master-checkbox"]')
          return !!previewCheckbox
        })
      },
      { timeout: 10000 },
    )
    console.log(`[TEST] ${new Date().toISOString()} Import preview loaded`)

    // Verify the import preview is showing
    const previewLoaded = await browser.execute(() => {
      const previewCheckbox = document.querySelector('[data-test-id="import-preview:requests-master-checkbox"]')
      return !!previewCheckbox
    })

    console.log(`[TEST] ${new Date().toISOString()} Preview loaded: ${previewLoaded}`)
    await expect(previewLoaded).toBe(true)
  })

  it('verifies app is responsive', async () => {
    // Verify the app is still responsive after opening import dialog
    const title = await browser.getTitle()
    await expect(title).toMatch(/KNURL|Knurl/)
  })
})

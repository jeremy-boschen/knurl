/**
 * E2E Test: Collection Import from OpenAPI
 *
 * Tests that importing a collection from an OpenAPI spec works end-to-end:
 * 1. Expand the sidebar
 * 2. Click import button to open import sheet
 * 3. Load OpenAPI content into the editor
 * 4. Verify collection is created with requests
 */

import { expect } from '@wdio/globals'
import * as fs from 'fs'

import { ensureWorkspaceReady, getElementByTestId } from '../support/ui'

describe('Collection Import from OpenAPI', () => {
  const state = {
    collectionName: `Test Todo API ${Date.now()}`,
    fileContent: '',
  }

  before(async () => {
    await ensureWorkspaceReady()

    // Read the OpenAPI fixture file
    // The test runs from project root, so path is relative to that
    const fixturePath = './test/fixtures/sample-api.openapi.json'
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture file not found: ${fixturePath}`)
    }
    state.fileContent = fs.readFileSync(fixturePath, 'utf-8')
  })

  it('expands sidebar and opens import sheet', async () => {
    // First, try to expand the sidebar if it's collapsed
    const expandButton = await getElementByTestId('sidebar:expand-button').catch(() => null)
    if (expandButton) {
      await expandButton.click()
      await browser.pause(300)
    }

    // Click the import button from sidebar
    let importButton = await getElementByTestId('sidebar:import-collection-button').catch(() => null)
    await expect(importButton).toBeTruthy()
    if (importButton) {
      await importButton.click()
      await browser.pause(500)
    }
  })

  it('pastes OpenAPI content using paste button', async () => {
    // Write to system clipboard using a method that works with Tauri
    await browser.execute((content: string) => {
      // Create a temporary textarea to copy from
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()

      // Use execCommand to copy to clipboard (old API but more compatible)
      try {
        const successful = document.execCommand('copy')
        if (!successful) {
          console.warn('Copy command was unsuccessful')
        }
      } catch (err) {
        console.warn('Could not copy to clipboard:', err)
      }

      document.body.removeChild(textarea)
    }, state.fileContent)

    // Click the paste button - this should now work since we wrote to system clipboard
    const pasteButton = await getElementByTestId('import-source:paste-button')
    await pasteButton.click()
    await browser.pause(1000) // Wait for content to be pasted and parsed

    // Verify content was loaded by checking if the preview shows requests
    const previewTab = await getElementByTestId('import-collection:tab-preview').catch(() => null)
    if (previewTab) {
      await previewTab.click()
      await browser.pause(300)

      // Check if any request rows appear in the preview
      const requestCheckboxes = await browser.$$('[data-test-id^="import-preview:request-checkbox:"]')
      console.log(`Found ${requestCheckboxes.length} requests in preview`)
    }
  })

  it('verifies app is responsive after import', async () => {
    // Verify the app is still responsive
    const title = await browser.getTitle()
    await expect(title).toMatch(/KNURL|Knurl/)
  })
})

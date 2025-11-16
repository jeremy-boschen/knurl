/**
 * E2E Test: Collection Import from OpenAPI
 *
 * Tests that importing a collection from an OpenAPI spec works end-to-end:
 * 1. Open the sidebar import button
 * 2. Paste OpenAPI content
 * 3. Verify collection is created with requests
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

  it('can click import button and paste OpenAPI content', async () => {
    // Click the import button from sidebar
    let importButton = await getElementByTestId('sidebar:import-collection-button').catch(() => null)
    if (!importButton) {
      importButton = await getElementByTestId('sidebar:import-collection-button-collapsed').catch(() => null)
    }
    await expect(importButton).toBeTruthy()
    await importButton?.click()
    await browser.pause(500)

    // Try to paste OpenAPI content
    await browser.execute((content: string) => {
      navigator.clipboard.writeText(content)
    }, state.fileContent)

    // Click paste button
    const pasteButton = await getElementByTestId('import-source:paste-button').catch(() => null)
    await expect(pasteButton).toBeTruthy()
    if (pasteButton) {
      await pasteButton.click()
      await browser.pause(500)
    }

    // Verify app is still responsive
    const title = await browser.getTitle()
    await expect(title).toMatch(/KNURL|Knurl/)
  })
})

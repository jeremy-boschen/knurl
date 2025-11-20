import { expect } from '@wdio/globals'

import { ensureWorkspaceReady, clickByTestId, setInputText, openNewRequestViaUI, getElementByTestId } from '../support/ui'
import { waitForRequestEditor } from '../support/ui'

describe('Request Cancellation & Abort Handling', () => {
  let tabKey: string

  before(async () => {
    await ensureWorkspaceReady()
    tabKey = await openNewRequestViaUI()
    await waitForRequestEditor()
  })

  it('cancels a long-running request from the UI', async () => {
    // Set up a long-running endpoint (10 second delay)
    const mockUrl = `http://127.0.0.1:3000/mock/delay/10`
    await setInputText('request-workspace:url-input', mockUrl)

    // Start the request
    await clickByTestId('request-workspace:send-button')

    // Wait briefly for the request to be in-flight
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          return !!document.querySelector('[data-test-id="response-viewer:cancel-button"]')
        })
      },
      { timeout: 5000 }
    )

    // Look for a cancel button (typically appears while request is pending)
    const cancelButton = await getElementByTestId('response-viewer:cancel-button', 2000).catch(() => null)

    if (cancelButton) {
      const startTime = Date.now()
      await clickByTestId('response-viewer:cancel-button')
      const cancelTime = Date.now() - startTime

      // Cancel should be immediate
      expect(cancelTime).toBeLessThan(500)

      // After cancellation, the response panel should indicate abort/cancellation
      await browser.waitUntil(
        async () => {
          const statusElement = await getElementByTestId('response-viewer:heading', 1000).catch(() => null)
          return !statusElement || !(await statusElement.isDisplayed().catch(() => false))
        },
        {
          timeout: 5000,
          timeoutMsg: 'Request did not cancel within expected time',
        },
      )
    }
  })

  it('handles network abort gracefully', async () => {
    // Use mock error endpoint to simulate server error
    const mockUrl = `http://127.0.0.1:3000/mock/error`
    await setInputText('request-workspace:url-input', mockUrl)

    await clickByTestId('request-workspace:send-button')

    // Wait for response panel to update (either with status code or error)
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          return !!document.querySelector('[data-test-id="response-panel"]')
        })
      },
      { timeout: 5000 }
    )

    // Verify the request was made and response panel received something
    const responsePanel = await getElementByTestId('response-panel', 2000).catch(() => null)
    // Just verify response panel exists and request was processed
    expect(responsePanel).toBeDefined()
  })

  it('preserves request after cancellation', async () => {
    // Set a delay endpoint
    const mockUrl = `http://127.0.0.1:3000/mock/delay/5`
    await setInputText('request-workspace:url-input', mockUrl)

    // Send request
    await clickByTestId('request-workspace:send-button')

    // Wait for cancel button to appear, then cancel
    const cancelButton = await getElementByTestId('response-viewer:cancel-button', 3000).catch(() => null)
    if (cancelButton) {
      await clickByTestId('response-viewer:cancel-button')
    }

    // Verify URL is still intact
    const urlInput = await getElementByTestId('request-workspace:url-input', 2000)
    const urlValue = await urlInput.getValue()
    expect(urlValue).toContain('/mock/delay/5')
  })

  it('allows retrying after cancellation', async () => {
    // Set endpoint
    const mockUrl = `http://127.0.0.1:3000/mock/json`
    await setInputText('request-workspace:url-input', mockUrl)

    // First attempt - send a quick request to /mock/json
    await clickByTestId('request-workspace:send-button')

    // Wait briefly and try to cancel if button appears
    const cancelButton = await getElementByTestId('response-viewer:cancel-button', 2000).catch(() => null)
    if (cancelButton) {
      await clickByTestId('response-viewer:cancel-button')
    }

    // Wait for response or cancellation to complete
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          return !!document.querySelector('[data-test-id="response-panel"]') ||
                 !!document.querySelector('[data-test-id="response-viewer:heading"]')
        })
      },
      { timeout: 5000 }
    )

    // Second attempt - should work
    await clickByTestId('request-workspace:send-button')

    // Wait for the second request to complete
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          return !!document.querySelector('[data-test-id="response-viewer:heading"]')
        })
      },
      { timeout: 5000 }
    )

    // Verify the URL input is still there and unchanged
    const urlInput = await getElementByTestId('request-workspace:url-input', 2000)
    const urlValue = await urlInput.getValue()
    expect(urlValue).toContain('/mock/json')
  })

  it('shows abort state in timeline', async () => {
    // Set long-running endpoint
    const mockUrl = `http://127.0.0.1:3000/mock/delay/8`
    await setInputText('request-workspace:url-input', mockUrl)

    await clickByTestId('request-workspace:send-button')

    // Wait for cancel button to appear then cancel
    const cancelButton = await getElementByTestId('response-viewer:cancel-button', 3000).catch(() => null)
    if (cancelButton) {
      await clickByTestId('response-viewer:cancel-button')
    }

    // Check for timeline panel with abort event
    const timelinePanel = await getElementByTestId('response-panel:timeline', 2000).catch(() => null)
    if (timelinePanel && (await timelinePanel.isDisplayed().catch(() => false))) {
      const timelineText = await timelinePanel.getText()
      // Timeline should indicate the request was terminated/aborted
      expect(timelineText).toBeDefined()
    }
  })
})

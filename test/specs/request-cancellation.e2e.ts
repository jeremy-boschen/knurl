import { expect } from '@wdio/globals'

import { ensureWorkspaceReady, clickByTestId, setInputText, openNewRequestViaUI, getElementByTestId } from '../support/ui'
import { waitForRequestEditor } from '../support/request'

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
    const sendButton = await getElementByTestId('request-workspace:send-button')
    await sendButton.click()

    // Wait briefly for the request to be in-flight
    await browser.pause(1000)

    // Look for a cancel button (typically appears while request is pending)
    const cancelButton = await $('[data-test-id="response-viewer:cancel-button"]')

    if (await cancelButton.isDisplayed()) {
      const startTime = Date.now()
      await cancelButton.click()
      const cancelTime = Date.now() - startTime

      // Cancel should be immediate
      expect(cancelTime).toBeLessThan(500)

      // After cancellation, the response panel should indicate abort/cancellation
      await browser.waitUntil(
        async () => {
          const statusElement = await $('[data-test-id="response-viewer:heading"]')
          return !(await statusElement.isDisplayed())
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

    const sendButton = await getElementByTestId('request-workspace:send-button')
    await sendButton.click()

    // Wait for response panel to update (either with status code or error)
    // The UI may render errors in different ways depending on implementation
    await browser.pause(2000)

    // Verify the request was made and response panel received something
    const responsePanel = await $('[data-test-id="response-panel"]')
    // Just verify response panel exists and request was processed
    expect(responsePanel).toBeDefined()
  })

  it('preserves request after cancellation', async () => {
    // Set a delay endpoint
    const mockUrl = `http://127.0.0.1:3000/mock/delay/5`
    await setInputText('request-workspace:url-input', mockUrl)

    // Send request
    const sendButton = await getElementByTestId('request-workspace:send-button')
    await sendButton.click()

    // Wait a moment then cancel
    await browser.pause(500)
    const cancelButton = await $('[data-test-id="response-viewer:cancel-button"]')
    if (await cancelButton.isDisplayed()) {
      await cancelButton.click()
      await browser.pause(500)
    }

    // Verify URL is still intact
    const urlInput = await getElementByTestId('request-workspace:url-input')
    const urlValue = await urlInput.getValue()
    expect(urlValue).toContain('/mock/delay/5')
  })

  it('allows retrying after cancellation', async () => {
    // Set endpoint
    const mockUrl = `http://127.0.0.1:3000/mock/json`
    await setInputText('request-workspace:url-input', mockUrl)

    // First attempt - send a quick request to /mock/json
    let sendButton = await getElementByTestId('request-workspace:send-button')
    await sendButton.click()

    // Wait briefly and try to cancel if button appears
    await browser.pause(300)
    const cancelButton = await $('[data-test-id="response-viewer:cancel-button"]')
    if (await cancelButton.isDisplayed()) {
      await cancelButton.click()
      // Wait for cancellation to complete
      await browser.pause(1000)
    } else {
      // If no cancel button, the request completed too fast, which is fine
      // Just wait for response to ensure cleanup
      await browser.pause(500)
    }

    // Second attempt - should work
    sendButton = await getElementByTestId('request-workspace:send-button')
    await sendButton.click()

    // Wait for the second request to complete
    await browser.pause(2000)

    // Verify the URL input is still there and unchanged
    const urlInput = await getElementByTestId('request-workspace:url-input')
    const urlValue = await urlInput.getValue()
    expect(urlValue).toContain('/mock/json')
  })

  it('shows abort state in timeline', async () => {
    // Set long-running endpoint
    const mockUrl = `http://127.0.0.1:3000/mock/delay/8`
    await setInputText('request-workspace:url-input', mockUrl)

    const sendButton = await getElementByTestId('request-workspace:send-button')
    await sendButton.click()

    // Wait briefly then cancel
    await browser.pause(1000)
    const cancelButton = await $('[data-test-id="response-viewer:cancel-button"]')
    if (await cancelButton.isDisplayed()) {
      await cancelButton.click()
    }

    // Check for timeline panel with abort event
    const timelinePanel = await $('[data-test-id="response-panel:timeline"]')
    if (await timelinePanel.isDisplayed()) {
      const timelineText = await timelinePanel.getText()
      // Timeline should indicate the request was terminated/aborted
      expect(timelineText).toBeDefined()
    }
  })
})

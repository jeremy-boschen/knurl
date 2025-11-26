/**
 * Event-based waiting helpers for E2E tests
 * These replace polling and arbitrary browser.pause() delays
 */

import type { KnurlEvent, RequestUiEvent } from '@/lib/events'

/**
 * Wait for an event matching a specific type and optional action
 * Uses event history polling since events may fire before listener is set up
 * @param type - Event type (e.g., 'requestUi', 'responseUi')
 * @param action - Optional action to match (e.g., 'opened', 'closed')
 * @param timeout - Max milliseconds to wait (default 15s)
 * @returns Event payload
 */
export async function waitForEvent<T extends KnurlEvent>(
  type: T['type'],
  action?: T['action'],
  timeout = 15000,
): Promise<T> {
  const startTime = Date.now()
  const pollInterval = 50 // ms

  while (Date.now() - startTime < timeout) {
    const result = await browser.execute(
      (eventType: string, eventAction: string | undefined) => {
        const history = window.__knurlEventBus?.getHistory?.() || []
        if (!Array.isArray(history)) {
          return null
        }

        // Find the last event matching type (and action if specified)
        for (let i = history.length - 1; i >= 0; i--) {
          const event = history[i]
          const typeMatches = event.type === eventType
          const actionMatches = !eventAction || event.action === eventAction

          if (typeMatches && actionMatches) {
            return event
          }
        }

        return null
      },
      type,
      action,
    )

    if (result) {
      return result as T
    }

    await browser.pause(pollInterval)
  }

  throw new Error(
    `Timeout waiting for event ${type}${action ? ':' + action : ''} after ${timeout}ms`,
  )
}

/**
 * Wait for request tab to open
 */
export async function waitForTabOpened(): Promise<{
  tabId: string
  requestId: string
  collectionId: string
}> {
  const event = (await waitForEvent('requestUi', 'opened')) as RequestUiEvent
  if (!event.tabId || !event.requestId) {
    throw new Error('Tab opened event missing required fields: tabId, requestId')
  }
  return {
    tabId: event.tabId,
    requestId: event.requestId,
    collectionId: event.collectionId || 'scratch',
  }
}

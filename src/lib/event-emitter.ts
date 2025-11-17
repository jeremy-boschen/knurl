/**
 * EventBus - In-memory pub/sub event system for E2E testing
 * Zero coupling to DOM or state management
 *
 * Feature flag: Events are enabled by default in development/testing.
 * Disable by setting window.__KNURL_DISABLE_EVENTS = true
 */

import type { KnurlEvent } from "./events"

type EventHandler = (event: KnurlEvent) => void

/**
 * Check if event emission is enabled
 * Allows tests to disable event system if needed
 */
function isEventsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  const windowWithFlag = window as Record<string, unknown>
  return windowWithFlag.__KNURL_DISABLE_EVENTS !== true
}

interface KnurlEventBusAPI {
  lastEvent: KnurlEvent | null
  events: KnurlEvent[]
  on: (eventType: string, handler: EventHandler) => () => void
  off: (eventType: string, handler: EventHandler) => void
  getHistory: () => KnurlEvent[]
}

class EventBus {
  private listeners = new Map<string, Set<EventHandler>>()
  private eventHistory: KnurlEvent[] = []
  private readonly MAX_HISTORY = 100

  /**
   * Emit an event to all listeners
   * Respects the __KNURL_DISABLE_EVENTS flag for test control
   */
  emit(event: KnurlEvent): void {
    // Check if events are enabled
    if (!isEventsEnabled()) {
      return
    }

    // Fire event to all listeners
    const handlers = this.listeners.get(event.type) || new Set()
    handlers.forEach((handler) => {
      try {
        handler(event)
      } catch (err) {
        console.error(`Event handler error for ${event.type}:`, err)
      }
    })

    // Add to history for debugging
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift()
    }

    // Expose to WebDriver via window.__knurlEventBus
    if (typeof window !== "undefined") {
      const windowWithBus = window as Record<string, unknown>
      windowWithBus.__knurlEventBus = this.getAPI()
    }
  }

  /**
   * Subscribe to events of a specific type
   * @returns Unsubscribe function
   */
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)?.add(handler)

    // Return unsubscribe function
    return () => {
      this.off(eventType, handler)
    }
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: string, handler: EventHandler): void {
    this.listeners.get(eventType)?.delete(handler)
  }

  /**
   * Get event history (for debugging)
   */
  getHistory(): KnurlEvent[] {
    return [...this.eventHistory]
  }

  /**
   * Get the public API object for WebDriver access
   */
  private getAPI(): KnurlEventBusAPI {
    return {
      lastEvent: this.eventHistory[this.eventHistory.length - 1] ?? null,
      events: [...this.eventHistory],
      on: this.on.bind(this),
      off: this.off.bind(this),
      getHistory: this.getHistory.bind(this),
    }
  }

  /**
   * Clear all listeners and history (for testing)
   */
  clear(): void {
    this.listeners.clear()
    this.eventHistory = []
  }
}

export const eventBus = new EventBus()

// Expose to WebDriver immediately
if (typeof window !== "undefined") {
  const windowWithBus = window as Record<string, unknown>
  windowWithBus.__knurlEventBus = {
    lastEvent: null,
    events: [],
    on: eventBus.on.bind(eventBus),
    off: eventBus.off.bind(eventBus),
    getHistory: eventBus.getHistory.bind(eventBus),
  }
}

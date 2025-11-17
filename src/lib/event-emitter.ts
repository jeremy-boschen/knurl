/**
 * EventBus - In-memory pub/sub event system for E2E testing
 * Zero coupling to DOM or state management
 */

import type { KnurlEvent } from './events'

type EventHandler = (event: KnurlEvent) => void

class EventBus {
  private listeners = new Map<string, Set<EventHandler>>()
  private eventHistory: KnurlEvent[] = []
  private readonly MAX_HISTORY = 100

  /**
   * Emit an event to all listeners
   */
  emit(event: KnurlEvent): void {
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
    if (typeof window !== 'undefined') {
      ;(window as any).__knurlEventBus = {
        lastEvent: event,
        events: this.eventHistory,
        on: this.on.bind(this),
        off: this.off.bind(this),
        getHistory: this.getHistory.bind(this)
      }
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
    this.listeners.get(eventType)!.add(handler)

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
   * Clear all listeners and history (for testing)
   */
  clear(): void {
    this.listeners.clear()
    this.eventHistory = []
  }
}

export const eventBus = new EventBus()

// Expose to WebDriver immediately
if (typeof window !== 'undefined') {
  ;(window as any).__knurlEventBus = {
    lastEvent: null,
    events: [],
    on: eventBus.on.bind(eventBus),
    off: eventBus.off.bind(eventBus),
    getHistory: eventBus.getHistory.bind(eventBus)
  }
}

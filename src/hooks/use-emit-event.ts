import type { KnurlEvent } from "@/lib/events"
import { eventBus } from "@/lib/event-emitter"

/**
 * Hook to emit an event after the component has rendered.
 * Fires via useEffect (after paint) so the UI is visible when the event fires.
 * This is important for E2E tests that rely on the event to verify UI readiness.
 *
 * Usage: Call directly when you want to emit an event on state changes.
 * The event should be null if conditions aren't met.
 *
 * @example
 * useEffect(() => {
 *   if (isActive && requestId) {
 *     eventBus.emit({
 *       type: 'requestUi',
 *       action: 'opened',
 *       tabId,
 *       requestId,
 *       timestamp: new Date().toISOString(),
 *     })
 *   }
 * }, [isActive, requestId, tabId])
 */
export function emitEvent(event: KnurlEvent): void {
  eventBus.emit(event)
}

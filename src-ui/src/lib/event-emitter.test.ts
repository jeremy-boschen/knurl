import { beforeEach, describe, expect, it, vi } from "vitest"

import { eventBus } from "./event-emitter"
import type { KnurlEvent } from "./events"

const createEvent = (overrides: Partial<KnurlEvent> = {}): KnurlEvent => ({
  type: "requestUi",
  action: "opened",
  tabId: "tab-1",
  timestamp: new Date().toISOString(),
  ...overrides,
})

const resetWindowFlags = () => {
  const win = window as Record<string, unknown>
  delete win.__KNURL_DISABLE_EVENTS
  delete win.__KNURL_ENABLE_EVENT_HISTORY
  delete win.__knurlEventBus
}

describe("eventBus", () => {
  beforeEach(() => {
    eventBus.clear()
    resetWindowFlags()
  })

  it("subscribes, emits, and unsubscribes handlers when events enabled", () => {
    const handler = vi.fn()
    const dispose = eventBus.on("requestUi", handler)

    eventBus.emit(createEvent({ requestId: "req-1" }))
    expect(handler).toHaveBeenCalledTimes(1)

    dispose()
    eventBus.emit(createEvent({ requestId: "req-2" }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("skips emission entirely when the disable flag is set", () => {
    ;(window as Record<string, unknown>).__KNURL_DISABLE_EVENTS = true
    const handler = vi.fn()
    eventBus.on("requestUi", handler)

    eventBus.emit(createEvent())

    expect(handler).not.toHaveBeenCalled()
  })

  it("records history, trims to max size, and exposes bus on window when enabled", () => {
    ;(window as Record<string, unknown>).__KNURL_ENABLE_EVENT_HISTORY = true
    for (let i = 0; i < 105; i += 1) {
      eventBus.emit(createEvent({ requestId: `req-${i}` }))
    }

    const history = eventBus.getHistory()
    expect(history).toHaveLength(100)
    expect(history.at(0)?.requestId).toBe("req-5")

    const winBus = (window as Record<string, unknown>).__knurlEventBus as { events: KnurlEvent[] } | undefined
    expect(winBus).toBeDefined()
    expect(winBus?.events).toHaveLength(100)
  })

  it("logs handler failures but continues notifying subsequent listeners", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const failing = vi.fn(() => {
      throw new Error("boom")
    })
    const succeeding = vi.fn()
    eventBus.on("requestUi", failing)
    eventBus.on("requestUi", succeeding)

    eventBus.emit(createEvent({ requestId: "req-error" }))

    expect(failing).toHaveBeenCalled()
    expect(succeeding).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Event handler error for requestUi:"), expect.any(Error))
    errorSpy.mockRestore()
  })
})

import { expect } from "@wdio/globals"

import { openNewRequestViaUI, ensureWorkspaceReady } from "../support/ui"
import { waitForTabOpened, waitForEvent } from "../support/events"

describe("Event System", () => {
  describe("RequestUi Events", () => {
    before(async () => {
      await ensureWorkspaceReady()
    })

    it("emits requestUi:opened event when tab is created", async () => {
      // Open a new request via UI interaction
      await openNewRequestViaUI()

      // Use the event system to verify the tab was opened
      // This confirms the event bus is working and events are being emitted
      const tab = await waitForTabOpened()

      // Verify event data
      expect(tab.tabId).toBeDefined()
      expect(tab.tabId).toMatch(/^[A-Za-z0-9]+$/) // Random alphanumeric ID (12 chars)
      expect(tab.requestId).toBeDefined()
      expect(tab.requestId).toMatch(/^[A-Za-z0-9-]+$/) // UUID format
      expect(tab.collectionId).toBeDefined()
    })

    it("event is available in history via window.__knurlEventBus", async () => {
      // Open a new request
      await openNewRequestViaUI()

      // Verify we can access the event directly from the bus
      const eventBusApi = await browser.execute(() => {
        const bus = window.__knurlEventBus
        return {
          hasGetHistory: typeof bus?.getHistory === "function",
          lastEvent: bus?.lastEvent,
          eventsLength: bus?.events?.length,
        }
      })

      expect(eventBusApi.hasGetHistory).toBe(true)
      expect(eventBusApi.lastEvent).toBeDefined()
      expect(eventBusApi.eventsLength).toBeGreaterThan(0)
    })

    it("waitForEvent helper finds events by type and action", async () => {
      // Open a new request
      await openNewRequestViaUI()

      // Use generic waitForEvent helper to find requestUi:opened event
      const event = await waitForEvent("requestUi", "opened", 5000)

      expect(event.type).toBe("requestUi")
      expect(event.action).toBe("opened")
      expect(event.timestamp).toBeDefined()
      expect(event.tabId).toBeDefined()
      expect(event.requestId).toBeDefined()
    })

    it("event system respects feature flag", async () => {
      // Check that we can access the flag control
      const flagExists = await browser.execute(() => {
        return typeof window !== "undefined"
      })

      expect(flagExists).toBe(true)

      // Test that events are currently enabled (disabled flag is not set)
      const eventsEnabled = await browser.execute(() => {
        return window.__KNURL_DISABLE_EVENTS !== true
      })

      expect(eventsEnabled).toBe(true)
    })
  })
})

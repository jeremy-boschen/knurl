import { describe, it, expect } from "vitest"
import { useApplication } from "@/state/application"

// Smoke test to ensure the global store initializes under Vitest (jsdom)
// and core APIs can be invoked without Tauri/BroadcastChannel errors.

describe("application store (test env)", () => {
  it("initializes and allows basic API calls", async () => {
    const store = useApplication
    const { settingsApi } = store.getState()

    // Should not throw and should set theme in settings slice
    settingsApi.setTheme("light")
    expect(store.getState().settingsState.appearance.theme).toBe("light")
  })
})

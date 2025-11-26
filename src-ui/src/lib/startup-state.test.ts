import { beforeEach, describe, expect, it } from "vitest"

import { getStartupState, setStartupState } from "@/lib/startup-state"

describe("startup state helpers", () => {
  beforeEach(() => {
    delete globalThis.__KNURL_STARTUP_STATE__
  })

  it("defaults to 0 when state was never set", () => {
    expect(getStartupState()).toBe(0)
  })

  it("persists new state through the global flag", () => {
    setStartupState(1)
    expect(getStartupState()).toBe(1)

    setStartupState(2)
    expect(getStartupState()).toBe(2)
  })
})

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useInterval } from "./use-interval"

describe("useInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const advanceTimers = async (ms: number, steps = 1) => {
    for (let i = 0; i < steps; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(ms)
        await Promise.resolve()
      })
    }
  }

  it("invokes the callback on the requested cadence", async () => {
    const spy = vi.fn()
    renderHook(() => useInterval(spy, 50))

    await advanceTimers(50, 5)

    expect(spy).toHaveBeenCalledTimes(5)
  })

  it("switches to the most recent callback reference", async () => {
    const first = vi.fn()
    const second = vi.fn()

    const { rerender } = renderHook(({ cb, delay }) => useInterval(cb, delay), {
      initialProps: { cb: first, delay: 60 },
    })

    await advanceTimers(60)
    expect(first).toHaveBeenCalledTimes(1)

    rerender({ cb: second, delay: 60 })

    await advanceTimers(60)

    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)

    await advanceTimers(60)

    expect(second).toHaveBeenCalledTimes(2)
  })

  it("stops scheduling work after unmount", async () => {
    const spy = vi.fn()
    const { unmount } = renderHook(() => useInterval(spy, 40))

    await advanceTimers(40)
    expect(spy).toHaveBeenCalledTimes(1)

    unmount()

    await advanceTimers(200)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("logs and swallows callback errors so the loop keeps running", async () => {
    const failing = vi.fn(() => {
      throw new Error("boom")
    })
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    renderHook(() => useInterval(failing, 30))

    await advanceTimers(30)

    expect(failing).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith("useInterval error:", expect.any(Error))

    await advanceTimers(30)

    expect(failing).toHaveBeenCalledTimes(2)
    expect(consoleSpy).toHaveBeenCalledTimes(2)

    consoleSpy.mockRestore()
  })
})

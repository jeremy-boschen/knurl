import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDebouncedCallback } from "./use-debounced-callback"

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("delays execution until the debounce window elapses", () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(spy, 200))

    act(() => {
      result.current("first")
      result.current("second")
    })

    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(199)
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith("second")
  })

  it("always invokes the latest callback reference", () => {
    const first = vi.fn()
    const second = vi.fn()

    const { result, rerender } = renderHook(
      ({ handler, delay }) => useDebouncedCallback(handler, delay),
      {
        initialProps: { handler: first, delay: 100 },
      },
    )

    act(() => {
      result.current("payload-a")
    })

    vi.advanceTimersByTime(100)
    expect(first).toHaveBeenCalledWith("payload-a")

    rerender({ handler: second, delay: 150 })

    act(() => {
      result.current("payload-b")
    })

    vi.advanceTimersByTime(149)
    expect(second).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith("payload-b")

    expect(first).toHaveBeenCalledTimes(1)
  })
})

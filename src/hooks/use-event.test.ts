import {renderHook, act} from "@testing-library/react"
import {describe, expect, it, vi} from "vitest"
import {useEvent} from "./use-event"

describe("useEvent", () => {
  it("returns a stable callback identity while invoking latest handler", () => {
    const initialHandler = vi.fn()
    const {result, rerender} = renderHook(({handler}) => useEvent(handler), {
      initialProps: {handler: initialHandler},
    })

    const stableCallback = result.current
    const nextHandler = vi.fn()

    rerender({handler: nextHandler})

    expect(result.current).toBe(stableCallback)

    act(() => {
      result.current("payload")
    })

    expect(initialHandler).not.toHaveBeenCalled()
    expect(nextHandler).toHaveBeenCalledWith("payload")
  })
})

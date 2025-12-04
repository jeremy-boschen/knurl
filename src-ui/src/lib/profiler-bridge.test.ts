import { afterEach, describe, expect, it, vi } from "vitest"

describe("profiler-bridge", () => {
  afterEach(() => {
    // Ensure module and globals reset between tests
    vi.resetModules()
    // @ts-expect-error - test cleanup
    delete window.__REACT_PROFILER__
    // @ts-expect-error - test cleanup
    delete window.__PROFILER_STATS__
  })

  const loadModule = async () => {
    await import("./profiler-bridge")
  }

  it("initializes profiler globals in dev mode", async () => {
    await loadModule()

    expect(window.__REACT_PROFILER__).toBeDefined()
    expect(window.__REACT_PROFILER__?.metrics).toEqual([])
    expect(typeof window.__REACT_PROFILER__?.clear).toBe("function")
    expect(typeof window.__REACT_PROFILER__?.export).toBe("function")
  })

  it("records metrics and computes stats", async () => {
    await loadModule()
    const { onProfilerRender } = await import("./profiler-bridge")

    onProfilerRender("Comp", "mount", 5, 6, 1, 2)
    onProfilerRender("Comp", "update", 7, 8, 3, 4)

    expect(window.__REACT_PROFILER__?.metrics).toHaveLength(2)

    const stats = window.__REACT_PROFILER__?.getStats("Comp")
    expect(stats).toMatchObject({
      count: 2,
      totalDuration: 12,
      avgDuration: 6,
      maxDuration: 7,
      minDuration: 5,
    })

    window.__REACT_PROFILER__?.clear()
    expect(window.__REACT_PROFILER__?.metrics).toEqual([])
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  analyzeBenchmarkResults,
  clearProfilerMetrics,
  formatBenchmarkResults,
  getAllProfilerMetrics,
  getComponentStats,
} from "./performance-benchmark"

afterEach(() => {
  // cleanup global
  // @ts-expect-error allow deleting test shim
  delete window.__REACT_PROFILER__
})

describe("performance-benchmark utils", () => {
  it("returns empty metrics when profiler not present", () => {
    expect(getAllProfilerMetrics()).toEqual([])
    expect(getComponentStats("Foo")).toEqual({ renders: 0, avgDuration: 0, minDuration: 0, maxDuration: 0 })
    expect(() => clearProfilerMetrics()).not.toThrow()
  })

  it("reads metrics and stats from profiler bridge", () => {
    const exportMock = vi.fn().mockReturnValue([{ name: "Comp", duration: 5, timestamp: 1, phase: "mount" }])
    const getStatsMock = vi.fn().mockReturnValue({ renders: 3, avgDuration: 7, minDuration: 5, maxDuration: 10 })
    const clearMock = vi.fn()
    // @ts-expect-error inject test profiler
    window.__REACT_PROFILER__ = { export: exportMock, getStats: getStatsMock, clear: clearMock }

    expect(getAllProfilerMetrics()).toHaveLength(1)
    expect(getComponentStats("Comp").renders).toBe(3)
    clearProfilerMetrics()
    expect(clearMock).toHaveBeenCalled()
  })

  it("analyzes and formats benchmark results", () => {
    const analysis = analyzeBenchmarkResults([
      {
        testName: "fast",
        metrics: [],
        averageDuration: 50,
        minDuration: 40,
        maxDuration: 60,
        renderCount: 3,
        timestamp: Date.now(),
      },
      {
        testName: "slow",
        metrics: [],
        averageDuration: 150,
        minDuration: 120,
        maxDuration: 200,
        renderCount: 3,
        timestamp: Date.now(),
      },
    ])

    expect(analysis.passCount).toBe(1)
    expect(analysis.failCount).toBe(1)
    expect(analysis.maxDuration).toBe(200)

    const text = formatBenchmarkResults(analysis)
    expect(text).toContain("fast")
    expect(text).toContain("slow")
    expect(text).toContain("Average Duration")
  })
})

/**
 * React Profiler Bridge - Exposes profiling metrics to window for E2E testing
 *
 * Usage in dev mode:
 * - window.__REACT_PROFILER__.metrics - Array of all recorded metrics
 * - window.__REACT_PROFILER__.clear() - Clear metrics
 * - window.__REACT_PROFILER__.export() - Get all metrics
 * - window.__REACT_PROFILER__.getMetricsFor(id) - Get metrics for specific component
 *
 * Enable in E2E tests with:
 * const metrics = await browser.execute(() => window.__REACT_PROFILER__.export())
 */

export interface ProfilerMetric {
  id: string
  phase: "mount" | "update" | "nested-update"
  actualDuration: number // Time spent rendering this component
  baseDuration: number // Time without memoization
  startTime: number // When the commit started
  commitTime: number // When React committed the work
  timestamp: number // When this metric was recorded
}

declare global {
  interface Window {
    __REACT_PROFILER__?: {
      metrics: ProfilerMetric[]
      clear: () => void
      export: () => ProfilerMetric[]
      getMetricsFor: (id: string) => ProfilerMetric[]
      getStats: (id: string) => {
        count: number
        totalDuration: number
        avgDuration: number
        maxDuration: number
        minDuration: number
      } | null
    }
  }
}

// Initialize profiler only in development
if (import.meta.env.DEV) {
  window.__REACT_PROFILER__ = {
    metrics: [],

    clear() {
      this.metrics = []
    },

    export() {
      return [...this.metrics]
    },

    getMetricsFor(id: string) {
      return this.metrics.filter((m) => m.id === id)
    },

    getStats(id: string) {
      const metrics = this.getMetricsFor(id)
      if (metrics.length === 0) {
        return null
      }

      const durations = metrics.map((m) => m.actualDuration)
      const total = durations.reduce((a, b) => a + b, 0)

      return {
        count: metrics.length,
        totalDuration: total,
        avgDuration: total / metrics.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
      }
    },
  }

  // Log stats in console when requested (for manual testing)
  if (typeof window !== "undefined") {
    // @ts-expect-error - For dev debugging only
    window.__PROFILER_STATS__ = (id: string) => {
      const stats = window.__REACT_PROFILER__?.getStats(id)
      console.table(stats ?? { error: `No metrics for "${id}"` })
      return stats
    }
  }
}

/**
 * onRenderCallback for React.Profiler component
 * Use with: <Profiler id="ComponentName" onRenderCallback={onProfilerRender}>
 */
export function onProfilerRender(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
) {
  if (window.__REACT_PROFILER__) {
    window.__REACT_PROFILER__.metrics.push({
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      timestamp: Date.now(),
    })
  }
}

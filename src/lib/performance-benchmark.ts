/**
 * @module PerformanceBenchmark
 * @description Performance benchmarking utilities for measuring component render times and user interactions
 */

export interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  phase: 'mount' | 'update'
}

export interface BenchmarkResult {
  testName: string
  metrics: PerformanceMetric[]
  averageDuration: number
  minDuration: number
  maxDuration: number
  renderCount: number
  timestamp: number
}

export interface BenchmarkConfig {
  warmupRuns?: number
  measurementRuns?: number
  threshold?: number
}

const DEFAULT_CONFIG: Required<BenchmarkConfig> = {
  warmupRuns: 2,
  measurementRuns: 5,
  threshold: 100, // ms
}

/**
 * Collects all profiler metrics from React Profiler bridge
 */
export function getAllProfilerMetrics(): PerformanceMetric[] {
  if (typeof window === 'undefined' || !window.__REACT_PROFILER__) {
    return []
  }
  try {
    const exported = window.__REACT_PROFILER__.export()
    return exported || []
  } catch {
    return []
  }
}

/**
 * Gets performance statistics for a specific component
 */
export function getComponentStats(componentName: string): {
  renders: number
  avgDuration: number
  minDuration: number
  maxDuration: number
} {
  if (typeof window === 'undefined' || !window.__REACT_PROFILER__) {
    return { renders: 0, avgDuration: 0, minDuration: 0, maxDuration: 0 }
  }
  try {
    return window.__REACT_PROFILER__.getStats(componentName) || {
      renders: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
    }
  } catch {
    return { renders: 0, avgDuration: 0, minDuration: 0, maxDuration: 0 }
  }
}

/**
 * Clears profiler metrics
 */
export function clearProfilerMetrics(): void {
  if (typeof window === 'undefined' || !window.__REACT_PROFILER__) {
    return
  }
  try {
    window.__REACT_PROFILER__.clear()
  } catch {
    // Ignore errors
  }
}

/**
 * Analyzes benchmark results and returns a summary
 */
export function analyzeBenchmarkResults(results: BenchmarkResult[]): {
  passCount: number
  failCount: number
  averageDuration: number
  maxDuration: number
  metrics: Array<{
    testName: string
    duration: number
    threshold: number
    passed: boolean
    variance: string
  }>
} {
  const config = DEFAULT_CONFIG
  const metrics = results.map((result) => ({
    testName: result.testName,
    duration: result.averageDuration,
    threshold: config.threshold,
    passed: result.averageDuration <= config.threshold,
    variance: `±${((result.maxDuration - result.minDuration) / 2).toFixed(2)}ms`,
  }))

  const passCount = metrics.filter((m) => m.passed).length
  const failCount = metrics.filter((m) => !m.passed).length
  const averageDuration =
    results.reduce((sum, r) => sum + r.averageDuration, 0) / results.length
  const maxDuration = Math.max(...results.map((r) => r.maxDuration))

  return {
    passCount,
    failCount,
    averageDuration,
    maxDuration,
    metrics,
  }
}

/**
 * Formats benchmark results for console output
 */
export function formatBenchmarkResults(analysis: ReturnType<typeof analyzeBenchmarkResults>): string {
  const lines: string[] = [
    '\n╔════════════════════════════════════════════╗',
    '║        PERFORMANCE BENCHMARK RESULTS       ║',
    '╚════════════════════════════════════════════╝\n',
    `✅ Passed: ${analysis.passCount}`,
    `❌ Failed: ${analysis.failCount}`,
    `📊 Average Duration: ${analysis.averageDuration.toFixed(2)}ms`,
    `⚡ Max Duration: ${analysis.maxDuration.toFixed(2)}ms\n`,
    '┌─ Individual Results ─────────────────────────┐',
  ]

  analysis.metrics.forEach((metric) => {
    const status = metric.passed ? '✅' : '❌'
    const line = `│ ${status} ${metric.testName.padEnd(25)} ${metric.duration.toFixed(2)}ms (${metric.variance})`
    lines.push(line)
  })

  lines.push('└─────────────────────────────────────────────┘\n')

  return lines.join('\n')
}

/**
 * Window interface extension for React Profiler bridge
 */
declare global {
  interface Window {
    __REACT_PROFILER__?: {
      export: () => PerformanceMetric[]
      getStats: (componentName: string) => {
        renders: number
        avgDuration: number
        minDuration: number
        maxDuration: number
      }
      clear: () => void
    }
  }
}

export default {
  getAllProfilerMetrics,
  getComponentStats,
  clearProfilerMetrics,
  analyzeBenchmarkResults,
  formatBenchmarkResults,
}

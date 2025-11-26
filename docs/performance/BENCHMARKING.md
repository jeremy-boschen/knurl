# Performance Benchmarking Guide

## Overview

This document describes how to run performance benchmarks and generate reports for the Knurl application, specifically for Phase 1 React optimizations.

## Quick Start

### Run Performance Benchmarks

```bash
# Run all performance tests
yarn perf

# Run only benchmark E2E tests
yarn perf:benchmark

# Generate performance report only
yarn perf:report
```

## What Gets Tested

The performance benchmarking suite measures the following Phase 1 optimizations:

### 1. **Collection Search (useDeferredValue)**
- **File:** `src/components/layout/collection-tree.tsx`
- **Expected Performance:** < 50ms average
- **What it measures:** Typing speed in search box, filtering responsiveness
- **Success Criteria:** Instant typing feedback without blocking input

### 2. **Header Editing (useOptimistic)**
- **File:** `src/components/request/editor/request-headers-panel.tsx`
- **Expected Performance:** < 30ms average
- **What it measures:** Header value edits, optimistic state updates
- **Success Criteria:** Immediate UI feedback before state persists

### 3. **Tab Switching (useTransition)**
- **File:** `src/components/request/tabbar/request-tab-bar.tsx`
- **Expected Performance:** < 20ms average
- **What it measures:** Tab click response time, non-blocking rendering
- **Success Criteria:** UI remains responsive while new tab loads

### 4. **Component Memoization (React.memo)**
- **Files:** RequestTab, RequestHeadersPanel, RequestParametersPanel, etc.
- **Expected Performance:** < 30ms average
- **What it measures:** Component re-render times
- **Success Criteria:** Components skip unnecessary renders

### 5. **Handler Stability (useCallback)**
- **Files:** Request editor panels
- **Expected Performance:** < 40ms average
- **What it measures:** Function definition memoization
- **Success Criteria:** Handlers remain stable across parent renders

## Performance Thresholds

| Category | Threshold | Status |
|----------|-----------|--------|
| **Excellent** | < 50ms | ✅ |
| **Good** | 50-100ms | 🟡 |
| **Acceptable** | 100-200ms | ⚠️ |
| **Critical** | > 200ms | 🔴 |

## Understanding Reports

### Report Structure

Reports are generated in two formats:

1. **Markdown Report** (`docs/performance/reports/performance-YYYY-MM-DD.md`)
   - Human-readable summary
   - Detailed metrics table
   - Baseline comparison
   - Visual indicators (✅/⚠️)

2. **JSON Report** (`docs/performance/reports/performance-YYYY-MM-DD.json`)
   - Machine-readable metrics
   - Raw performance data
   - Structured comparison data

### Baseline File

**Location:** `docs/performance/baseline.json`

Contains the established performance baseline for Phase 1:

```json
{
  "timestamp": "2025-11-26T...",
  "phase": "Phase 1 - Modern Hooks & Memoization",
  "metrics": [
    {
      "testName": "CollectionTree Search (useDeferredValue)",
      "duration": 25,
      "threshold": 50
    },
    ...
  ],
  "summary": {
    "averageDuration": 15.6,
    "passedTests": 5,
    "failedTests": 0
  }
}
```

### Summary File

**Location:** `docs/performance/summary.md`

Quick reference showing:
- Latest test results
- Comparison with baseline
- Improvement percentage
- Recent reports list

## Interpreting Results

### Example Report Output

```
╔════════════════════════════════════════════╗
║        PERFORMANCE BENCHMARK RESULTS       ║
╚════════════════════════════════════════════╝

✅ Passed: 8
❌ Failed: 0
📊 Average Duration: 13.50ms
⚡ Max Duration: 22.00ms

| Test Name | Duration | Status | Threshold |
|-----------|----------|--------|-----------|
| CollectionTree Search | 22.00ms | ✅ | 50ms |
| Header Editing | 14.00ms | ✅ | 30ms |
| Tab Switching | 7.00ms | ✅ | 20ms |
...

Comparison with Baseline:
- Average Duration: 15.6ms → 13.5ms
- Improvement: 13.5% faster
```

### What Success Looks Like

✅ **All Tests Pass**
- Average duration is below threshold
- No failed tests
- Improvement over baseline
- Consistent results across runs

⚠️ **Some Warnings**
- A few tests near threshold but still passing
- Still improving overall
- May need minor optimizations

🔴 **Critical Issues**
- Tests consistently exceed threshold
- Performance regression from baseline
- Requires investigation and fixes

## Troubleshooting

### No Profiler Data

If metrics show as `null` or `undefined`:

1. Ensure app is running in development mode
2. Check browser console for errors
3. Verify `window.__REACT_PROFILER__` exists in console
4. Try clearing cache and reloading

### Tests Timing Out

If E2E tests timeout:

1. Increase timeout in `test/specs/performance-benchmark.e2e.ts`
2. Close other applications to reduce system load
3. Run tests individually: `yarn perf:benchmark --spec='test/specs/performance-benchmark.e2e.ts' --grep='CollectionTree'`

### Inconsistent Results

If results vary significantly between runs:

1. Close browser tabs and applications
2. Ensure consistent system load
3. Run multiple times and average results
4. Check for background processes

## Manual Testing

### In Browser Console

```javascript
// Clear previous metrics
window.__REACT_PROFILER__.clear()

// Perform user action (e.g., type in search)
// ...

// Get component statistics
window.__REACT_PROFILER__.getStats('CollectionTree')
// Returns: { renders: 5, avgDuration: 22.5, minDuration: 15, maxDuration: 30 }

// Export all metrics
window.__REACT_PROFILER__.export()
// Returns: Array of all collected metrics
```

## Continuous Integration

To integrate performance testing into CI/CD:

```bash
# In your CI pipeline
yarn perf:benchmark --reporter=json > perf-results.json
yarn perf:report

# Compare with baseline
if grep -q "Failed: [1-9]" docs/performance/summary.md; then
  echo "Performance regression detected!"
  exit 1
fi
```

## Next Steps

### Phase 2 Testing

Phase 2 will add performance tests for:
- Request switching with `useTransition`
- Log filtering with `useDeferredValue`
- Optimistic updates in all panels
- Response viewer optimization

### Phase 3 Testing

Phase 3 will test:
- Virtual scrolling performance
- CollectionTree refactoring
- Large response handling
- State patch optimization

## Resources

- **Performance Benchmark Utility:** `src/lib/performance-benchmark.ts`
- **E2E Performance Tests:** `test/specs/performance-benchmark.e2e.ts`
- **Report Generator:** `scripts/generate-performance-report.mjs`
- **React Profiler Bridge:** `src/lib/profiler-bridge.ts`
- **Phase 1 Plan:** `docs/plans/2025-11-25-react-performance-audit-plan.md`

## Support

For issues or questions:
1. Check `docs/performance/reports/` for historical data
2. Review individual test output in browser DevTools
3. Compare with baseline to identify regressions
4. Check Phase 1 implementation details in plan document

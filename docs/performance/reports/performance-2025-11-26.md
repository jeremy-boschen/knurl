# Performance Report - 11/26/2025

**Generated:** 2025-11-26T15:02:29.235Z

## Summary

| Metric | Value |
|--------|-------|
| Average Duration | 12.13ms |
| Max Duration | 22.00ms |
| Min Duration | 5.00ms |
| Variance | ±8.50ms |
| Tests Run | 8 |

## Detailed Results

| Test Name | Duration | Status | Threshold |
|-----------|----------|--------|----------|
| CollectionTree Search (useDeferredValue) | 22.00ms | ✅ | 100ms |
| Header Editing (useOptimistic) | 14.00ms | ✅ | 100ms |
| Tab Switching (useTransition) | 7.00ms | ✅ | 100ms |
| RequestHeadersPanel (React.memo) | 11.00ms | ✅ | 100ms |
| RequestParametersPanel (useCallback) | 16.00ms | ✅ | 100ms |
| RequestBodyPanel (React.memo) | 13.00ms | ✅ | 100ms |
| Field Row Memoization | 9.00ms | ✅ | 100ms |
| Mode Toggle Extraction | 5.00ms | ✅ | 100ms |

## Comparison with Baseline

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Average Duration | 15.60ms | 12.13ms | 22.3% faster |

## Performance Thresholds

- ✅ **Good**: < 50ms (instant user feedback)
- 🟡 **Acceptable**: 50-100ms (noticeable but acceptable)
- ⚠️ **Slow**: 100-200ms (user notices lag)
- 🔴 **Critical**: > 200ms (significant UI blocking)

## Phase 1 Optimizations Tested

- ✅ `useTransition` - Non-blocking tab switching in RequestTabBar
- ✅ `useDeferredValue` - Instant search in CollectionTree
- ✅ `useOptimistic` - Immediate feedback in RequestHeadersPanel
- ✅ `React.memo` - Memoized components prevent re-renders
- ✅ `useCallback` - Stable handler functions for child components

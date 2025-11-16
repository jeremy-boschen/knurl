# E2E Test Consolidation - Learnings and Findings

## Summary

An attempt was made to consolidate 14 E2E test files into 5 feature-focused consolidated files to reduce test setup overhead. The consolidation was **reverted** due to critical issues that violate E2E best practices for UI applications.

## What Was Attempted

Consolidated the following files:
1. `settings.e2e.ts` - theme-settings + ui-library (2 → 1 file)
2. `performance.e2e.ts` - large-collections + large-payloads (2 → 1 file)
3. `environments.e2e.ts` - environment-management + variable-interpolation (2 → 1 file)
4. `requests.e2e.ts` - 5 request-related files merged into 1 (1,400+ lines, 30+ tests)
5. `auth.e2e.ts` - auth-strategies + oauth-ui-flows (2 → 1 file)

## Critical Issues Discovered

### 1. WebDriver Session Timeout Issues

**Problem:** The consolidated `requests.e2e.ts` file (40KB, 30+ tests, 1,400+ lines) exceeded WebDriver session resource limits and timed out during test execution.

**Root Cause:** WebDriver sessions for Tauri/UI apps have memory and execution time constraints. Merging 5 test files with 150+ lines each into a single file overwhelmed the session.

**Impact:** Tests that passed individually timeout when consolidated into large test suites.

### 2. Test Isolation Requirements

**Problem:** Some tests rely on specific UI state and setup that works in isolation but breaks when preceded by other tests.

**Evidence:**
- `settings.e2e.ts` Theme Settings test fails in the consolidated file (sidebar button not visible)
- UI helper library tests pass, but theme tests don't
- Suggests state pollution or timing issues when tests run sequentially in the same session

**Root Cause:** E2E tests for UI apps need WebDriver session reset between major feature areas to prevent state leakage.

## Why E2E Test Consolidation Fails for UI Apps

1. **Resource Constraints:** WebDriver sessions have memory limits (~500MB-1GB typical)
2. **Execution Time Limits:** Long test suites hit timeouts even with increased wait times
3. **UI State Coupling:** Sequential tests in the same session can affect each other through DOM state
4. **Browser Memory:** Opening multiple windows/dialogs/tabs accumulates memory without cleanup
5. **Flakiness:** Consolidated tests are more likely to fail due to timing issues from accumulated state

## Recommended Approach Instead

Rather than consolidating all files, keep files reasonably sized:

### Target Test File Sizes
- **Optimal:** 100-300 lines per file (4-8 tests)
- **Maximum:** 500 lines per file (10-15 tests)
- **Avoid:** >700 lines (will timeout or fail)

### When Consolidation Makes Sense
Only consolidate tests that:
1. Are truly independent (no UI state sharing)
2. Total <500 lines combined
3. Have <15 tests total
4. Don't open dialogs/windows that accumulate state

### When to Keep Files Separate
Keep separate if:
1. >300 lines per file
2. >8 tests in the file
3. Tests manipulate app state significantly
4. Tests open multiple dialogs/windows

## Files Currently Safe to Consolidate

Based on analysis, these could be safely merged:
- `theme-settings.e2e.ts` (86 lines) + `ui-library.e2e.ts` (68 lines) = 154 lines ✅
  - Both are UI helper tests with minimal state mutation
  - Would create a ~200-line file with 5-6 tests

- `large-collections.e2e.ts` (169 lines) + `large-payloads.e2e.ts` (167 lines) = 336 lines ✅
  - Independent features (collections vs responses)
  - Would create a ~400-line file with 10-12 tests

- `environment-management.e2e.ts` (120 lines) + `variable-interpolation.e2e.ts` (107 lines) = 227 lines ✅
  - Related but independent test scenarios
  - Would create a ~270-line file with 8-10 tests

## Files NOT Safe to Consolidate

- `request-authoring.e2e.ts` (527 lines) - Already too large alone
- `request-cancellation.e2e.ts` (151 lines) - Should stay separate
- `request-network-errors.e2e.ts` (123 lines) - Should stay separate
- `multi-tab-edits.e2e.ts` (173 lines) - Should stay separate
- `scratch-collection.e2e.ts` (173 lines) - Should stay separate

Merging these 5 files created 1,400+ lines which is **3-5x too large** for a single WebDriver session.

## Pre-existing Test Issues Discovered

1. **theme-settings.e2e.ts** - Settings button not visible during test (timing issue)
2. **collections-management.e2e.ts** & **collections-flow.e2e.ts** - Pre-existing flakiness with collection creation
3. **OAuth tests** - Require environment variables (KNURL_E2E_OAUTH_ISSUER) to run

These issues exist independent of consolidation and should be fixed separately.

## Recommendations Going Forward

1. **Don't consolidate** request-related tests (too many, too large when combined)
2. **Carefully consolidate** small, independent test files (<100 lines each)
3. **Test consolidation impact** by running consolidated files individually FIRST
4. **Fix pre-existing failures** before attempting consolidation
5. **Monitor file sizes** - revert if consolidation creates files >500 lines
6. **Use smaller batches** - consolidate 2-3 related files, not 5 files at once

## Current State

All 21 original test files have been **restored**. The attempted consolidation was reverted.

### Test Baseline (Verified Working)
- `import-collection-merge.e2e.ts` - ✅ 4/4 tests passing (16.7s)
- All 21 files remain intact

The incremental improvements from the earlier polling optimization commit (05d8108c) are retained.

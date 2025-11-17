# E2E Test Consolidation Plan

**Date:** 2025-11-16
**Goal:** Consolidate 21 E2E test files into 5-7 feature-focused files to reduce setup overhead while maintaining test quality

## Current State

**Files to consolidate:** 21 individual test files
**File count after consolidation:** Target 5-7 files

## Consolidation Strategy

Group tests by feature area, not by test scope:

### Group 1: Settings & UI Customization
- theme-settings.e2e.ts (1 test) ✅ FIXED
- ui-library.e2e.ts (5 tests) ✅ FIXED
- **Consolidated file:** `settings-ui.e2e.ts`

### Group 2: Collections Management
- collections-management.e2e.ts (large)
- collections-flow.e2e.ts (large)
- collection-storage.e2e.ts (small)
- collection-encryption.e2e.ts (small)
- **Consolidated file:** `collections-core.e2e.ts`

### Group 3: Request Authoring & Editing
- request-authoring.e2e.ts (large, ~527 lines)
- multi-tab-edits.e2e.ts (medium)
- scratch-collection.e2e.ts (medium)
- **Consolidated file:** `request-authoring.e2e.ts` (keep as-is, already large)

### Group 4: Request Execution & Responses
- request-cancellation.e2e.ts (small)
- request-network-errors.e2e.ts (small, ~123 lines)
- response-analysis.e2e.ts (medium, partial pass)
- large-payloads.e2e.ts (medium, 7 tests) ✅ FIXED - now using mock server
- **Consolidated file:** `request-execution.e2e.ts`

### Group 5: Authentication & OAuth
- auth-strategies.e2e.ts (medium, ~306 lines)
- oauth-flows.e2e.ts (medium)
- oauth-ui-flows.e2e.ts (medium, ~185 lines)
- **Consolidated file:** `authentication.e2e.ts`

### Group 6: Data & Infrastructure
- environment-management.e2e.ts (medium, ~120 lines)
- variable-interpolation.e2e.ts (medium, ~107 lines)
- import-collection-merge.e2e.ts (stable, 4/4 passing) ✅ KEEP SEPARATE (already optimized)
- **Consolidated file:** `environments-variables.e2e.ts`

### Group 7: Performance (Keep Separate)
- large-collections.e2e.ts (medium, 8 tests) ✅ FIXED
- **Keep as-is:** Specialized performance tests, different characteristics

## Task Checklist

- [ ] Create settings-ui.e2e.ts (theme-settings + ui-library)
- [ ] Create collections-core.e2e.ts (4 collection files)
- [ ] Keep request-authoring.e2e.ts (already ~527 lines)
- [ ] Create request-execution.e2e.ts (4 request/response files)
- [ ] Create authentication.e2e.ts (3 auth files)
- [ ] Create environments-variables.e2e.ts (2 env files)
- [ ] Keep large-collections.e2e.ts (performance testing)
- [ ] Keep import-collection-merge.e2e.ts (stable, optimized)
- [ ] Remove original files after consolidation verified
- [ ] Run consolidated tests to verify all pass

## Expected Outcomes

**Before:** 21 separate test files = 21 WebDriver session initializations
**After:** 8 test files (7 consolidated + 2 kept) = 8 WebDriver session initializations

**Reduction:** ~62% fewer session initializations (~13 fewer)
**Test count:** Same 50+ tests, grouped into focused suites

## Known Risks

1. **response-analysis.e2e.ts** - 7/9 tests passing (pre-existing issue, not consolidation-related)
2. **Timeout behavior** - Tests run sequentially, longer total runtime but reduced overhead per file
3. **State carryover** - Nested describe blocks might affect test isolation (mitigated by UI-based state setup)

## Success Criteria

✅ All originally-passing tests still pass in consolidated form
✅ No new failures introduced by consolidation
✅ Total execution time reasonable (50-60s for full suite vs. current 40-50s)
✅ Clear organization by feature area
✅ No external network calls (httpbin.org removed)
✅ Pure E2E testing (no plumbing via browser.execute)

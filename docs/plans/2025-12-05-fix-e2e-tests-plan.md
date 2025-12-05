# E2E Test Fixes Plan - 2025-12-05

## Overview
23 failed E2E tests across 6 test files. Failures are grouped by type:
- **Dialog/Modal blocking issues** (tests 6-9): Modal overlay blocking clicks
- **Missing test IDs/elements** (tests 10-12, 18-20): Selectors not found
- **Error panel not appearing** (tests 13-16): Error handling UI not showing
- **Performance/metrics collection** (tests 1-5): Profiler metrics not captured
- **Collection persistence** (test 22): Collection not found after reload
- **Request creation flow** (test 23): Request element not found
- **Response viewer** (test 21): Placeholder display issue
- **Tab switching** (test 17): Tab switching state not preserved
- **Collection filtering** (test 3): Collection search failing

## Test Files Affected
1. `src-common/e2e/specs/performance.e2e.ts` (5 failures)
2. `src-common/e2e/specs/auth.e2e.ts` (4 failures)
3. `test/specs/requests.e2e.ts` (11 failures)
4. `test/specs/response-analysis.e2e.ts` (1 failure)
5. `src-common/e2e/specs/collection-storage.e2e.ts` (1 failure)
6. `src-common/e2e/specs/collections-flow.e2e.ts` (1 failure)

## Task Checklist

### Performance Tests (1-5)
- [ ] 1. performance.e2e.ts: "displays sidebar with 50+ collections without lag"
- [ ] 2. performance.e2e.ts: "handles rapid collection list scrolling with many items"
- [ ] 3. performance.e2e.ts: "filters large collection list efficiently"
- [ ] 4. performance.e2e.ts: "maintains UI responsiveness with concurrent operations"
- [ ] 5. performance.e2e.ts: "collects CollectionTree render metrics when sidebar loads"

### Auth Tests (6-9)
- [ ] 6. auth.e2e.ts: "request inherits Basic auth from collection" (modal blocking)
- [ ] 7. auth.e2e.ts: "request inherits Bearer auth from collection" (modal blocking)
- [ ] 8. auth.e2e.ts: "request inherits API Key auth from collection" (modal blocking)
- [ ] 9. auth.e2e.ts: "request inherits OAuth2 auth from collection" (modal blocking)

### Requests Tests (10-20)
- [ ] 10. requests.e2e.ts: "edits scratch request details" (missing selector)
- [ ] 11. requests.e2e.ts: "replaces variable placeholders in request" (missing selector)
- [ ] 12. requests.e2e.ts: "preserves request state across multiple edits" (missing selector)
- [ ] 13. requests.e2e.ts: "handles connection timeout gracefully" (error panel not showing)
- [ ] 14. requests.e2e.ts: "handles DNS resolution failure" (error panel not showing)
- [ ] 15. requests.e2e.ts: "handles malformed URL error" (error panel not showing)
- [ ] 16. requests.e2e.ts: "allows retrying a failed request" (error panel not showing)
- [ ] 17. requests.e2e.ts: "preserves unsaved edits when switching tabs" (tab state issue)
- [ ] 18. requests.e2e.ts: "allows editing body in different tabs independently" (missing tab)
- [ ] 19. requests.e2e.ts: "maintains header edits across tab switches" (missing tab)
- [ ] 20. requests.e2e.ts: "indicates unsaved changes with visual indicator" (missing tab)

### Response Viewer Test (21)
- [ ] 21. response-analysis.e2e.ts: "shows placeholder before any request is sent"

### Collection Tests (22-23)
- [ ] 22. collection-storage.e2e.ts: "creates a collection and verifies it persists after app reload"
- [ ] 23. collections-flow.e2e.ts: "creates a request through the collection menu and opens a tab"

## Investigation Strategy
1. Check each test file location (some are in `test/specs/` vs `src-common/e2e/specs/`)
2. Run individual tests with `--spec` and `--grep` flags
3. Determine if test is:
   - Broken due to UI changes → Fix test selectors/flow
   - Testing removed functionality → Remove test
   - Flaky → Add waits/retries
4. Commit fixes after each test or group of related tests

# E2E Test Investigation - Consolidation Feasibility

## Investigation Summary

Tested consolidating E2E test files to reduce setup overhead. Consolidated a settings.e2e.ts file (combining theme-settings.e2e.ts + ui-library.e2e.ts) and ran tests to observe actual behavior rather than speculate about constraints.

## Actual Observations

### Test Execution Times (Single Session)

- **app.e2e.ts** (1 test): ~2 seconds total
- **ui-library.e2e.ts** (5 tests): ~37 seconds total
- **theme-settings.e2e.ts** (1 test): ~18 seconds total
- **settings.e2e.ts (consolidated)** (6 tests): ~54 seconds total
- **response-analysis.e2e.ts** (9 tests): ~30 seconds total
- **environment-management.e2e.ts**: ~57 seconds (fails in setup)

### Test Results: Pre-existing Failures

Several tests have pre-existing failures unrelated to consolidation:

1. **theme-settings.e2e.ts** - FAILS
   - Error: Settings button not displayed after 5000ms
   - Fails in original file
   - Fails in consolidated file
   - **Conclusion:** Pre-existing test issue

2. **ui-library.e2e.ts** - MIXED (4/5 pass)
   - Error: Menu rename item not displayed after 15000ms
   - Fails in original file
   - Fails in consolidated file
   - **Conclusion:** Pre-existing test issue

3. **environment-management.e2e.ts** - FAILS
   - Error: Collection creation fails ("not found in index")
   - Pre-existing collection creation issue

4. **response-analysis.e2e.ts** - MIXED (7/9 pass)
   - Some tests pass, some fail
   - Pre-existing partial failure

### Consolidated File Behavior

**settings.e2e.ts (theme-settings + ui-library):**
- Total execution: ~54 seconds
- Tests: 6 total (4 passed, 2 failed)
- Failed tests are the same ones that fail in the original files
- No new failures introduced by consolidation
- No timeouts occurred

**Conclusion:** The consolidated file runs without timing out and exhibits the same test failures as the original files. Consolidation itself does not appear to introduce new problems.

## What We Don't Know

Based on actual observations, I cannot determine:

1. **Memory usage** - No profiling data collected
2. **WebDriver session resource limits** - Not measured
3. **Why certain tests fail** - Requires deeper investigation into test code/UI state
4. **Maximum consolidation size** - Only tested one small consolidation (6 tests)
5. **State pollution between tests** - Not clear if theme-settings failure causes ui-library failure or they're independent

## What We DO Know

1. Small consolidations (<10 tests, ~150 lines) work without timing out
2. Pre-existing test failures persist in consolidated files
3. The consolidated file executes in reasonable time (~54 seconds for 6 tests)
4. Multiple tests can run in a single WebDriver session without crashing

## Next Steps to Determine Consolidation Feasibility

To answer the real question (can we consolidate tests?), we would need to:

1. **Test larger consolidations** - Merge 3-5 files and measure execution time
2. **Profile memory usage** - Use OS tools to monitor memory during test runs
3. **Fix pre-existing failures** - Address the theme-settings and ui-library test issues
4. **Measure parallelization limits** - Test with multiple concurrent WebDriver sessions
5. **Test large file consolidation** - Try merging the request-*.e2e.ts files to see when timeouts occur

## Current State

All original test files remain in place. The test consolidation has been **reverted to a clean state** with no speculative conclusions about constraints that haven't been measured.

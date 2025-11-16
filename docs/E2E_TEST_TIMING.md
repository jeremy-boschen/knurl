# E2E Test Timing & Performance Guide

## Understanding Test Delays

When running E2E tests, you may notice delays after test completion. Here's where they occur:

### Timeline of Test Execution

1. **Tests run** → Console shows test progress
2. **Test completion messages** → Each test suite prints `✅ [Suite Name] tests completed`
3. **Coverage data collected** → Each test saves coverage data to individual files in `.nyc_output/`
4. **WebDriver.io completes** → `wdio` process exits after all tests finish
5. **Post-test process runs** → `scripts/aggregate-e2e-coverage.mjs` merges coverage and generates report
6. **Final report generated** → `✓ E2E coverage report generated in coverage/e2e/`

### What's Causing the Delays?

The delays you see after test completion are from the post-test coverage aggregation process:

```
[coverage] Found N coverage file(s) to aggregate
[coverage] Merging E2E coverage data...
[coverage] Generating E2E coverage report...
[coverage] ✓ E2E coverage report generated in coverage/e2e/
```

This is **expected and normal**. The coverage merge and report generation are one-time operations that run in a separate post-test process after all tests finish, keeping test hooks clean and focused on test execution.

## Optimizing Test Speed

### Option 1: Skip Coverage During Development

For faster test runs during development:

```bash
KNURL_SKIP_COVERAGE=1 yarn test:e2e
```

This eliminates the coverage merge and report generation step entirely.

### Option 2: Skip Coverage for Individual Test Suites

Run only specific test suites to reduce total execution time:

```bash
# Collections tests only
yarn test:e2e --suite collections

# Auth tests only
yarn test:e2e --suite auth

# Workspace tests only
yarn test:e2e --suite workspace

# Request tests only
yarn test:e2e --suite request
```

Available suites defined in `wdio.conf.ts`:
- `collections` - Collection CRUD and encryption tests
- `workspace` - Workspace and scratch collection tests
- `auth` - Authentication and OAuth tests
- `request` - Request authoring and response analysis tests

### Option 3: Run Individual Test Files

Run a single test file:

```bash
yarn test:e2e --spec="test/specs/collections-flow.e2e.ts"
```

## Reading Test Output

### Test Completion Markers

Each test suite now prints a completion message:

```
✅ Authentication Strategies tests completed
✅ Collection And Request Flow tests completed
✅ Collections Management UX tests completed
...
```

These messages indicate when each test suite has finished executing.

### Coverage Generation (After All Tests)

After all tests complete, the `after` hook runs:

```
[coverage] Merging E2E coverage data...
[coverage] Generating E2E coverage report...
[coverage] ✓ E2E coverage report generated in coverage/e2e/
```

This is a single operation that runs once after all tests, NOT per-test.

## Recommended Workflows

### For CI/CD (with coverage)
```bash
yarn test:e2e
# This runs all tests and generates coverage reports
```

### For Development (fast iterations)
```bash
KNURL_SKIP_COVERAGE=1 yarn test:e2e --suite collections
# Fast feedback loop without coverage overhead
```

### For Debugging (single test)
```bash
KNURL_SKIP_COVERAGE=1 yarn test:e2e --spec="test/specs/collections-flow.e2e.ts"
# Focus on specific test without coverage delays
```

## Performance Notes

- **Coverage collection** happens per-test in the `afterTest` hook (minimal overhead, ~50-100ms per test)
- **Coverage data storage** individual test files are saved to `.nyc_output/` with unique names
- **Coverage merge and aggregation** happens once in the post-test process (`scripts/aggregate-e2e-coverage.mjs`, takes ~1-2 seconds)
- **Report generation** occurs after merge is complete (takes ~1-2 seconds)
- **Total post-test delay** after WebDriver.io exits is primarily from coverage aggregation and report generation (~2-4 seconds)
- **Separation of concerns** test hooks focus on test execution; coverage aggregation runs as a separate post-test process
- **Skip coverage** with `KNURL_SKIP_COVERAGE=1` eliminates coverage collection and aggregation entirely

## Test Completion Messages

All E2E test suites now include completion console.log messages that are printed when the test suite finishes. This helps identify:

- When each test suite completes
- Whether delays are from test execution or teardown
- Which test is taking longer than expected

Example output:
```
✅ Authentication Strategies tests completed
✅ Collection And Request Flow tests completed
✅ Collections Management UX tests completed
✅ Collection Encryption & At-Rest Storage tests completed
✅ Collection Storage & Data Persistence tests completed
✅ Large Collections Performance tests completed
✅ Collection Merge Workflow tests completed
✅ Environment Manager Smoke tests completed
✅ Launch Hydration UX tests completed
✅ OAuth UI flows tests completed
✅ Request Authoring Smoke tests completed
✅ Request Authoring Advanced tests completed
✅ Response Viewer Analysis tests completed
✅ Scratch Collection UX tests completed
✅ Workspace Restore UX tests completed
✅ OAuth flows tests completed
✅ Tauri Backend Integration & Desktop Features tests completed
```

## Architecture

### Coverage Collection and Aggregation Process

**Per-Test Collection (wdio.conf.ts `afterTest` hook)**:
- Each test collects coverage from the browser using `window.__coverage__`
- Coverage data is saved to `.nyc_output/coverage-{timestamp}-{random}.json`
- Minimal overhead, happens during the test lifecycle

**Post-Test Aggregation (scripts/aggregate-e2e-coverage.mjs)**:
- Runs after all WebDriver.io tests complete
- Merges individual coverage files using `nyc merge`
- Generates HTML and JSON reports using `nyc report`
- Creates final reports in `coverage/e2e/`

This separation of concerns keeps test execution focused and clean, with coverage aggregation handled as a separate post-test process.

## Related Files

- `wdio.conf.ts` - Test configuration with `afterTest` hook for per-test coverage collection
- `scripts/aggregate-e2e-coverage.mjs` - Post-test script for coverage aggregation and report generation
- `package.json` - `test:e2e` script invokes `wdio run ./wdio.conf.ts; node scripts/aggregate-e2e-coverage.mjs`
- `test/specs/*.e2e.ts` - All test suites with completion console.log messages

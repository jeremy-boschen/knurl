# E2E Test Timing & Performance Guide

## Understanding Test Delays

When running E2E tests, you may notice delays after test completion. Here's where they occur:

### Timeline of Test Execution

1. **Tests run** → Console shows test progress
2. **Test completion messages** → Each test suite prints `✅ [Suite Name] tests completed`
3. **After hook runs** → Coverage collection and report generation (if enabled)
4. **Final report generated** → `✓ E2E coverage report generated in coverage/e2e/`

### What's Causing the Delays?

The delays you see in this section are from the `after` hook running AFTER all tests complete:

```
[0-0]
[0-0] [coverage] Merging E2E coverage data...
[0-0] [coverage] Generating E2E coverage report...
[0-0] [coverage] ✓ E2E coverage report generated in coverage/e2e/
```

This is **expected and normal**. The coverage merge and report generation are one-time operations that happen after all tests finish.

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

- **Coverage collection** happens per-test in the `afterTest` hook (minimal overhead)
- **Coverage merge and report generation** happens once in the `after` hook (takes ~1-2 seconds)
- **Total delay** after tests complete is primarily from coverage report generation
- **Skip coverage** with `KNURL_SKIP_COVERAGE=1` eliminates the after-test delay entirely

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

## Related Files

- `wdio.conf.ts` - Test configuration with `afterTest` and `after` hooks
- `test/specs/*.e2e.ts` - All test suites with completion messages

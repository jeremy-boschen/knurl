# Test Coverage Guide

Comprehensive guide for running tests with coverage across four test suites.

## Overview

Knurl generates coverage from four distinct test layers:

1. **Frontend Unit Tests** (Vitest) → `coverage-final.json`
2. **Frontend E2E Tests** (WebDriver.io) → `e2e-coverage.json`
3. **Rust Unit Tests** (cargo llvm-cov) → `rust-coverage.json`
4. **Rust E2E Tests** (instrumented binary) → `rust-e2e-coverage.json`

All sources are intelligently merged using `Math.max()` per execution count, producing a unified coverage report.

## Quick Start

Run all tests with consolidated coverage:

```bash
yarn test
```

This produces:
- **HTML report**: `coverage/index.html` (open in browser for detailed analysis)
- **LCOV report**: `coverage/lcov.info` (for CI/CD integration)
- **JSON report**: `coverage/coverage-final.json` (for programmatic access)
- **Console output**: Text-based summary with line/branch/function coverage

## Running Tests

### Full Test Suite (All Coverage)
```bash
yarn test
```
Runs unit tests (Vitest + cargo) + E2E tests + merge coverage from all sources.

### Unit Tests Only
```bash
yarn test:unit
```
Frontend (Vitest) + Rust (cargo llvm-cov) unit tests.

### E2E Tests Only
```bash
yarn test:e2e
```
Builds instrumented Rust binary, runs WebDriver.io, generates E2E coverage.

### Specific E2E Test
```bash
yarn test:e2e --spec="path/to/test.e2e.ts"
```

### Quick Critical Tests
```bash
yarn test:check
```
Unit tests + E2E tests marked `[CRITICAL]` (faster feedback loop).

## Coverage Files Generated

| File | Test Suite | Format | Merge Strategy |
|------|-----------|--------|-----------------|
| `coverage-final.json` | Frontend unit | Istanbul | Added first |
| `e2e-coverage.json` | Frontend E2E | Istanbul | Smart merge (max count) |
| `rust-coverage.json` | Rust unit | Istanbul | Smart merge (max count) |
| `rust-e2e-coverage.json` | Rust E2E | Istanbul | Smart merge (max count) |

**LCOV files** (intermediate, not merged into JSON):
- `rust-lcov.info` - Rust unit (raw output)
- `rust-lcov-e2e.info` - Rust E2E (raw output)

## Merge Strategy

The merge script (`scripts/test/merge-coverage.mjs`) combines all four sources:

1. Load frontend unit coverage
2. **Merge** frontend E2E (takes max execution count per item)
3. **Merge** Rust unit
4. **Merge** Rust E2E

For overlapping files/functions/branches, uses `Math.max()` to determine if code was exercised by ANY test suite.

## Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Statements | 70% |
| Functions | 70% |
| Branches | 65% |

Enforced on pre-push (see `.lefthook.yml`).

### Excluded from Coverage

- Test files (`**/*.test.*`, `**/*.spec.*`)
- Test utilities (`src/test/`)
- shadcn UI components (`src/components/ui/`)
- Generated code
- Test stories

## Understanding Reports

### HTML Report

The most comprehensive report. Open `coverage/index.html` in your browser to:
- View overall coverage metrics
- Navigate by file/directory
- See line-by-line coverage (red = uncovered, green = covered, yellow = partial)
- Analyze branches and functions

### Terminal Summary

`yarn test` outputs a summary table with:
- **Statements**: Code statements covered
- **Branches**: Conditional branches covered
- **Functions**: Function definitions covered
- **Lines**: Individual lines covered

Example:
```
=============================== Coverage summary ===============================
Statements   : 72.5% ( 290/400 )
Branches     : 68.2% ( 150/220 )
Functions    : 71.8% ( 95/132 )
Lines        : 73.1% ( 305/417 )
================================================================================
```

## CI/CD Integration

Coverage reports can be uploaded to services like Codecov:

```bash
# In CI pipeline
yarn test
yarn codecov --file=coverage/lcov.info
```

## Rust E2E Coverage Details

When running `yarn test` or `yarn test:e2e`:

1. **Build step**: `cargo llvm-cov build --no-report` with instrumentation
2. **Test step**: E2E tests run against instrumented Rust binary
3. **Coverage generation**: `cargo llvm-cov report --lcov` captures profiling data
4. **Conversion**: LCOV → Istanbul JSON for merge

This provides realistic backend coverage under actual usage patterns, not just unit test scenarios.

## Troubleshooting

### "Coverage below thresholds"
1. Run `yarn test`
2. Open `coverage/index.html`
3. Look for uncovered files/branches
4. Add tests or adjust thresholds in `scripts/test/check-coverage.js`

### E2E Rust coverage not generated
- Ensure `cargo-llvm-cov` installed: `cargo install cargo-llvm-cov`
- Check E2E tests actually exercised Rust backend (not mocked)
- Verify `coverage/rust-lcov-e2e.info` has reasonable size

### Lower coverage than expected
- Ensure all test modes ran (check for all 4 JSON files in `coverage/`)
- Review merge-coverage.mjs console output for warnings
- Check that no test suites failed silently

## Tips

- Run `yarn test` before submitting PRs (ensures full coverage across all layers)
- Use HTML report to identify untested code paths
- E2E tests supplement unit tests; focus on user-visible behavior
- Rust unit tests validate logic; Rust E2E validates integration with frontend

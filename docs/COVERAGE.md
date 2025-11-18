# Test Coverage Guide

This document explains how to run tests with coverage reports and consolidate coverage from unit and E2E tests.

## Overview

The project now includes a comprehensive test coverage script that:
1. Runs frontend unit tests with coverage (Vitest)
2. Runs backend unit tests (Cargo)
3. Merges frontend and backend coverage reports
4. Runs E2E tests with coverage (WebDriver.io)
5. Aggregates E2E coverage
6. Consolidates all coverage with nyc
7. Generates HTML, LCOV, JSON, and text reports

## Quick Start

Run all tests with consolidated coverage:

```bash
yarn test:coverage
```

This produces:
- **HTML report**: `coverage/index.html` (open in browser for detailed analysis)
- **LCOV report**: `coverage/lcov.info` (for CI/CD integration)
- **JSON report**: `coverage/coverage-final.json` (for programmatic access)
- **Console output**: Text-based summary with line/branch/function coverage

## Individual Test Runs

Run tests separately with their individual coverage:

```bash
# Frontend unit tests only
yarn test:unit

# E2E tests only
yarn test:e2e

# E2E report
yarn test:e2e:report
```

## Coverage Configuration

Coverage settings are defined in:
- **Frontend**: `vitest.config.ts` (Vitest v8 coverage)
- **Backend**: `src-tauri/src/` (inline unit tests)
- **Consolidation**: `.nycrc` (nyc configuration)

### Current Thresholds

Lines, statements, and functions: **70%**
Branches: **65%**

These are enforced on pre-push hooks (see `.lefthook.yml`).

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

`yarn test:coverage` outputs a summary table with:
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
yarn test:coverage
yarn codecov --file=coverage/lcov.info
```

## Tips

- Run `yarn test:coverage` before submitting PRs to check coverage
- Use HTML report to identify untested code paths
- E2E tests supplement unit tests; focus on user-visible behavior
- Backend tests validate logic not exposed through UI

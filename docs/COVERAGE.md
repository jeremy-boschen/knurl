# Coverage Reporting

This document explains how to collect and view code coverage for Knurl's tests (unit, E2E, and combined).

## Quick Start

### E2E Test Coverage (Automatic)
```bash
yarn test:e2e
# Automatically collects and reports coverage in coverage/e2e/index.html
```

### Frontend Unit Test Coverage
```bash
yarn coverage:generate
# Reports: coverage/index.html
```

### Combined Coverage (Unit + E2E)
```bash
yarn coverage:generate && yarn test:e2e && yarn coverage:merge
# Generates combined report in coverage/index.html
```

## Coverage Scripts

All coverage commands are defined in `package.json`:

| Command | What It Does |
|---------|-------------|
| `yarn test:e2e` | Runs E2E tests with automatic coverage collection (Istanbul instrumentation) |
| `yarn coverage:generate` | Runs unit tests with coverage collection (v8 coverage) |
| `yarn coverage:merge` | Merges unit + E2E coverage into single report |
| `yarn coverage:check` | Validates coverage meets thresholds |

## How It Works

### Frontend Unit Tests (Vitest + V8)
- **Tool:** Vitest + @vitest/coverage-v8
- **Activation:** `VITEST_COVERAGE=true`
- **Output:** `coverage/coverage-final.json`
- **Report:** `coverage/index.html`

### E2E Tests (WebDriver.io + Istanbul)
- **Tool:** Istanbul instrumentation via `vite-plugin-istanbul`
- **Config:** `vite.config.e2e.ts` (always used for E2E tests)
- **Activation:** Automatic (no environment variables needed)
- **Collection:** Browser's `window.__coverage__` is extracted after each test
- **Output:** `.nyc_output/*.json` (multiple files merged)
- **Report:** `coverage/e2e/index.html` (automatically generated)

### Merged Coverage
- **Tool:** Istanbul (nyc)
- **Merges:** Unit coverage + E2E coverage
- **Output:** `coverage/coverage-final.json` (merged)
- **Report:** `coverage/index.html`

## Understanding Coverage Reports

### HTML Report
```bash
# Open any of:
open coverage/index.html          # Unit test coverage
open coverage/e2e/index.html      # E2E coverage
open coverage/index.html          # Merged coverage (after merge)
```

Click on files to see which lines are:
- **Green:** Covered by tests
- **Red:** Not covered by tests
- **Yellow:** Partially covered (branches)

### Text Report
```bash
# Unit test coverage
yarn coverage:generate --reporter=text

# E2E coverage
yarn test:e2e:coverage 2>&1 | grep -A 20 "Coverage report"

# Combined
yarn coverage:e2e:all 2>&1 | tail -20
```

### LCOV Report
Used by CI/CD systems and tools like:
- Codecov
- Coveralls
- SonarQube

Location: `coverage/lcov.info` (after merge)

## Typical Workflow

### Before Merging a PR
```bash
# 1. Run E2E tests (coverage is collected automatically)
yarn test:e2e

# 2. Generate unit test coverage
yarn coverage:generate

# 3. Combine unit + E2E coverage
yarn coverage:merge

# Check if coverage is sufficient
yarn coverage:check
```

### In CI/CD
```bash
# Full coverage pipeline
yarn coverage:generate && yarn test:e2e && yarn coverage:merge && yarn coverage:check
```

## Configuration

### Unit Test Coverage (Vitest)
See: `.nycrc` (if present) or vitest config in `vite.config.ts`

### E2E Coverage (Istanbul)
See: `vite.config.e2e.ts`
```typescript
istanbul({
  include: 'src/**/*.{js,ts,tsx}',
  exclude: ['node_modules', 'test/', '**/*.test.*', '**/*.spec.*'],
  requireEnv: false,
  forceBuildInstrument: true,
})
```
This is automatically used whenever E2E tests run (no configuration needed).

### WebDriver.io Collection
See: `wdio.conf.ts`
```typescript
afterTest: async function(test) {
  // Always collects window.__coverage__ after each test
}

after: async function() {
  // Always merges .nyc_output files into coverage/e2e-coverage.json
  // Always generates HTML report in coverage/e2e/
}
```

### Coverage Merge
See: `scripts/merge-coverage.mjs`
```bash
# Merges:
# 1. coverage/coverage-final.json (unit tests)
# 2. coverage/e2e-coverage.json (E2E tests)
# Into single report in coverage/
```

## Coverage Thresholds

Thresholds are configured in `.nycrc` or package.json. Adjust if needed:

```json
{
  "nyc": {
    "lines": 80,
    "functions": 80,
    "branches": 75,
    "statements": 80
  }
}
```

Check threshold values:
```bash
yarn coverage:check
```

## Troubleshooting

### Coverage data isn't being collected
```bash
# Check .nyc_output directory exists after tests
ls -la .nyc_output/

# If empty, E2E tests may have failed
# Check test output for errors

# Check coverage directory permissions
chmod -R 755 coverage/ .nyc_output/
```

### Coverage report shows 0%
1. Verify Istanbul plugin is instrumented: Look for log messages during Vite startup
2. Check test actually ran: Look for test output logs
3. Verify `window.__coverage__` is accessible: Check browser console
4. Check WebDriver.io console for coverage collection errors

### "No coverage files found to merge"
```bash
# Generate unit coverage first
yarn coverage:generate

# Then run E2E tests (coverage is automatic)
yarn test:e2e

# Then merge
yarn coverage:merge
```

### Merge fails with permission errors
```bash
# Clear old coverage data
rm -rf coverage/ .nyc_output/

# Regenerate from scratch
yarn coverage:generate
yarn test:e2e
yarn coverage:merge
```

## Performance Impact

### Unit Tests
- **Impact:** Minimal (~2-5% slower with coverage)
- **Overhead:** Low (in-process instrumentation)

### E2E Tests
- **Impact:** Moderate (~10-15% slower with Istanbul)
- **Overhead:** Browser-side instrumentation
- **Workaround:** Only enable when needed (`E2E_COVERAGE=1`)

## Performance & Parallelization

### Unit Tests (Vitest)
Unit tests run in **chunks** (groups of test files). Each chunk runs with internal parallelization. To achieve actual parallelism:

```bash
# Default: runs sequentially (1 test file at a time, 1 worker)
VITEST_MAX_WORKERS=1 VITEST_CHUNK_SIZE=1 yarn coverage:generate

# Better: run 10 test files together with 4 parallel workers per chunk
VITEST_CHUNK_SIZE=10 VITEST_MAX_WORKERS=4 yarn coverage:generate

# Recommended for faster runs (8-core CPU)
VITEST_CHUNK_SIZE=20 VITEST_MAX_WORKERS=8 yarn coverage:generate

# Maximum parallelization (16-core CPU)
VITEST_CHUNK_SIZE=50 VITEST_MAX_WORKERS=16 yarn coverage:generate
```

**Key Settings:**
- `VITEST_CHUNK_SIZE`: Number of test files per chunk (default: 1, increase for parallelization)
- `VITEST_MAX_WORKERS`: Parallel workers within each chunk (default: 1, increase to use multiple cores)

### E2E Tests (WebDriver.io + Tauri)
E2E tests **cannot be parallelized** due to Tauri limitations:
- Only one instance of a desktop app can run at a time
- Multiple browser instances can't connect to the same app instance
- `maxInstances: 1` in `wdio.conf.ts` is a hard requirement

E2E tests are sequential and cannot be made parallel without significant architectural changes.

## Best Practices

1. **Run unit tests with proper parallelization**
   ```bash
   # Significantly faster on multi-core CPUs (must use both settings!)
   VITEST_CHUNK_SIZE=20 VITEST_MAX_WORKERS=8 yarn coverage:generate
   ```

2. **Run E2E tests sequentially (only option)**
   ```bash
   # No parallelization possible
   yarn test:e2e
   ```

3. **Check thresholds in CI**
   ```bash
   # In CI pipeline
   yarn coverage:generate && yarn test:e2e && yarn coverage:merge && yarn coverage:check
   ```

3. **Combine unit + E2E for full picture**
   - Unit tests: Great for isolated logic
   - E2E tests: Great for integration workflows
   - Combined: Shows true application coverage

4. **Ignore generated/non-testable code**
   - Exclude files: See Istanbul config
   - Mock external libraries: See test setup

5. **Focus on critical paths**
   - 80%+ coverage on business logic
   - 100% coverage on auth/security code
   - E2E tests for user workflows

## Further Reading

- [Istanbul Documentation](https://istanbul.js.org/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
- [WebDriver.io](https://webdriver.io/)
- [nyc Command Line](https://github.com/istanbuljs/nyc#command-line-options)

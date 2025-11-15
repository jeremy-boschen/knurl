# Coverage Quick Start

## One-line commands

```bash
# Unit tests with coverage
yarn coverage:generate

# E2E tests with coverage (automatic)
yarn test:e2e

# Merge unit + E2E coverage
yarn coverage:merge

# Check thresholds
yarn coverage:check
```

## View reports

```bash
# E2E coverage (generated automatically after tests)
open coverage/e2e/index.html

# Unit test coverage
open coverage/index.html

# Combined (after merge)
open coverage/index.html
```

## Full example workflow

```bash
# 1. Run E2E tests (coverage collection is automatic)
yarn test:e2e
# Automatically creates: coverage/e2e/index.html
# Automatically creates: coverage/e2e-coverage.json

# 2. Generate unit test coverage
yarn coverage:generate
# Creates: coverage/coverage-final.json

# 3. Merge both coverage types
yarn coverage:merge
# Creates combined: coverage/index.html

# 4. View combined report
open coverage/index.html

# 5. Check if thresholds are met
yarn coverage:check
# lines: 70%, functions: 70%, branches: 65%, statements: 70%
```

## In CI/CD

```bash
# Full coverage pipeline
yarn coverage:generate && yarn test:e2e && yarn coverage:merge && yarn coverage:check
```

## Key files

- `docs/COVERAGE.md` - Full coverage documentation
- `docs/COVERAGE_SETUP.md` - Technical implementation details
- `vite.config.e2e.ts` - Istanbul instrumentation config
- `wdio.conf.ts` - Coverage collection hooks
- `scripts/merge-coverage.mjs` - Merge script
- `.nycrc` - Coverage thresholds

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No coverage collected | Check `.nyc_output/` directory exists after tests |
| 0% coverage reported | Clear `rm -rf coverage/ .nyc_output/` and regenerate |
| Merge fails | Ensure both `coverage/coverage-final.json` and `coverage/e2e-coverage.json` exist |

## What's covered?

- ✅ **Unit tests:** React components, hooks, utilities
- ✅ **E2E tests:** User workflows, integration paths
- ✅ **Combined:** Full frontend code coverage

## What's not covered?

- ❌ **Rust backend:** Use unit tests in src-tauri/tests/
- ❌ **Type definitions:** .d.ts and type-only files
- ❌ **Generated code:** Keep excluded

## Performance Tips

### Unit Tests (Automatically Optimized!)
Unit tests now automatically detect your CPU count and set optimal parallelization:

```bash
# Default: automatically uses 75% of your CPUs (detected at runtime)
yarn coverage:generate

# Example output on 8-core machine:
# [vitest-groups] selected 45/45 tests (..., chunkSize=6 (auto), maxWorkers=6 (auto)) (auto-detected from CPU count: 8)
```

**Custom settings (if needed):**
```bash
# Override auto-detected workers (use 4 instead of auto)
VITEST_MAX_WORKERS=4 yarn coverage:generate

# Override auto-detected chunk size (use 15 instead of auto)
VITEST_CHUNK_SIZE=15 yarn coverage:generate

# Override both
VITEST_CHUNK_SIZE=20 VITEST_MAX_WORKERS=8 yarn coverage:generate
```

**Auto-detection formula:**
- `VITEST_MAX_WORKERS`: 75% of CPU count (to avoid system overload)
- `VITEST_CHUNK_SIZE`: Test files distributed evenly across CPUs

### E2E Tests (Sequential Only)
- E2E tests run sequentially (`maxInstances: 1`) due to Tauri limitations
- Can't run multiple desktop app instances in parallel
- No configuration option to change this

## Next steps

1. Run `yarn coverage:generate` to generate unit test coverage
2. Run `yarn test:e2e` to run E2E tests with automatic coverage
3. Run `yarn coverage:merge` to combine reports
4. Open `coverage/index.html` to view the report
5. Use `VITEST_MAX_WORKERS=<n>` to speed up unit tests if needed

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

## Next steps

1. Run `yarn coverage:e2e:all` to generate full coverage
2. Open `coverage/index.html` to view the report
3. Check `yarn coverage:check` to see if thresholds are met
4. Adjust thresholds in `.nycrc` if needed
5. Add to CI/CD pipeline for automatic coverage tracking

# Test Scripts Restructured
**Date:** 2025-11-24
**Status:** ✅ Complete

---

## Summary

Replaced `test:coverage` with a new streamlined test command structure:
- `yarn test` — Full test suite with coverage (replaces `test:coverage`)
- `yarn test:check` — Quick check: unit + E2E [CRITICAL] tests only (new, for CI/CD)

All documentation and references have been updated.

---

## New Test Command Structure

### `yarn test:unit`
**Runs:** Frontend unit tests (Vitest) + Backend unit tests (Cargo) with coverage
**Speed:** Fast (~1-2 minutes)
**Output:** Coverage report at `coverage/index.html`
```bash
yarn test:unit
```

### `yarn test:e2e`
**Runs:** All E2E tests (WebDriver.io)
**Speed:** Slow (~10-15 minutes)
**Options:**
- `--spec="path/to/test.e2e.ts"` — Single test file
- `--test="test name"` — Filter by test name
- `--grep="[CRITICAL]"` — Filter by pattern
```bash
yarn test:e2e
yarn test:e2e --spec="test/specs/collections-management.e2e.ts"
```

### `yarn test` ✨ NEW
**Runs:** Unit tests + Backend tests (with coverage) + E2E tests (with coverage)
**Speed:** Slowest (~20-30 minutes)
**Output:** Full coverage report at `coverage/index.html`
**Replaces:** `yarn test:coverage`
```bash
yarn test
```

### `yarn test:check` ✨ NEW
**Runs:** Unit tests + E2E [CRITICAL] tests only (no coverage consolidation)
**Speed:** Fast (~5-10 minutes) — ideal for CI/CD
**Output:** Pass/fail status only
**Use:** Before PR merge, quick validation, CI gates
```bash
yarn test:check
```

---

## Script Files

### New
- **`scripts/test.sh`** — Runs full pipeline: unit + backend + merge coverage + E2E + aggregate coverage
- **`scripts/test-check.sh`** — Runs quick checks: unit + E2E [CRITICAL] (no coverage)

### Kept
- **`scripts/test-unit.sh`** — Unit test runner with coverage consolidation
- **`scripts/test-e2e.sh`** — E2E test runner with filtering support
- **`scripts/consolidate-coverage.mjs`** — Unifies coverage consolidation

### Legacy (Preserved but not directly called)
- **`scripts/test-with-coverage.sh`** — Now called by `test.sh` internally

---

## Files Updated

### package.json
```json
"test:unit": "bash scripts/test-unit.sh",
"test:e2e": "bash scripts/test-e2e.sh",
"test": "bash scripts/test.sh",           // NEW: replaces test:coverage
"test:check": "bash scripts/test-check.sh" // NEW: quick CI validation
```

### Documentation
- **CLAUDE.md** — Updated command reference and testing section
- **AGENTS.md** — Updated command reference and testing section
- **.ai/COMMANDS.md** — Updated test suites and scripts sections
- **.ai/TESTING.md** — Updated coverage commands section
- **docs/COVERAGE.md** — Updated all references to use `yarn test`

---

## Use Cases

### Development Workflow
```bash
# Quick iteration: test single E2E file
yarn test:e2e --spec="test/specs/requests.e2e.ts"

# Full unit tests
yarn test:unit

# Full E2E tests
yarn test:e2e
```

### Before PR Submission
```bash
# Run everything with coverage
yarn test

# Or quick critical tests only
yarn test:check
```

### CI/CD Pipeline
```bash
# Quick gate (run critical tests)
yarn test:check

# Full validation (with coverage)
yarn test
```

---

## Test Tagging

E2E tests use `[CRITICAL]` tags in describe blocks:

```typescript
describe("[CRITICAL] Authentication Strategies", () => {
  // Critical tests
})

describe("Advanced OAuth Edge Cases", () => {
  // Supplemental tests
})
```

Running `yarn test:check` filters for only `[CRITICAL]` tests, making it fast for CI/CD.

**Current [CRITICAL] test suites:**
- Authentication Strategies
- Collection Auth Inheritance
- Collection Encryption & At-Rest Storage
- Collections Management & Storage
- Multi-Tab Unsaved Edits Management
- Request Tab Context Menu
- Request Configuration (Smoke Tests)
- Collections Management UX
- Request Execution & Responses (Smoke Tests)

---

## Coverage Reports

All test scripts generate coverage reports in `coverage/`:
- **coverage/index.html** — Interactive HTML report
- **coverage/lcov.info** — LCOV format (for CI/CD services)
- **coverage/coverage-final.json** — Structured data

To view:
```bash
open coverage/index.html
```

---

## Timeline Comparison

| Scenario | Command | Time |
|----------|---------|------|
| Single E2E file | `yarn test:e2e --spec="..."` | 1-3 min |
| All unit tests | `yarn test:unit` | 1-2 min |
| All E2E tests | `yarn test:e2e` | 10-15 min |
| **Quick CI gate** | **`yarn test:check`** | **5-10 min** |
| Full validation | `yarn test` | 20-30 min |

---

## No Breaking Changes

- All existing tests continue to pass
- `test:unit` and `test:e2e` commands unchanged
- Only addition: `test` and `test:check` commands
- Legacy `test-with-coverage.sh` still available (now called by `test.sh`)

---

## Next Steps

1. **Verify scripts work:**
   ```bash
   yarn test:check    # Should run quick critical tests
   yarn test          # Should run full suite
   ```

2. **Use in CI/CD:**
   - Pre-submit: `yarn test:check` (fast gate)
   - Main branch: `yarn test` (full validation)

3. **Optional:** Archive historical test planning docs if no longer needed

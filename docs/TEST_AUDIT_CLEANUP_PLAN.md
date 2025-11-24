# Test Audit: Cleanup Plan
**Date:** 2025-11-24
**Objective:** Remove integration tests and consolidate/clean up test infrastructure, keeping only unit and E2E tests

---

## SUMMARY OF FINDINGS

### Current State
- **Unit Tests:** 107 frontend tests + 13 Rust test modules (inline + integration)
- **E2E Tests:** 19 main + 6 integration tests
- **Test Scripts:** 12 shell/node scripts with overlap and POC utilities
- **Support Utilities:** 6 test helper modules (1,448+ LOC in test/support/)
- **Documentation:** 2 primary guides + 30+ planning documents

### Post-Cleanup Target
- **Unit Tests:** 107 frontend + 13 Rust tests (no change)
- **E2E Tests:** 19 main tests only (remove 6 integration)
- **Test Scripts:** 4-5 consolidated scripts (from 12)
- **Support Utilities:** 4 files instead of 6 (remove bridge/state helpers)
- **Documentation:** Updated to remove integration test references

---

## FILES FOR DELETION

### 1. Integration Test Files (1,121 LOC total) ❌ DELETE
**Location:** `/test/specs/integration/`

- `launch-hydration.e2e.ts` (111 lines)
- `tauri-integration.e2e.ts` (335 lines)
- `workspace-restore.e2e.ts` (264 lines)
- `request-lifecycle/auth-injection.e2e.ts` (219 lines)
- `request-lifecycle/environment-resolution.e2e.ts` (52 lines)
- `request-lifecycle/preparation.e2e.ts` (140 lines)
- `README.md` (integration test docs)

**Rationale:** User explicitly requested removal of integration tests; focus on unit + E2E only.

---

### 2. Bridge Replacement Module ❌ DELETE
**File:** `test/support/bridge-replacement.ts` (392 lines)

**Purpose:** Transitional helper for integration tests using `__vite_ssr_modules__` to access internal state
**Usage:** Only in integration test files
**Rationale:** Without integration tests, this module is not needed. E2E tests follow the golden rule (UI only).

---

### 3. State Helpers Module ❌ DELETE
**File:** `test/support/state.ts` (165 lines)

**Purpose:** Integration-only helpers (`resetCollectionsState`, `seedCollectionWithOpenRequest`)
**Usage:** Only in integration test files
**Rationale:** These violate E2E golden rule (direct app state access via `__vite_ssr_modules__`).

---

### 4. Filesystem Helpers Module ❌ DELETE
**File:** `test/support/filesystem.ts` (154 lines)

**Purpose:** Provides filesystem access for E2E tests (reading/writing app data directory)
**Current Usage:** Only used by `bridge-replacement.ts` (integration tests only)
**Rationale:** Without integration tests, this is orphaned. Regular E2E tests don't need filesystem access.

**Note:** If future E2E tests need to verify persisted data on disk, consider moving relevant functions to a new, properly scoped utility.

---

### 5. Experimental/POC Test Scripts ❌ DELETE
**Location:** `scripts/`

- `run-e2e-suites.mjs` (120 lines) - Legacy suite orchestrator
- `parse-e2e-results.py` (5.6 KB) - Abandoned result parser
- `monitor-test-resources.sh` (70 lines) - Resource monitoring POC
- `run-test-with-monitoring.sh` (57 lines) - Test + monitoring wrapper

**Rationale:**
- `run-e2e-suites.mjs`: Superseded by `test-e2e.sh` with `--spec`, `--test` support
- `parse-e2e-results.py`: Python script for a POC; wdio reporter handles output
- `monitor-test-resources.sh` & `run-test-with-monitoring.sh`: Experimental resource tracking, not integrated into CI/CD

---

### 6. Documentation Files to Remove/Update ❌ PARTIAL DELETE

#### Files to Delete Entirely:
- `test/specs/integration/README.md` - Covers only integration tests

#### Files to Update (Remove integration sections):
- `CLAUDE.md` - Remove integration test approval criteria section (lines 145-290+)
- `test/support/E2E_GUIDELINES.md` - No changes needed (already E2E-focused)

---

## FILES TO CONSOLIDATE OR SIMPLIFY

### 1. Test Runner Scripts (Consider Consolidation) ⚙️
**Current:** 3 separate scripts for unit/E2E/coverage

| Script | Purpose | Used By | Notes |
|--------|---------|---------|-------|
| `test-unit.sh` | Run frontend + backend unit tests | `yarn test:unit` | Clean, kept as-is |
| `test-e2e.sh` | Run E2E tests with filters | `yarn test:e2e` | Good feature set, kept as-is |
| `test-with-coverage.sh` | Full pipeline: unit + backend + E2E + consolidation | `yarn test:coverage` | Comprehensive, kept as-is |
| `test-e2e-report.sh` | Timestamped E2E report + prompt for re-run | `yarn test:e2e:report` | Niche use case; consider removing or integrating into `test-e2e.sh` |

**Recommendation:**
- **Keep:** `test-unit.sh`, `test-e2e.sh`, `test-with-coverage.sh`
- **Consider removing:** `test-e2e-report.sh` (rarely used; `test-e2e.sh` already captures output)

---

### 2. Coverage Aggregation Scripts ⚙️
**Current:** 3 scripts for merging/checking coverage

| Script | Purpose | Lines | Used By |
|--------|---------|-------|---------|
| `merge-coverage.mjs` | Merge frontend + backend unit coverage | 2.3 KB | `test-unit.sh`, `test-with-coverage.sh` |
| `aggregate-e2e-coverage.mjs` | Aggregate E2E coverage from wdio | 2.8 KB | `test-e2e.sh` (with `--coverage`) |
| `check-coverage.js` | Validate coverage against thresholds | 2.4 KB | `test-unit.sh`, `test-with-coverage.sh` |

**Recommendation:**
- **Keep all three.** They handle different coverage layers (unit, E2E, aggregation).
- Alternatively: Consider single `consolidate-coverage.mjs` that calls these internally, but current separation is cleaner.

---

### 3. Test Support Utilities ⚙️
**Keep (actively used in E2E tests):**
- `test/support/ui.ts` (1,000+ lines) - Primary E2E interaction library; heavily used ✅
- `test/support/events.ts` (79 lines) - Event waiting helpers used in `event-system.e2e.ts` ✅

**Delete (integration-only):**
- `test/support/bridge-replacement.ts` ❌
- `test/support/state.ts` ❌
- `test/support/filesystem.ts` ❌

---

## CLEANUP CHECKLIST

### Phase 1: Delete Integration Tests & Related Code
- [ ] Delete `/test/specs/integration/` directory (6 test files + README)
- [ ] Delete `test/support/bridge-replacement.ts`
- [ ] Delete `test/support/state.ts`
- [ ] Delete `test/support/filesystem.ts`
- [ ] Delete scripts:
  - [ ] `scripts/run-e2e-suites.mjs`
  - [ ] `scripts/parse-e2e-results.py`
  - [ ] `scripts/monitor-test-resources.sh`
  - [ ] `scripts/run-test-with-monitoring.sh`

**Total deletions:** ~3 KB of code, ~70 KB of test code

---

### Phase 2: Update Documentation
- [ ] Update `CLAUDE.md`:
  - [ ] Remove integration test approval criteria section (lines 145-290+)
  - [ ] Update E2E testing section to remove integration test references
  - [ ] Update test patterns section
- [ ] Delete `test/specs/integration/README.md`
- [ ] Update `.ai/COMMANDS.md` (remove references to `run-e2e-suites.mjs`, `parse-e2e-results.py`)

---

### Phase 3: Optional Script Cleanup
- [ ] **Consider removing:** `scripts/test-e2e-report.sh` (niche use; functionality overlaps with `test-e2e.sh`)

---

## Impact Analysis

### What Changes
- **Total test count:** 25 → 19 E2E tests (6 removed)
- **Test execution time:** Slightly faster (fewer E2E tests)
- **CI/CD:** No impact if integration tests weren't running
- **User intent:** Aligns with "focus on unit + E2E only"

### What Stays the Same
- **Unit tests:** All 107 frontend + 13 Rust tests remain ✅
- **E2E tests:** 19 comprehensive tests cover UI flows ✅
- **Test infrastructure:** Vitest, WebDriver.io, coverage reporting ✅
- **E2E patterns:** Golden rule (UI-only testing) reinforced ✅

### Non-Breaking Changes
- Test scripts reference only deleted files internally; no external code depends on them
- `bridge-replacement`, `state.ts`, `filesystem.ts` are test-only; no prod code uses them
- Integration test docs are self-contained; no cross-references elsewhere

---

## Files Modified (Not Deleted)

### `CLAUDE.md`
**Sections to remove:**
- Lines 145-155: Integration test references in test patterns
- Lines 240-290+: Entire "Integration Test Approval Criteria" section

**Sections to update:**
- Testing patterns subsection: Remove integration test description
- Keep: Unit and E2E test descriptions

---

## Recommendation

**Proceed with all Phase 1 & 2 deletions.** This is a clean break:
- Removes ~1,200 lines of integration test code
- Eliminates bridge-pattern code (violates E2E golden rule)
- Consolidates focus on working, maintainable unit + E2E tests
- Aligns with user request to "cleanup POCs and focus on working tests"

**Phase 3 (remove test-e2e-report.sh):** Optional; keep if occasionally useful for debugging.

---

## Post-Cleanup Validation

After applying this plan, run:
```bash
# Verify tests still run
yarn test:unit       # Should pass
yarn test:e2e        # Should pass (19 tests instead of 25)
yarn test:coverage   # Should complete without integration tests

# Verify no broken imports
grep -r "bridge-replacement\|test/support/state\|test/support/filesystem" src test --include="*.ts" --include="*.tsx"
# Should return: only matches in integration/ (which are being deleted)

# Verify no dangling references
grep -r "run-e2e-suites\|parse-e2e-results\|monitor-test-resources" . --include="*.md" --include="*.sh" --include="*.mjs" --include="*.json"
# Should return: only documentation (which are being updated)
```

---

## Summary Table

| Category | Current | After Cleanup | Status |
|----------|---------|---------------|--------|
| Unit tests (frontend) | 107 | 107 | ✅ Keep |
| Unit tests (Rust) | 13 | 13 | ✅ Keep |
| E2E tests | 25 | 19 | ⚠️ Remove 6 |
| Test support files | 6 | 3 | ⚠️ Delete 3 |
| Test scripts | 12 | 8-9 | ⚠️ Delete 4 |
| Integration test files | 6 | 0 | ❌ Delete all |
| Doc files to update | 2 | 2 | ⚠️ Edit 2 |
| Doc files to delete | 1 | 0 | ❌ Delete 1 |

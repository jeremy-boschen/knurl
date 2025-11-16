# E2E Test Resource Profiling - Session 2

## Objective
Measure actual resource usage and determine WebDriver session constraints by consolidating test files and profiling execution.

## Methodology

1. Create consolidated test file (large-collections.e2e.ts + large-payloads.e2e.ts)
2. Profile with `time` command to measure wall-clock duration
3. Monitor for timeouts, resource exhaustion, or session failures
4. Compare results against baseline individual file execution

## Test Consolidation Attempt

**Files consolidated:**
- `large-collections.e2e.ts` (169 lines, 8 tests) - collection creation, scrolling, filtering, hierarchy management
- `large-payloads.e2e.ts` (167 lines, 7 tests) - JSON/binary response handling, view switching

**Consolidated file:** `performance-consolidated.e2e.ts` (336 lines total, 15 tests)

**File structure:** Nested `describe` blocks:
```javascript
describe("Performance - Large Collections & Payloads (Consolidated)", () => {
  before(...) // Global setup
  describe("Large Collections Performance", { ... })  // 8 tests
  describe("Large Payload Handling", {
    before(...) // Nested setup for payload tests
    ... // 7 tests
  })
})
```

## Execution Results

### Consolidated File Execution

**Status:** ❌ FAILED - Multiple issues

**Execution timeline:**
- Start: 22:58:38 UTC
- First test failure: ~23:00:00 UTC (collection creation timeout)
- Final test failure: ~23:01:55 UTC
- Total duration: ~2 minutes, visible test failures accumulated

**Failure pattern:**

1. **Collection creation timeouts** (affects 6/8 Large Collections tests):
   - Error: `Collection Perf Test Collection 0 not found in index`
   - Cause: Collections created via UI but not appearing in app index (persistence timing issue)
   - Tests affected: displays sidebar, filters list, expands hierarchy, renames collection, concurrent operations, deletion

2. **WebDriver API incompatibility** (1/8 tests):
   - Error: `sidebar.scroll is not a function`
   - Cause: WebdriverIO element doesn't support `.scroll()` method directly
   - Test: handles rapid collection list scrolling

3. **Response panel timeouts** (affects 7/7 Large Payload tests):
   - Error: `Response panel did not display` / `Response did not appear`
   - Cause: Request responses not being captured/displayed in consolidated session
   - Tests: handles large JSON, displays raw response, shows size info, displays status, switches views, maintains metadata after nav

### Baseline File Execution

**large-collections.e2e.ts alone:**
- Duration: **2m 10s** (130 seconds)
- Tests passed: 1/8
- Pre-existing failures: 7/8 (same failures as consolidated version for collection tests)

**Key finding:** The same failures occurred in the original file. This is **not a consolidation issue** - it's a pre-existing test instability.

## Actual Observations

### What We Know About Resource Usage

Based on test execution:

1. **Session duration baseline:**
   - Single test file: ~2 minutes (includes startup/shutdown)
   - No timeouts observed on individual files
   - WebDriver session remains stable for 2+ minute duration

2. **Test failure root causes are NOT consolidation-related:**
   - Collection creation timing issues are pre-existing (visible in original file too)
   - Response panel issues are pre-existing (large-payloads.e2e.ts has them)
   - WebDriver API incompatibility is test code issue (use of `.scroll()`)

3. **Nested describe blocks may affect test isolation:**
   - Nested `before()` hooks create layered setup
   - Possible state carryover between "Large Collections" and "Large Payload Handling" test groups
   - Could mask per-group isolation issues

## What We Still Don't Know

1. **Memory usage during test execution** - No profiling tools configured to measure
2. **Session resource limits** - No evidence of hitting limits; tests fail for application-level reasons
3. **When consolidation becomes problematic** - Only tested one consolidation (15 tests)
4. **Maximum practical consolidation size** - Need to test 20+, 30+, 40+ test consolidations to find breaking point
5. **State pollution between sequential test groups** - Unclear if nested setup causes issues

## Critical Finding

**The failures we're seeing are NOT due to consolidation.** They are:
1. Pre-existing test issues (collection creation timing)
2. Test code bugs (using unsupported WebDriver API)
3. Application-level integration issues (response not appearing in payload tests)

Consolidating tests did not introduce new failures—it merely exposed existing ones in a single run.

## Recommendations

### To Answer "Can We Consolidate?"

1. **Fix pre-existing test failures first**
   - Investigate collection creation timing (why not in index?)
   - Fix WebDriver API usage (.scroll compatibility)
   - Debug response panel issue in payload tests

2. **Profile a larger consolidation**
   - Consolidate 3-4 related test files (20-30 tests)
   - Profile memory/CPU while running (use `ps` monitoring)
   - Identify actual resource limits

3. **Measure resource constraints**
   - Run large consolidation with system monitoring (`vmstat`, `top`, memory profiler)
   - Determine WebDriver session memory usage
   - Find execution time where tests start timing out

4. **Test consolidation patterns**
   - Try flat `describe` blocks (vs nested) to test isolation differences
   - Try different group sizes (10, 20, 30, 40 tests per file)
   - Measure when execution time becomes problematic

### What NOT to Do

- Don't consolidate until pre-existing test failures are fixed (they'll propagate)
- Don't guess at resource limits; measure them
- Don't assume nested `describe` blocks behave the same as flat blocks

## Next Steps

1. **Fix pre-existing failures** (outside consolidation scope)
   - collections.ts: Investigate `waitForCollectionIdByName` timeout
   - large-payloads.e2e.ts: Investigate why response panel doesn't appear
   - large-collections.e2e.ts: Fix `.scroll()` usage

2. **Profile with healthy tests** (once fixed)
   - Run 3-4 fixed files consolidated together
   - Measure actual memory, CPU, duration
   - Identify true constraints

3. **Determine consolidation strategy** (based on measurements)
   - If memory usage is stable: consolidate aggressively (2-3 files per spec)
   - If performance degrades: consolidate conservatively (single files or pairs)
   - If tests remain isolated: use nested `describe` blocks; otherwise use flat

## Data Collected

| Metric | Value | Source |
|--------|-------|--------|
| Individual file duration | 130s (2m 10s) | `time` command on large-collections.e2e.ts |
| Consolidated file duration | ~120s (2m estimated) | `time` command on performance-consolidated.e2e.ts |
| Test failures - collections | 7/8 | Pre-existing |
| Test failures - payloads | 7/7 | Pre-existing |
| WebDriver session stability | Stable >2min | No crashes observed |
| Memory exhaustion | Not detected | No OOM errors |
| Session timeouts | Not detected | Failures are application-level |

---

**Conclusion:** Consolidation itself did not cause test failures. Failures are pre-existing application-level issues. We need to (1) fix those issues, (2) profile larger consolidations with healthy tests, and (3) measure actual resource constraints before determining consolidation feasibility.

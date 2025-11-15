# E2E Coverage Implementation Guide

This document explains the E2E coverage strategy for Knurl and how to use the coverage documentation.

## Overview

Unlike traditional code coverage metrics (which measure % of lines/branches executed), Knurl uses **behavioral coverage documentation** for E2E tests. This approach:

- ✅ Provides visibility into which user workflows are tested
- ✅ Maps tests to specific modules and features
- ✅ Avoids the overhead of instrumentation in E2E tests
- ✅ Clearly identifies gaps that need unit test coverage

## Using E2E Coverage Documentation

### Primary Reference: `docs/E2E_COVERAGE_MAP.md`

This file documents:
- **Backend coverage:** Which Rust modules are tested by E2E tests
- **Frontend coverage:** Which React components and state slices are tested
- **Coverage gaps:** Features that need unit tests or aren't implemented
- **Test suite mapping:** Which E2E file tests which features

### Finding Coverage for a Module

1. **For backend (Rust):** Search in "Backend Coverage (Rust)" section for the module name
   ```
   Example: Looking for auth.rs coverage?
   → Found under "Auth Module (auth.rs)"
   → Shows oauth-flows.e2e.ts and oauth-ui-flows.e2e.ts cover this
   ```

2. **For frontend (React):** Search in "Frontend Coverage (React)" section for the component/hook
   ```
   Example: Looking for collections.ts coverage?
   → Found under "Collections Slice (collections.ts)"
   → Shows 19+ test items covering different operations
   ```

3. **For integration testing:** Check "Test Suite Summary" table
   ```
   Example: Wanting to understand what oauth-flows.e2e.ts covers?
   → See row showing Auth module, engine, OAuth2 UI, and credentials state
   ```

## Adding New E2E Tests

When you add a new E2E test, update `docs/E2E_COVERAGE_MAP.md`:

1. **Identify modules tested** (both backend and frontend)
2. **Add coverage bullets** under the relevant sections
3. **Update Test Suite Summary** if adding a new test file
4. **Mark gaps as ⚠️ or ❌** if your test doesn't cover something

Example addition:
```markdown
#### Engine Module (`engine.rs`)
- ✅ **HTTP GET/POST/PUT/DELETE/PATCH** - `request-authoring.e2e.ts`
- ✅ **Custom Headers** - `request-authoring.e2e.ts`
+ ✅ **Streaming Responses** - `response-streaming.e2e.ts` (NEW)
```

## Future: Automated Coverage Collection (Optional)

If coverage metrics become important for CI/CD gates, the guide includes three approaches:

### Phase 1: Documentation (Current)
- No dependencies or overhead
- Manual maintenance required
- Sufficient for current needs

### Phase 2: Frontend Instrumentation (Optional)
Requires: `vite-plugin-istanbul`, `nyc`

See `docs/E2E_COVERAGE_GUIDE.md` for implementation details:
- Creates separate E2E coverage metrics from unit tests
- No changes to test execution
- Adds ~10% overhead to E2E runtime

### Phase 3: Full Instrumentation (Not Recommended Yet)
Would require both frontend and backend coverage collection:
- Frontend: Istanbul instrumentation
- Backend: `cargo-llvm-cov` with instrumented binary
- Complex setup, significant overhead

## Coverage Metrics

**Current Status (Phase 1 - Documentation):**
- Frontend: ~80-85% coverage of user-facing features
- Backend: ~75-80% coverage of HTTP client engine
- Integration: ~90%+ coverage of complete workflows

These are estimates based on:
- Lines of code in tested modules
- Feature completeness in tested areas
- Identified gaps vs. implemented features

## Recommendations

### Short-term
1. Keep using documentation approach
2. Add unit tests for identified gaps
3. Maintain E2E_COVERAGE_MAP.md as tests change

### Medium-term (if needed)
- Implement frontend instrumentation if coverage % is needed for CI/CD
- Evaluate ROI of measuring metrics vs. maintaining documentation

### Long-term
- Consider full instrumentation only if:
  - Coverage metrics become hard requirement
  - Team is comfortable with additional infrastructure
  - E2E test performance is acceptable with overhead

## Related Files

- `docs/E2E_COVERAGE_MAP.md` - Detailed coverage mapping
- `docs/E2E_COVERAGE_GUIDE.md` - Original technical implementation guide
- `test/specs/` - E2E test files
- `wdio.conf.ts` - WebDriver.io configuration
- `package.json` - NPM scripts (test:e2e, test:e2e:coverage)

## Questions?

- **What's the difference between E2E coverage and code coverage?**
  - Code coverage = % of code lines executed
  - E2E coverage = % of user workflows tested
  - Both are valuable; we use both (E2E docs + unit test metrics)

- **Why not use Istanbul for E2E tests?**
  - E2E tests run in browser + separate Tauri process
  - Requires separate instrumentation setup
  - Adds complexity and runtime overhead
  - Documentation provides sufficient visibility with zero overhead

- **How do I know if something is missing?**
  - Check E2E_COVERAGE_MAP.md for ⚠️ (limited) or ❌ (not covered) markers
  - Add unit tests for those gaps
  - Mark as unit-tested in E2E_COVERAGE_MAP.md

## Maintenance

Update this documentation when:
- ✅ Adding new E2E test files
- ✅ Adding new features to existing tests
- ✅ Adding unit tests to cover E2E gaps
- ✅ Implementing new modules

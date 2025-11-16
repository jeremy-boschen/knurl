# E2E Test Refactoring Plan (2025-11-16)

## Objective
Refactor failing E2E tests to follow the correct testing paradigm: strict UI-only behavior for E2E tests, with integration tests approved separately for cross-layer verification.

## Testing Paradigm (Canonical)

### Unit Tests
- Mock all external dependencies (Tauri, filesystem, network)
- Test logic, state mutations, component behavior in isolation
- Colocated as `*.test.ts(x)` files
- No backend access, no real I/O

### E2E Tests (WebDriver.io)
- **ONLY** UI interactions and visible behavior
- Create state exclusively through UI actions (clicks, typing)
- Verify outcomes only via what the UI displays
- **NO** backend plumbing, filesystem access, app state inspection
- If behavior can't be tested via UI, move to integration or unit tests

### Integration Tests (WebDriver.io + Backend Access)
- Cross-layer behavior verification (encryption, persistence, state sync)
- **Requires explicit approval before writing**
- Setup via UI where possible; backend access only for verification
- Stored in `test/specs/integration/`
- Must justify why behavior can't be tested via E2E or unit tests

---

## Current State

### Failing Tests (Still Using Old Bridge Pattern)
These tests are calling `callBridge` or `callBridgeReplacement` to create state via backend, which violates E2E discipline:
- `collection-encryption.e2e.ts` - Needs reclassification
- `collection-merge.e2e.ts` - Uses analyze_merge bridge method
- `collection-storage.e2e.ts` - Uses get_collection bridge method
- `large-collections.e2e.ts` - Uses create_collection bridge method
- And ~10+ others

---

## Refactoring Strategy

### Step 1: Classify Each Test
For each failing test, determine:
1. **Can the state be created via UI alone?** → Keep as E2E
2. **Can the outcome be verified via UI alone?** → Keep as E2E
3. **Requires backend verification not exposed in UI?** → Move to integration (requires approval)
4. **Tests logic/behavior that can't be exposed via UI?** → Convert to unit test

### Step 2: Fix E2E Tests
- Remove all `callBridge` / `callBridgeReplacement` calls for state setup
- Use UI helpers from `test/support/ui.ts` to create state
- Use UI queries to verify outcomes
- Extend `test/support/ui.ts` with new helpers as needed (vs. hand-rolling selectors)

### Step 3: Plan Integration Tests
For each test that needs backend verification:
1. **Document justification**: Why this can't be tested via E2E or unit tests
2. **Design with human oversight**: Propose integration test design before writing
3. **Store in `test/specs/integration/`**
4. **Use `callBridgeReplacement` sparingly**: Only for verification, not setup

### Step 4: Create Unit Tests (If Needed)
For business logic that can't be exposed via UI or doesn't need E2E validation.

---

## Examples

### collection-encryption.e2e.ts
**Current issue:** Tries to verify encryption via backend file access and state inspection.

**Options:**
1. **If encryption is purely implementation detail** → Convert to unit test
   - Test encryption/decryption logic with mocked state
   - No E2E value if users can't see encryption happening

2. **If encryption has UI manifestation** → Rewrite as pure E2E
   - Create collection via UI
   - Verify persistent behavior (e.g., collections restore after restart)
   - Don't inspect encryption directly

3. **If cross-layer verification is essential** → Design as integration test
   - Setup collection via UI
   - Verify encrypted files exist on disk with correct format
   - Requires explicit approval with clear justification

---

## Next Steps (On Approval)

1. ✅ Documented three test categories with clear discipline
2. ✅ Created integration test approval gate in AGENTS.md + CLAUDE.md
3. ⏳ Review failing tests and classify each one
4. ⏳ For E2E tests: refactor to UI-only interaction
5. ⏳ For integration tests: propose design and get approval before coding
6. ⏳ For unit tests: create as needed

---

## Key Rules (Enforcement)

- **E2E tests must not access internal state** (no `__vite_ssr_modules__`, `browser.execute()` for inspection)
- **E2E tests must not call Tauri commands** (no `invoke()` calls)
- **E2E tests must not read filesystem** (no fs utilities for verification)
- **Integration tests require approval** before implementation
- **Setup via UI first** (integration tests use UI for state creation, backend only for outcome verification)


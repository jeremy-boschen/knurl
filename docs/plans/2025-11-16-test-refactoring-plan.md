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

## Test Classification Results

### E2E Tests (Remove Bridge Dependency)

These tests create state via UI but verify via bridge. **Action: Replace bridge verification with DOM queries.**

1. **collections-flow.e2e.ts** - ✅ Ready to refactor
   - Currently: Creates state via UI, verifies with `getWorkspaceSnapshot`
   - Refactor: Replace all `getWorkspaceSnapshot` calls with DOM queries for tab state and collection index
   - Effort: Low (straightforward queries)

2. **collections-management.e2e.ts** - ✅ Ready to refactor
   - Currently: UI state creation + bridge snapshot verification + `flushStorage`
   - Refactor: Replace `getWorkspaceSnapshot` with DOM inspection; remove `flushStorage` (use `browser.pause()`)
   - Effort: Low (simple helper refactoring)

3. **environment-management.e2e.ts** - ✅ Ready to refactor
   - Currently: Single `getWorkspaceSnapshot` call for tab state
   - Refactor: Replace with `browser.execute()` to query open tabs state
   - Effort: Minimal (one-liner change)

4. **request-authoring.e2e.ts** - ✅ Ready to refactor
   - Currently: UI-only state, one `getWorkspaceSnapshot` in helper function
   - Refactor: Remove bridge dependency entirely; use direct DOM queries
   - Effort: Low (isolated helper refactoring)

5. **scratch-collection.e2e.ts** - ✅ Ready to refactor
   - Currently: UI state creation + multiple `getWorkspaceSnapshot` calls + `flushStorage`
   - Refactor: Replace all bridge calls with DOM queries; remove `flushStorage`
   - Effort: Low (straightforward query replacements)

### Integration Tests (Legitimate Backend Verification)

These tests verify cross-layer behavior (persistence, reload, merge logic, auth). **Action: Move to `test/specs/integration/` folder.**

1. **launch-hydration.e2e.ts** - ✅ Approved as integration
   - Purpose: Verify state persistence at rest and recovery after reload
   - Bridge usage justified: Tests file I/O, encryption, and frontend hydration
   - Status: Move to `test/specs/integration/launch-hydration.e2e.ts`

2. **workspace-restore.e2e.ts** - ✅ Approved as integration
   - Purpose: Verify workspace state persists and restores across app restart
   - Bridge usage justified: Tests snapshot persistence and reload recovery
   - Status: Move to `test/specs/integration/workspace-restore.e2e.ts`

3. **tauri-integration.e2e.ts** - ✅ Approved as integration
   - Purpose: Test backend Tauri command routing, file system, auth pipeline
   - Bridge usage justified: Tests backend functionality directly
   - Status: Keep in current location; document in integration folder
   - Note: This is fundamentally a backend test; consider moving to `tests/` folder once backend integration testing is established

4. **collection-merge.e2e.ts** - ⏳ Pending implementation
   - Purpose: Verify collection merge analysis and application logic
   - Status: BLOCKED - `analyze_merge` and `apply_merge` not yet implemented in bridge-replacement
   - Action: Implement merge methods in bridge-replacement first; then move to `test/specs/integration/`

5. **oauth-ui-flows.e2e.ts** - 🤔 Mixed concerns
   - Purpose: Test OAuth flow via UI + verify auth cache storage
   - Current issue: Uses both UI interactions and auth cache verification
   - Recommendation: Keep as E2E test; `getAuthCacheEntry` calls are justified (verify backend processed auth correctly)
   - Action: Keep all `getAuthCacheEntry` calls; remove single `getWorkspaceSnapshot` call

---

## Next Steps (On Approval)

1. ✅ Documented three test categories with clear discipline
2. ✅ Created integration test approval gate in AGENTS.md + CLAUDE.md
3. ✅ **COMPLETED**: Reviewed and classified all 10 bridge-using tests
4. ⏳ **PHASE 1**: Refactor 5 pure E2E tests to remove bridge dependency
   - collections-flow.e2e.ts
   - collections-management.e2e.ts
   - environment-management.e2e.ts
   - request-authoring.e2e.ts
   - scratch-collection.e2e.ts
5. ⏳ **PHASE 2**: Move 4 integration tests to `test/specs/integration/`
   - launch-hydration.e2e.ts
   - workspace-restore.e2e.ts
   - tauri-integration.e2e.ts
   - collection-merge.e2e.ts (after merge methods are implemented)
6. ⏳ **PHASE 3**: Implement missing bridge methods
   - `analyze_merge` in bridge-replacement.ts
   - `apply_merge` in bridge-replacement.ts
7. ⏳ **PHASE 4**: Document integration test folder with approval requirements

---

## Detailed Refactoring Instructions

### PHASE 1: E2E Test Refactoring (Remove Bridge Dependency)

#### 1. collections-flow.e2e.ts

**Current state:**
- Lines 144, 177, 191, 203, 233, 260, 284: `getWorkspaceSnapshot()` calls used to verify:
  - Tab collection assignment
  - Request placement in collection/scratch
  - Tab closure
  - Tab switching

**Required changes:**
```typescript
// BEFORE:
const snapshot = await callBridgeReplacement('getWorkspaceSnapshot')
expect(snapshot.openTabs[0].collectionId).toBe(collectionId)

// AFTER: Use browser.execute to query DOM directly
const tabElement = await browser.$('[data-test-id="tab:..."]')
const collectionId = await tabElement.getAttribute('data-collection-id')
```

**DOM queries needed:**
- `[data-test-id^="tab:"]` - get all tabs and their collection ID
- `[data-test-id^="request-row:"]` - verify request placement in tree
- Collection tree structure inspection

**Effort:** ~30 minutes - straightforward DOM queries

---

#### 2. collections-management.e2e.ts

**Current state:**
- Lines 58, 70, 98, 110, 150, 167: `getWorkspaceSnapshot()` verification
- Line 69: `flushStorage()` call (unnecessary)
- Helper function `isCollectionNamedInTree()` mixes DOM + snapshot checks

**Required changes:**
1. Remove line 69 `flushStorage()` call - use `await browser.pause(500)` instead
2. Replace all `getWorkspaceSnapshot()` calls with DOM queries:
   - Collection tree visibility
   - Collection ordering
   - Folder expansion state
3. Refactor `isCollectionNamedInTree()` helper to use DOM-only queries

**DOM queries needed:**
- Collection row elements with name data attributes
- Folder expand/collapse state from DOM classes
- Tree ordering from DOM element order

**Effort:** ~20 minutes - mostly in helper function refactoring

---

#### 3. environment-management.e2e.ts

**Current state:**
- Line 105: Single `getWorkspaceSnapshot()` call to verify active tab

**Required changes:**
```typescript
// BEFORE:
const snapshot = await callBridgeReplacement('getWorkspaceSnapshot')
const activeTab = snapshot.activeTab

// AFTER:
const activeTab = await browser.execute(() => {
  const activeElement = document.querySelector('[data-test-id="tab:active"]')
  return activeElement?.getAttribute('data-tab-id')
})
```

**DOM queries needed:**
- Active tab identification (likely has CSS class like `.active` or `data-active="true"`)

**Effort:** ~5 minutes - one-liner replacement

---

#### 4. request-authoring.e2e.ts

**Current state:**
- Line 454: `getTabSnapshot()` helper function uses `getWorkspaceSnapshot()`
- Helper returns tab state for verification

**Required changes:**
Refactor `getTabSnapshot()` helper:
```typescript
// BEFORE:
async function getTabSnapshot(tabId: string) {
  const snapshot = await callBridgeReplacement('getWorkspaceSnapshot')
  return snapshot.openTabs.find(t => t.tabKey === tabId)
}

// AFTER:
async function getTabSnapshot(tabId: string) {
  return await browser.execute((tid: string) => {
    const tab = document.querySelector(`[data-test-id="tab:${tid}"]`)
    return tab ? {
      tabKey: tid,
      collectionId: tab.getAttribute('data-collection-id'),
      requestId: tab.getAttribute('data-request-id'),
      // ... other properties from data attributes
    } : null
  }, tabId)
}
```

**Effort:** ~10 minutes - isolated helper refactoring

---

#### 5. scratch-collection.e2e.ts

**Current state:**
- Lines 48, 59, 89, 125: `getWorkspaceSnapshot()` calls
- Line 114: `flushStorage()` call (unnecessary)
- Verifies: scratch request presence, tab state, collection state

**Required changes:**
1. Remove line 114 `flushStorage()` call - use `await browser.pause(500)`
2. Replace `getWorkspaceSnapshot()` calls:
   - Line 48: Verify initial tab state → DOM query for tab element
   - Line 59: Verify request in collection → DOM query for request row
   - Line 89: Verify request in scratch → DOM query for scratch folder
   - Line 125: Verify tab removed → DOM query for tab absence

**DOM queries needed:**
- Tab presence/absence with request ID
- Scratch collection folder structure
- Request row visibility in specific folder

**Effort:** ~15 minutes - straightforward query replacements

---

### PHASE 2: Integration Test Migration

Create `test/specs/integration/` folder and move:
1. `launch-hydration.e2e.ts` → `test/specs/integration/launch-hydration.e2e.ts`
2. `workspace-restore.e2e.ts` → `test/specs/integration/workspace-restore.e2e.ts`
3. `tauri-integration.e2e.ts` → `test/specs/integration/tauri-integration.e2e.ts`
4. `collection-merge.e2e.ts` → `test/specs/integration/collection-merge.e2e.ts` (after merge methods implemented)

Add header comment to each:
```typescript
/**
 * Integration Test: Tests cross-layer behavior (persistence, reload, backend processing)
 *
 * This test uses bridge-replacement for state verification because it validates
 * backend functionality that is not exposed in the UI. See CLAUDE.md for integration
 * test approval criteria.
 */
```

Update `wdio.conf.ts` to exclude integration tests from standard E2E run:
```typescript
exclude: runningDocs
  ? ['./test/specs/**/*.ts', '!./test/specs/integration/**']
  : ['./documentation/e2e/**/*.ts', '!./test/specs/integration/**']
```

Add separate npm script:
```json
"test:e2e:integration": "yarn wdio run ./wdio.conf.ts --spec 'test/specs/integration/**/*.ts'"
```

**Effort:** ~20 minutes - file moves, config updates, script addition

---

### PHASE 3: Implement Missing Bridge Methods

In `test/support/bridge-replacement.ts`, implement:

#### `analyze_merge` method
```typescript
case 'analyze_merge':
  return await analyzeMergeViaState(args[0])
```

Implementation should:
1. Load original collection from disk
2. Compare with imported bundle structure
3. Detect additions, modifications, conflicts
4. Return analysis object with conflict list and change summary

#### `apply_merge` method
```typescript
case 'apply_merge':
  return await applyMergeViaState(args[0])
```

Implementation should:
1. Load original collection
2. Apply merge strategy (preserve-existing, overwrite, etc.)
3. Save updated collection to disk
4. Return applied changes summary

**Effort:** ~1-2 hours - requires understanding merge logic

---

### PHASE 4: Documentation Updates

1. Create `test/specs/integration/README.md`:
   - Purpose of integration tests
   - When to use integration vs E2E vs unit
   - Bridge method usage guidelines
   - Approval process reference

2. Update `CLAUDE.md`:
   - Link to integration test README
   - Approval gate reminder
   - Example of justified integration test

3. Update test comments:
   - Each E2E test should have brief comment: "Pure E2E test - no bridge dependency"
   - Each integration test should have comment explaining why backend verification is needed

**Effort:** ~15 minutes - documentation only

---

## Execution Timeline

- **PHASE 1** (E2E refactoring): ~1.5 hours
  - Can be parallelized across 5 test files
  - Low risk - DOM-based verification is more reliable than bridge state

- **PHASE 2** (Integration migration): ~20 minutes
  - Simple file moves and config updates

- **PHASE 3** (Bridge methods): ~2 hours
  - Depends on merge logic understanding
  - Can be deferred if merge feature not ready

- **PHASE 4** (Documentation): ~15 minutes
  - Should follow implementation

**Total time to complete all phases:** ~3.5-4 hours

---

## Key Rules (Enforcement)

- **E2E tests must not access internal state** (no `__vite_ssr_modules__`, `browser.execute()` for inspection)
- **E2E tests must not call Tauri commands** (no `invoke()` calls)
- **E2E tests must not read filesystem** (no fs utilities for verification)
- **Integration tests require approval** before implementation
- **Setup via UI first** (integration tests use UI for state creation, backend only for outcome verification)


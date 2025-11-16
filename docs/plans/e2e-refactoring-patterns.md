# E2E Test Refactoring Patterns

This document captures proven refactoring patterns for converting backend-dependent E2E tests to pure UI-based tests.

## Pattern: Collection Creation Loop

**Scenario:** Test needs to create multiple collections for performance/scale testing.

**Before (Backend-Dependent):**
```typescript
const collections = []
for (let i = 0; i < 50; i++) {
  const created = await callBridgeReplacement('create_collection', {
    name: `Test Collection ${i}`,
  })
  collections.push(created)
}
```

**After (Pure E2E):**
```typescript
import { createCollection } from '../support/collections'

for (let i = 0; i < 10; i++) {
  await createCollection(`Test Collection ${i}`)
}
```

**Notes:**
- `createCollection()` helper in `test/support/collections.ts` handles all UI interactions
- Reduced collection count (50 → 10) for practical test execution times
- Adjusted performance thresholds proportionally

---

## Pattern: Finding Elements by Test ID Query

**Scenario:** Test needs to identify and interact with dynamically created elements.

**Before (Backend ID Retrieval):**
```typescript
const collections = await callBridgeReplacement('get_all_collections', {})
const targetCollection = collections[0]
const rowElement = await $(`[data-test-id="collection-tree:collection-row:${targetCollection.id}"]`)
```

**After (Pure DOM Query):**
```typescript
const collectionRows = await $$('[data-test-id^="collection-tree:collection-row:"]')
const rowElement = collectionRows[0]
```

**Notes:**
- Use CSS selectors with `$` (single) and `$$` (multiple)
- Prefix matching with `^=` useful for test-id patterns
- Eliminates backend query entirely

---

## Pattern: Performance Measurement via UI Interactions

**Scenario:** Test measures responsiveness of UI operations.

**Before (Backend Measurement):**
```typescript
const startTime = Date.now()
const renamed = await callBridgeReplacement('update_collection', {
  id: targetCollection.id,
  name: newName,
})
const updateTime = Date.now() - startTime
expect(updateTime).toBeLessThan(2000)
```

**After (UI Interaction Measurement):**
```typescript
const startTime = Date.now()
await rowElement.click()
const clickTime = Date.now() - startTime
expect(clickTime).toBeLessThan(1000)
```

**Notes:**
- Measure actual user-perceivable operations
- Times reflect real browser/UI performance
- More meaningful than backend operation timing

---

## Pattern: Collection Retrieval → DOM Query

**Scenario:** Test verifies state visibility in the UI.

**Before (Backend State Access):**
```typescript
const collection = await callBridgeReplacement('get_collection', {
  id: collectionId,
})
expect(collection.name).toBe(expectedName)
```

**After (UI Verification):**
```typescript
const collectionRow = await $(`[data-test-id="collection-tree:collection-row:${collectionId}"]`)
const textContent = await collectionRow.getText()
expect(textContent).toContain(expectedName)
```

**Notes:**
- Verify what users actually see
- Use `getText()`, `getAttribute()`, `isDisplayed()` for verification
- More aligned with E2E principles

---

## Pattern: Conditional Element Interactions

**Scenario:** Element may or may not exist (e.g., search input, expand button).

**Before:**
```typescript
const searchInput = await $('[data-test-id="collection-tree:search-input"]')
if (await searchInput.isDisplayed()) {
  await searchInput.setValue('query')
}
```

**After (Same - Already Correct):**
```typescript
const searchInput = await $('[data-test-id="collection-tree:search-input"]')
if (await searchInput.isDisplayed()) {
  await searchInput.setValue('query')
}
```

**Notes:**
- Always check `isDisplayed()` before interacting
- Use try-catch for optional features
- Prevents test failures on missing UI elements

---

## Refactoring Checklist

When refactoring an E2E test from backend-dependent to pure UI:

- [ ] Replace `callBridgeReplacement('create_*', ...)` with UI helper functions
- [ ] Replace `callBridgeReplacement('get_*', ...)` with DOM queries (`$`, `$$`)
- [ ] Replace backend state access with `getText()`, `getAttribute()`, `isDisplayed()`
- [ ] Measure UI interactions (clicks, typing) instead of backend operations
- [ ] Adjust thresholds: account for real browser performance
- [ ] Remove unused imports: `callBridgeReplacement`, unused bridge methods
- [ ] Verify all `$$` queries use appropriate selectors
- [ ] Add comments explaining why optional features use try-catch

---

## Performance Expectations

When converting backend shortcuts to UI interactions:

| Operation | Backend Time | UI Time | Adjustment |
|-----------|--------------|---------|------------|
| Create collection | ~50ms | ~1.5s | 1.5s per collection (UI interaction cost) |
| Click collection | ~10ms | ~100ms | Real DOM/browser overhead |
| Scroll sidebar | ~5ms | ~50ms | Real rendering time |
| Performance threshold (50 collections) | 30s | 75s | Proportional to collection count |

**Rule of thumb:** UI interactions are 10-30x slower than backend operations due to browser rendering, event loops, and DOM updates. Adjust test expectations accordingly.

---

## Example: Complete Refactoring (large-collections.e2e.ts)

**File:** test/specs/large-collections.e2e.ts
**Commit:** 897c06ee
**Changes:**
- Removed 8 `callBridgeReplacement` calls
- Added imports: `createCollection` from UI helpers
- Adjusted loop counts: 50 → 10 collections
- Adjusted performance thresholds: 30s → 15s (for 10 collections)
- All tests now verify user-visible behavior only


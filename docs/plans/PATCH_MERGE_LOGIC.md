# Patch & Merge Logic - The Source of Truth

This document describes the correct patch and merge logic for the request parameter system. These rules apply to:
- `queryParams`
- `pathParams`
- `cookieParams`
- `headers`

All follow the EXACT same logic. Code should be identical except for variable/field names.

## Core Rules

### 1. Base State
A `RequestState` has base values:
- `base.queryParams = {q1: {id, name, value, enabled, secure}, q2: ...}`
- `base.pathParams = {p1: {id, name, value, enabled, secure}, ...}`
- `base.cookieParams = {c1: {id, name, value, enabled, secure}, ...}`
- `base.headers = {h1: {id, name, value, enabled, secure}, ...}`

### 2. First Edit - ensureParamPatch
When ANY param field is edited:
1. `ensureParamPatch` is called ONCE (idempotent - only runs if patch doesn't have the record)
2. It copies ALL params from base into patch, parsing each through Zod
3. Example: If base has {q1, q2, q3}, patch becomes {q1, q2, q3} (fresh copies)
4. Then the specific field edit is applied to the specific param in patch

### 3. Subsequent Edits
More edits call the param update function again:
1. `ensureParamPatch` is called but does nothing (patch already has the record)
2. The update function reads: `baseParam = patch[id] ?? request[id] ?? {}`
   - This prioritizes the patch (which has all prior edits)
   - Falls back to request if patch doesn't have it (should not happen)
   - Falls back to {} if neither has it (for new params)
3. Merges: `patch[id] = { ...baseParam, ...update, id }`
4. Result: patch has all params with accumulated edits

### 4. Deletion
User deletes a param:
1. Update function is called with `update = null`
2. Code: `delete patch[paramKey][id]`
3. That param is no longer in patch (absence indicates deletion)

### 5. Undo
User discards all changes:
1. `patch` is cleared to `{}`
2. Next display uses base values (all params restored)

### 6. toMergedRequest - Display Logic
Returns a merged view for display/export:
1. If `patch.queryParams === undefined` → use `base.queryParams`
2. If `patch.queryParams` exists (even partial) → use `patch.queryParams` (COMPLETE REPLACEMENT, not merge)
3. CRITICAL: If patch has only {q2}, the display shows ONLY q2 (q1 deleted)
4. This is simple substitution, NO per-param merging

### 7. commitRequestPatch - Persistence Logic
Applies patch to base and clears patch:
1. If `patch.queryParams` exists → `base.queryParams = patch.queryParams` (COMPLETE REPLACEMENT)
2. If `patch.queryParams` undefined → `base.queryParams` unchanged
3. Then `patch = {}` (clear patch)

### 8. Equality Cleanup - Optional Optimization
After each edit, `pruneParamPatchIfEqual` checks if patch now equals base:
1. If `patch.queryParams === base.queryParams` → `delete patch.queryParams`
2. This occurs when edits have been reverted to match base exactly
3. Keeps patches clean by removing unnecessary modifications

## Key Insight

**The patch is always a COMPLETE copy of relevant params, not partial.**

When a param is in the patch, it's there WITH ALL other params that were present at the time of the first edit. Any param missing from patch = deleted by user.

This design enables:
- Simple undo: just discard patch
- No tracking of "added" vs "modified" vs "deleted"
- No complex per-field merging logic
- Consistent display logic (patch = patch-only view)

## Code Pattern

All param update functions should follow this exact pattern:

```typescript
updateRequestPatchXxxParam(
  collectionId: string,
  requestId: string,
  id: string,
  update: Partial<RequestXxxParam> | null,
): void {
  assertCollectionLoaded(collectionId)

  set((app) => {
    const { request } = findRequestInCollection(app.collectionsState.cache[collectionId], requestId)
    const patch = ensureRequestPatch(request)
    ensureParamPatch(request, patch, "xxxParams")  // Copies all base params to patch (once)

    if (update) {
      // Read from patch first (has prior edits), fall back to base
      const baseParam = patch.xxxParams?.[id] ?? request.xxxParams?.[id] ?? {}
      // Merge base + update into patch
      patch.xxxParams![id] = { ...baseParam, ...update, id }
    } else {
      // Deletion
      delete patch.xxxParams![id]
    }

    pruneParamPatchIfEqual(request, patch, "xxxParams")  // Optional: clean if equals base
    if (!isNotEmpty(patch)) {
      request.patch = {}
    }
    request.updated += 1
  })
}
```

## Test Coverage

File: `src-ui/src/state/patch-merge.test.ts`

Tests verify:
1. toMergedRequest with no patch returns base unchanged
2. toMergedRequest with patch uses patch (complete replacement)
3. Patch deletion works (param not in patch)
4. Param additions work
5. Lifecycle: edit → merge → edit → merge → undo all work correctly

These tests are the SOURCE OF TRUTH for patch/merge behavior.

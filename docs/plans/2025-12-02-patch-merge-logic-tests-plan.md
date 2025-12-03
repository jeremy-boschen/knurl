# Patch & Merge Logic Comprehensive Test Plan

## Problem Statement

The cookie parameters (and potentially query params, path params) have a critical bug where partial patches cause data loss.

### Bug Scenario
- Base request has 2 cookies: `c1` (enabled=false, value="v1") and `c2` (enabled=false, secure=true, value="v2")
- User changes the value of `c2` to "newvalue"
- Patch created: `{ c2: { value: "newvalue" } }`
- **BUG**: `toMergedRequest` returns ONLY `c2`, losing `c1` entirely
- This happens because `toMergedRequest` does full replacement when patch exists for param records

### Root Cause

In `toMergedRequest` (types/request/index.ts):
```typescript
cookieParams: p.cookieParams !== undefined ? p.cookieParams : request.cookieParams,
```

This replaces the entire param object instead of deep-merging. Should be:
```typescript
cookieParams: mergeParamRecords(request.cookieParams, p.cookieParams),
```

## Test Strategy

### 1. Patch Logic Tests (`request-ops.ts` functions)
Test the `updateRequestPatchCookieParam` and similar functions:
- ✓ No initial patch, add first cookie
- ✓ Patch exists, modify existing cookie's value
- ✓ Patch exists, modify existing cookie's name
- ✓ Patch exists, toggle secure on existing cookie
- ✓ Two cookies in base, patch modifies one, verify both in patch
- ✓ Two cookies in base, patch modifies both (two separate calls)
- ✓ Delete param via patch (update null)
- ✓ Create new param that doesn't exist in base
- ✓ Modify param back to original value (should prune patch)

### 2. Merge Logic Tests (`toMergedRequest` function)
Test the merge behavior for displaying data:
- ✓ No patch exists → return base unchanged
- ✓ Empty patch → return base unchanged
- ✓ Patch has one param, base has one param → merged has one with patch applied
- ✓ Patch has one cookie, base has two cookies → merged has BOTH (one with patch, one unchanged)
- ✓ Patch has two cookies, base has two → both merged correctly
- ✓ Patch deletes one param (not in patch) → merged excludes it
- ✓ Patch adds new param not in base → merged includes it
- ✓ Patch modifies multiple fields on same param → all modifications present
- ✓ Patch does partial modification of nested fields → maintains unreferenced fields

### 3. Round-trip Tests
Test full cycle: update → patch → merge → display → update again:
- ✓ Add cookie → modify it → verify merge → modify again → verify merge
- ✓ Two cookies → modify first → merge → modify second → merge
- ✓ Cookie with all fields → modify one field → verify others preserved

## Implementation Plan

1. Create `/src-ui/src/state/patch-merge.test.ts` with comprehensive tests
2. Identify exact issue in `toMergedRequest`
3. Fix the merge logic for param records (queryParams, pathParams, cookieParams)
4. Verify all tests pass
5. Add equivalent tests for other param types

## Files to Modify

- `src-ui/src/types/request/index.ts` - Fix `toMergedRequest` merge logic
- Create `src-ui/src/state/patch-merge.test.ts` - New comprehensive test file

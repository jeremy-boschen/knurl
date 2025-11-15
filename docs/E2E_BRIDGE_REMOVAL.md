# E2E Bridge Removal Guide

## Overview

The E2E bridge (`window.__KNURL_E2E__`) is an anti-pattern that defeats the purpose of end-to-end testing by allowing tests to bypass the actual application UI and directly invoke backend logic.

This document outlines the strategy to remove the bridge entirely and migrate tests to true E2E patterns.

## Current Bridge Usage

16 test files currently depend on the bridge:
- auth-strategies.e2e.ts
- collection-encryption.e2e.ts
- collection-merge.e2e.ts
- collection-storage.e2e.ts
- collections-flow.e2e.ts
- collections-management.e2e.ts
- environment-management.e2e.ts
- large-collections.e2e.ts
- launch-hydration.e2e.ts
- oauth-flows.e2e.ts
- oauth-ui-flows.e2e.ts
- request-authoring.e2e.ts
- response-analysis.e2e.ts
- scratch-collection.e2e.ts
- tauri-integration.e2e.ts
- workspace-restore.e2e.ts

Most frequently used bridge methods:
- `getWorkspaceSnapshot` (29 calls) - Query app state
- `create_collection` (26 calls) - Create collections
- `get_collection` (14 calls) - Retrieve collection data
- `update_collection` (8 calls) - Modify collections
- `loadAppData` (8 calls) - Read app data files
- `invoke_auth` (6 calls) - Invoke authentication
- `import/export_collection` (various) - Collection management

## Migration Strategy

### Phase 1: Infrastructure (✅ COMPLETED)

Implemented new infrastructure to support true E2E testing:

1. **Config Directory Access** (`wdio.conf.ts`)
   - Exposes app config directory to tests via `window.__KNURL_E2E_CONFIG_DIR__`
   - Allows reading app data files directly

2. **Filesystem Utilities** (`test/support/filesystem.ts`)
   - `readAppDataFile(path)` - Read text files
   - `readAppDataJson(path)` - Read and parse JSON
   - `readAppDataBinary(path)` - Read encrypted/binary files
   - `appDataFileExists(path)` - Check existence
   - `listAppDataFiles(path)` - List directories

3. **Bridge Replacement Module** (`test/support/bridge-replacement.ts`)
   - Drop-in replacement for the original bridge
   - Uses UI interactions and filesystem reads instead of backend shortcuts
   - Acts as transition layer during migration

### Phase 2: Test Migration (IN PROGRESS)

Migration path:

```typescript
// BEFORE: Using original bridge
import { callBridge, ensureBridgeReady } from "../support/e2e-bridge"

before(async () => {
  await ensureWorkspaceReady()
  await ensureBridgeReady()  // ❌ Problematic
})

it("creates collection", async () => {
  const created = await callBridge("create_collection", { name: "Test" })  // ❌ Shortcut
  expect(created.id).toBeDefined()
})
```

```typescript
// AFTER: Using UI + filesystem (bridge removal)
import { createCollection } from "../support/collections"
import { readAppDataJson } from "../support/filesystem"

before(async () => {
  await ensureWorkspaceReady()  // ✅ No bridge needed
})

it("creates collection", async () => {
  const collectionId = await createCollection("Test")  // ✅ Real UI interaction

  // Verify by reading actual file
  const data = await readAppDataJson(`collections/${collectionId}.json`)  // ✅ Real file
  expect(data.id).toBeDefined()
})
```

### Phase 3: Full Removal

Once all tests are migrated:
1. Delete `src/test/e2e-bridge.ts`
2. Delete `test/support/e2e-bridge.ts`
3. Delete `test/support/bridge-replacement.ts`
4. Remove bridge initialization from `src/index.tsx`
5. Remove `import.meta.env.MODE === "e2e"` condition (bridge was only purpose)

## Test-Specific Migration Patterns

### Collection Creation Tests

**Bridge Pattern:**
```typescript
const created = await callBridge("create_collection", { name })
```

**UI Pattern:**
```typescript
import { createCollection } from "../support/collections"
const collectionId = await createCollection(name)
```

### Collection Verification Tests

**Bridge Pattern:**
```typescript
const collection = await callBridge("get_collection", { id })
```

**Filesystem Pattern:**
```typescript
import { readAppDataJson } from "../support/filesystem"
const collection = await readAppDataJson(`collections/${id}.json`)
```

### Encryption Verification Tests

**Bridge Pattern:**
```typescript
const rawData = await callBridge("loadAppData", `collections/${id}.json`)
expect(rawData).toBeDefined()  // Can't verify it's actually encrypted
```

**Filesystem Pattern:**
```typescript
import { readAppDataBinary } from "../support/filesystem"
const rawBytes = await readAppDataBinary(`collections/${id}.json`)

// Verify it's binary (encrypted), not plaintext JSON
const isPlaintext = rawBytes.toString('utf8').startsWith('{')
expect(!isPlaintext).toBe(true)  // ✅ Proves encryption worked
```

### Workspace State Tests

**Bridge Pattern:**
```typescript
const snapshot = await callBridge("getWorkspaceSnapshot")
expect(snapshot.collectionsIndex.length).toBeGreaterThan(0)
```

**App State Pattern (during transition):**
```typescript
const snapshot = await getWorkspaceSnapshotFromState()  // Uses bridge-replacement
expect(snapshot.collectionsIndex.length).toBeGreaterThan(0)
```

**Final Pattern (after bridge removal):**
```typescript
// Read from localStorage or direct app state
const collections = await browser.execute(() => {
  // Access React/Zustand state directly
})
expect(collections.length).toBeGreaterThan(0)
```

## Benefits of Full Bridge Removal

1. **True E2E Testing**
   - Tests exercise complete application stack
   - No backend shortcuts

2. **Encryption Verification**
   - Can prove data is actually encrypted on disk
   - Not just claimed to be encrypted

3. **Persistence Validation**
   - Tests verify data is written correctly to filesystem
   - Storage layer gets tested

4. **Realistic Workflows**
   - Tests mirror actual user interactions
   - UI validation is inherent

5. **Reduced Maintenance**
   - No bridge API to maintain
   - Tests use public APIs only

## Migration Order (Recommended)

Start with tests that use bridge minimally:

1. `auth-strategies.e2e.ts` - Uses bridge only for `ensureBridgeReady` and `getWorkspaceSnapshot`
2. `collections-flow.e2e.ts` - Already uses UI for creation, minimal bridge usage
3. `collections-management.e2e.ts` - Heavy CRUD via bridge, needs systematic UI refactoring
4. `collection-encryption.e2e.ts` - Critical for verifying true encryption, priority migration

Tests with complex bridge usage (may require more substantial refactoring):
- `collection-merge.e2e.ts` - Uses `analyze_merge`, `apply_merge` (backend operations)
- `oauth-flows.e2e.ts` - Uses `invoke_auth` (authentication bridge)

## Current Blockers & Solutions

### Issue: Getting Collection ID After Creation

**Problem:** After creating via UI, need collection ID to read from filesystem

**Solutions:**
1. Extract ID from visible collection tree (via `getElementByTestId`)
2. Read collections index from app state
3. Use filesystem utility: `listAppDataFiles("collections")` to find new file

### Issue: Workspace State Access

**Problem:** Tests use `getWorkspaceSnapshot` to verify app state

**Solutions:**
1. Short-term: Use `bridge-replacement.ts` which reads from app state
2. Medium-term: Directly access Zustand store from browser context
3. Long-term: Use UI elements to verify state (e.g., check DOM for visible collections)

### Issue: Authentication & OAuth Testing

**Problem:** Bridge's `invoke_auth` directly invokes auth backend

**Solutions:**
1. Use OAuth UI flows (login dialogs)
2. Pre-seed auth state via config directory
3. Use mock OAuth server already available (`yarn oauth-server`)

## Success Criteria

All tests passing without using:
- `window.__KNURL_E2E__`
- `callBridge()`
- `ensureBridgeReady()`
- `import.meta.env.MODE === "e2e"` condition

## Related Files

- **Infrastructure:**
  - `wdio.conf.ts` - Test setup, config dir exposure
  - `test/support/filesystem.ts` - File reading utilities
  - `test/support/collections.ts` - UI collection helpers
  - `test/support/ui.ts` - General UI utilities

- **To Remove:**
  - `src/test/e2e-bridge.ts` - Bridge definition
  - `test/support/e2e-bridge.ts` - Bridge utilities
  - `test/support/bridge-replacement.ts` - Once migration complete
  - `vite.config.e2e.ts` - `mode: 'e2e'` and `define: { import.meta.env.MODE }` (once bridge gone)

## Implementation Timeline

This is a large refactoring affecting 16 test files. Recommended approach:

1. **Week 1:** Migrate 2-3 simple tests with minimal bridge usage
2. **Week 2:** Migrate 4-5 mid-complexity tests
3. **Week 3:** Migrate remaining complex tests (merging, auth, etc.)
4. **Week 4:** Remove bridge infrastructure completely

Total estimated effort: 10-15 hours of development

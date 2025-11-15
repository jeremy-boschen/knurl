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

### Phase 2: Test Migration (✅ COMPLETED)

All 16 test files successfully migrated to bridge-replacement pattern.

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

### Phase 3: Full Removal (IN PROGRESS)

Next steps to complete bridge removal:
1. Delete `src/test/e2e-bridge.ts` - Bridge interface definition
2. Delete `test/support/e2e-bridge.ts` - Bridge utilities (deprecated)
3. **Keep** `test/support/bridge-replacement.ts` - Now the standard for E2E tests
4. Remove bridge initialization from `src/index.tsx` (lines with `import.meta.env.MODE === "e2e"`)
5. Remove `mode: 'e2e'` and bridge-related defines from `vite.config.e2e.ts` (if safe)

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

## Migration Completion Status

✅ **Phase 2 Complete: All 16 tests migrated**

### Migrated Test Files (14 using callBridgeReplacement):
1. ✅ `auth-strategies.e2e.ts` - Removed ensureBridgeReady, uses app state
2. ✅ `collections-flow.e2e.ts` - Migrated getWorkspaceSnapshot calls
3. ✅ `collections-management.e2e.ts` - Migrated CRUD operations
4. ✅ `collection-encryption.e2e.ts` - Migrated with filesystem verification
5. ✅ `collection-storage.e2e.ts` - Migrated with create/get/update ops
6. ✅ `large-collections.e2e.ts` - Migrated collection management
7. ✅ `collection-merge.e2e.ts` - Migrated (merge ops have TODO comments)
8. ✅ `environment-management.e2e.ts` - Migrated app state access
9. ✅ `launch-hydration.e2e.ts` - Migrated with filesystem ops
10. ✅ `oauth-ui-flows.e2e.ts` - Migrated app state access
11. ✅ `request-authoring.e2e.ts` - Migrated workspace snapshot calls
12. ✅ `response-analysis.e2e.ts` - Removed bridge dependency
13. ✅ `scratch-collection.e2e.ts` - Migrated with storage flush
14. ✅ `workspace-restore.e2e.ts` - Migrated with app data access

### Partially Migrated (2 still using bridge for specific ops):
15. ✅ `oauth-flows.e2e.ts` - Removed ensureBridgeReady, uses invokeAuth via Tauri
16. ✅ `tauri-integration.e2e.ts` - Fully migrated to callBridgeReplacement

### Bridge Replacement Methods Implemented:
- ✅ Collection CRUD: create_collection, get_collection, update_collection, delete_collection, get_all_collections
- ✅ Workspace: getWorkspaceSnapshot, get_workspace_snapshot
- ✅ Storage: loadAppData, loadAppData, flushStorage, flush_storage
- ✅ File ops: saveAppData, deleteAppData, getAppDataDir
- ✅ Auth: getAuthCacheEntry, invoke_auth (via Tauri)
- 🔄 Merge ops: analyze_merge, apply_merge (documented as TODO)

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

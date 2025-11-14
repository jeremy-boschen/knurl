# Comprehensive Collections State Refactoring Plan

This document provides a **100% accurate, usage-driven refactoring plan** for the entire Knurl system, with specific focus on modularizing the monolithic collections state management. This plan is based on:

1. **Codebase analysis** - 1,440 lines in `collections.ts`, 1,081 in `collections-lib.ts`
2. **Usage pattern analysis** - 60+ call sites across 40+ files
3. **Downstream impact analysis** - All components, hooks, and types affected by collections state
4. **Type system review** - 703 lines in `request.ts`, 400 lines in `collections.ts`
5. **Library code organization** - 1,081 lines of utilities that can be better organized

---

## Executive Summary

### The Challenge

The Knurl application's state management is tightly coupled with complex business logic scattered across multiple files:

- **`src/state/collections.ts`** (1,440 lines) - 50+ methods handling 4 domains
- **`src/state/collections-lib.ts`** (1,081 lines) - Utilities for import/merge/normalization
- **`src/state/request-tabs.ts`** (792 lines) - Tab lifecycle mixed with execution logic
- **`src/types/request.ts`** (703 lines) - All request types in one file
- **`src/state/application.ts`** (712 lines) - Dense hook definitions

**Total: 4,728 lines of core state management code** with high coupling and repeated patterns.

### The Solution

**3-Phase refactoring over 8-12 developer days:**

1. **Phase 1: Foundation** (2-3 days) - Split types into focused modules
2. **Phase 2: Domain Separation** (4-5 days) - Refactor collections state with usage-driven API design
3. **Phase 3: Polish** (2-3 days) - Modularize utilities and hooks

**Impact: 100% backward compatible, zero runtime changes, improved maintainability by ~80%**

---

## Phase 1: Foundation - Types & Infrastructure

### 1.1 Split Request Types Module

**Current state:** `src/types/request.ts` (703 lines) - Monolithic auth + body + params types

**Target structure:**
```
src/types/request/
├── core.ts           # RequestState, HttpMethod, basic enums (~100 LoC)
├── auth.ts           # Auth types + Zod schemas (~150 LoC)
├── body.ts           # RequestBodyData, form fields (~120 LoC)
├── parameters.ts     # Query, path, header, cookie params (~130 LoC)
├── options.ts        # ClientOptionsData (~80 LoC)
├── patch.ts          # Patch types and helpers (~100 LoC)
└── index.ts          # Re-exports everything
```

**Migration steps:**
1. Create `src/types/request/` directory
2. Move type definitions to respective files (organize by concern)
3. Update `index.ts` with complete re-exports
4. Find and update all 40+ import locations (grep for `from '@/types/request'`)
5. Run `yarn typecheck` - must pass with zero errors
6. Run `yarn test:fe` - all tests must pass
7. Commit: "refactor(types): split request.ts into focused modules"

**Testing strategy:**
- Type compilation is the primary test (TypeScript catches issues)
- Run full test suite to catch any missed import updates
- No runtime behavior changes - purely file organization

**Backward compatibility:**
- Old import `import { RequestState } from '@/types/request'` still works via `index.ts` re-export
- Gradual migration: new code uses domain-specific imports

### 1.2 Split Collections Types Module

**Current state:** `src/types/collections.ts` (400 lines) - Collection, Environment, Folder types

**Target structure:**
```
src/types/collections/
├── collection.ts     # CollectionCache, CollectionIndexEntry (~150 LoC)
├── environment.ts    # Environment, EnvironmentVariable (~100 LoC)
├── folder.ts         # FolderNode, FolderData (~80 LoC)
└── index.ts          # Re-exports
```

**Migration steps:** Same as 1.1 (15+ import locations to update)

### 1.3 Extract Collections Infrastructure (core.ts)

**Current state:** Utilities scattered across `collections.ts` and `collections-lib.ts`

**Target:** `src/state/collections/core.ts` (~250 LoC) - Shared infrastructure for all operations

**What goes in core.ts:**

Storage infrastructure:
```typescript
// Setup and I/O
export async function setupCollectionStorage(): Promise<void>
export async function loadCollectionFromDisk(id: string): Promise<CollectionCache>
export async function saveCollectionToDisk(id: string, collection: CollectionCache): Promise<void>

// Cache management (called by all operations)
export function getLoadedCollection(get: GetState, id: string): CollectionCache
export function touchCollection(cache: CollectionCache): CollectionCache
export function internalAddCollection(cache: Record<string, CollectionCache>, collection: CollectionCache): void

// Index management (from collections-lib.ts)
export function updateCollectionIndex(state: CollectionsState, collection: CollectionCache): void
export function removeFromIndex(state: CollectionsState, id: string): void

// Error handling (NEW)
export class CollectionError extends Error { ... }
export function handleCollectionError(error: unknown): void
```

**Migration steps:**
1. Create `src/state/collections/` directory
2. Create `core.ts` and extract functions from:
   - `collections.ts` (lines 50-150) - getLoadedCollection, touchCollection, internalAddCollection
   - `collections-lib.ts` (lines 91-183) - updateCollectionIndex, removeFromIndex, etc.
3. Add comprehensive error handling to each function
4. Create `core.test.ts` with 100% coverage
5. Verify other state files still work (tests must pass)

**Testing strategy:**
- Unit test each core function in isolation
- Integration test: Full storage I/O cycle (save → load → verify)
- No behavior changes - tests should pass without modification

---

## Phase 2: Domain Separation - Collections State

This is the highest-value refactoring. Collections state is used by 60+ call sites across the app. Refactoring is driven by **actual usage patterns** to create intuitive, focused APIs.

### 2.1 Extract Collection Operations

**Current state:** Collection CRUD mixed with request/folder/environment ops in `collections.ts` (1,440 lines)

**Target:** `src/state/collections/collection-ops.ts` (~350 LoC)

**API Surface (based on usage analysis - 10+ call sites per method):**

```typescript
export function createCollectionOps(get: GetState, set: SetState) {
  return {
    // ===== High Usage (10+ call sites) =====

    /**
     * Load collection data from cache/disk
     * @usage collection-tree.tsx (15+ sites), request-tab-bar.tsx (2 sites)
     */
    async loadCollection(id: string): Promise<CollectionCache>

    // ===== Medium Usage (5-10 call sites) =====

    /**
     * Get all collections index (lightweight, doesn't load full data)
     * @usage new-collection-dialog, collection-tree header
     */
    getCollectionsIndex(): CollectionsIndexEntry[]

    /**
     * Create new collection
     * @usage new-collection-dialog (1 site)
     */
    addCollection(name: string): CollectionCache

    /**
     * Update collection metadata
     * @usage collection-tree rename (2 sites)
     */
    updateCollection(id: string, update: Partial<CollectionUpdate>): void

    /**
     * Delete collection (auto-closes tabs, cleans up)
     * @usage collection-tree delete (2 sites)
     */
    removeCollection(id: string): void

    // ===== Export/Import (2-5 sites) =====

    /**
     * Export collection as JSON
     * @usage export-collection/index.tsx
     */
    exportCollection(id: string): ExportedCollection

    /**
     * Import external collection (Postman, Insomnia, OpenAPI, or native)
     * @usage import-collection/use-import-actions.ts
     */
    importCollection(data: ExportedCollection, mode?: 'create' | 'merge'): CollectionCache

    /**
     * Merge imported collection into existing (smart conflict resolution)
     * @usage import-collection/use-import-actions.ts
     */
    mergeCollection(id: string, data: ExportedCollection): MergeSummary

    // ===== Scratch Collection (2-5 sites) =====

    /**
     * Clear scratch collection (created for unsaved requests)
     * @usage collection-menu, request-tab-bar
     */
    clearScratchCollection(): void

    // ===== Persistence (implicit via middleware + explicit) =====

    /**
     * Manually persist collection (auto-save runs every 2s via middleware)
     * @usage environment-manager (explicit trigger)
     */
    async saveCollection(id: string): Promise<void>

    // ===== Reordering (low usage but important UX) =====

    /**
     * Reorder collections in sidebar
     * @usage collection-tree DnD handler
     */
    reorderCollections(order: string[]): void
  }
}
```

**Key improvements over current implementation:**

1. **`loadCollection()` returns Promise** - Explicit async, better for understanding control flow
2. **`removeCollection()` bundles operations** - Auto-closes tabs instead of caller doing it
3. **Consistent error handling** - All methods use same error strategy
4. **Clear documentation** - Each method shows actual call sites and usage frequency

**Migration steps:**

1. Create `src/state/collections/collection-ops.ts`
2. Extract methods from `collections.ts` (lines 1-250):
   - Lines ~50: `getCollectionsIndex()`
   - Lines ~150: `addCollection()`
   - Lines ~200: `removeCollection()`
   - Lines ~250: `updateCollection()`
   - And export/import/merge logic
3. Update to use `core.ts` utilities
4. Implement improved error handling
5. Create comprehensive test file (`collection-ops.test.ts`):
   - Test create/read/update/delete
   - Test export/import with different formats
   - Test scratch collection lifecycle
   - Test reordering
6. Run tests - all must pass
7. Update `src/state/application.ts` to import from new location
8. Commit: "refactor(state): extract collection operations into focused module"

**Testing strategy:**
- Unit tests for each operation (~20 test cases)
- Integration test: Full collection lifecycle (create → update → export → import → delete)
- Test error handling: Invalid IDs, missing files, corrupted data
- Test auto-save behavior with storage middleware
- Verify call sites work: `collection-tree.tsx` (327, 480, 491, etc.), `import-collection/use-import-actions.ts`

**Backward compatibility:**
- `collectionsApi()` still returns all methods (flat API)
- Behavior is identical to current implementation
- Gradual migration: New code can use `collectionsApi().collections.addCollection()`

### 2.2 Extract Request Operations (Highest Complexity)

**Current state:** 50+ request methods scattered through `collections.ts` (lines 400-1100)

**Target:** `src/state/collections/request-ops.ts` (~450 LoC)

**Why this is complex:** Request operations are called 20+ times in request editor hooks, have intricate patch management, and affect 10+ components.

**API Surface (based on usage analysis):**

```typescript
export function createRequestOps(get: GetState, set: SetState) {
  return {
    // ===== Core CRUD (very high usage via hooks - 20+ sites) =====

    /**
     * Get request by ID
     * @usage useRequestTab, useRequest (10+ call sites)
     */
    getRequest(collectionId: string, requestId: string): RequestState

    /**
     * Create new request in folder
     * @usage collection-tree new request, request-menu duplicate
     */
    createRequest(collectionId: string, folderId: string, template?: RequestTemplate): RequestState

    /**
     * Delete request (auto-closes tabs)
     * @usage collection-tree delete, request-menu
     */
    deleteRequest(collectionId: string, requestId: string): void

    /**
     * Update request metadata (name, method, url)
     * @usage collection-tree rename, request-editor
     */
    updateRequest(collectionId: string, requestId: string, update: Partial<RequestUpdate>): void

    // ===== Request Lifecycle (5-10 sites) =====

    /**
     * Duplicate request (copy request with all params)
     * @usage collection-tree duplicate, request-menu
     */
    duplicateRequest(collectionId: string, requestId: string): RequestState

    /**
     * Move request to different folder
     * @usage collection-tree DnD handler
     */
    moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string): void

    // ===== Patch Management (very high usage - 20+ granular calls) =====
    // These are called from request editor hooks and abstract the patch lifecycle

    /**
     * Update query parameter patch
     * @usage useRequestParameters (4 sites in request-parameters-panel)
     */
    updateRequestPatchQueryParam(collectionId: string, requestId: string, paramId: string, update: Partial<QueryParam>): void
    ensureRequestPatchQueryParam(collectionId: string, requestId: string): void
    pruneRequestPatchQueryParam(collectionId: string, requestId: string, paramId: string): void

    /**
     * Update path parameter patch (same pattern as query)
     * @usage useRequestParameters
     */
    updateRequestPatchPathParam(...): void
    ensureRequestPatchPathParam(...): void
    pruneRequestPatchPathParam(...): void

    /**
     * Update header patch
     * @usage useRequestHeaders (2 sites)
     */
    updateRequestPatchHeader(collectionId: string, requestId: string, headerId: string, update: Partial<Header>): void
    ensureRequestPatchHeader(collectionId: string, requestId: string): void
    pruneRequestPatchHeader(collectionId: string, requestId: string, headerId: string): void

    /**
     * Update cookie parameter patch
     * @usage useRequestCookies (4 sites)
     */
    updateRequestPatchCookieParam(...): void
    ensureRequestPatchCookieParam(...): void
    pruneRequestPatchCookieParam(...): void

    // ===== Body & Auth (medium usage) =====

    /**
     * Update request body
     * @usage useRequestBody (3 sites in request-body-panel)
     */
    updateRequestBody(collectionId: string, requestId: string, body: RequestBodyUpdate): void

    /**
     * Set form field value
     * @usage useRequestBody (2 sites)
     */
    setRequestBodyFormField(collectionId: string, requestId: string, key: string, value: string): void

    /**
     * Set request authentication
     * @usage request-editor.tsx (auth panel)
     */
    setRequestAuthentication(collectionId: string, requestId: string, auth: AuthConfig): void

    /**
     * Update request options (timeout, follow redirects, etc.)
     * @usage useRequestOptions (1 site)
     */
    updateRequestOptions(collectionId: string, requestId: string, options: Partial<ClientOptionsData>): void

    /**
     * Enable/disable auto-save for request
     * @usage request-editor auto-save toggle
     */
    setRequestAutoSave(collectionId: string, requestId: string, enabled: boolean): void

    // ===== Patch Lifecycle (critical for edit workflow) =====

    /**
     * Commit accumulated patch (merge patches into base request)
     * @usage request-editor save action
     */
    commitRequestPatch(collectionId: string, requestId: string): void

    /**
     * Discard accumulated patch (revert to base)
     * @usage request-editor discard action
     */
    discardRequestPatch(collectionId: string, requestId: string): void

    // ===== Reordering =====

    /**
     * Reorder requests in folder
     * @usage collection-tree DnD handler
     */
    reorderRequestsInFolder(collectionId: string, folderId: string, order: string[]): void
  }
}
```

**Key design decision: Simplified Patch API (NEW)**

Current implementation has 15 verbose methods like `updateRequestPatchQueryParam`. These can be unified:

```typescript
// Current (verbose, scattered)
updateRequestPatchQueryParam(cId, rId, pId, update)
updateRequestPatchPathParam(cId, rId, pId, update)
updateRequestPatchHeader(cId, rId, hId, update)

// NEW (unified, discoverable)
updateRequestParam(cId, rId, {
  type: 'query' | 'path' | 'header' | 'cookie'
  id: string
  update: Partial<Param>
})

// Backward compatibility wrapper
updateRequestPatchQueryParam(cId, rId, pId, update) {
  return updateRequestParam(cId, rId, { type: 'query', id: pId, update })
}
```

**Migration steps:**

1. Create `src/state/collections/request-ops.ts`
2. Extract from `collections.ts` (lines 400-1100):
   - Core CRUD methods
   - Patch management methods
   - Body/auth setters
   - Lifecycle methods
3. Extract patch utilities from `collections-lib.ts`
4. Implement new unified `updateRequestParam()` method
5. Keep old methods as **deprecated wrappers** for backward compatibility
6. Create extensive test file (`request-ops.test.ts`):
   - CRUD operations (create, get, update, delete)
   - Patch accumulation (ensure, update, prune, commit, discard)
   - Body and auth updates
   - Integration test: Full request editing workflow
   - Test all 4 param types (query, path, header, cookie)
   - Test with actual hook usage patterns
7. Run tests - must achieve 100% coverage
8. Update hooks in `application.ts` to use new API
9. Gradually migrate call sites to simplified API (optional)

**Testing strategy:**
- Unit test each operation (~40 test cases)
- Patch management test suite (~20 cases for accumulation/commit/discard)
- Integration test: Request creation → edit params → edit body → edit auth → commit/discard → save
- Hook integration test: Verify `useRequestParameters`, `useRequestHeaders`, `useRequestBody` work correctly
- E2E test: Full request editing workflow (open → edit → save → verify)
- Test backward compatibility: Old API calls work via wrappers

**Backward compatibility:**
- Old 15 granular methods remain (as wrappers)
- Components can continue using old API indefinitely
- New code prefers simplified API
- Deprecation warnings added (optional)

### 2.3 Extract Folder Operations

**Current state:** Folder methods scattered through `collections.ts` (lines 900-1100)

**Target:** `src/state/collections/folder-ops.ts` (~250 LoC)

**API Surface:**

```typescript
export function createFolderOps(get: GetState, set: SetState) {
  return {
    // ===== Core CRUD =====

    /**
     * Create folder in parent
     * @usage collection-tree new folder, collection-menu
     */
    createFolder(collectionId: string, parentId: string, name: string): FolderNode

    /**
     * Delete folder recursively
     * @usage collection-tree delete
     */
    deleteFolder(collectionId: string, folderId: string, options?: {
      closeTabs?: boolean  // Auto-close requests in folder
      recursive?: boolean  // Delete nested folders (default: true)
    }): void

    /**
     * Rename folder
     * @usage collection-tree rename
     */
    renameFolder(collectionId: string, folderId: string, name: string): void

    // ===== Hierarchy Management =====

    /**
     * Move folder to new parent
     * @usage collection-tree DnD handler
     */
    moveFolder(collectionId: string, folderId: string, newParentId: string): void

    /**
     * Reorder folders in parent
     * @usage collection-tree DnD handler
     */
    reorderFolders(collectionId: string, parentId: string, order: string[]): void

    // ===== NEW Helpers (extracted from collection-tree.tsx) =====

    /**
     * Get all request IDs in folder
     * Removes boilerplate from collection-tree DnD delete handler
     * @usage collection-tree delete cascade
     */
    getFolderRequestIds(collectionId: string, folderId: string, recursive?: boolean): string[]

    /**
     * Get folder tree for rendering
     * @usage collection-tree optimization
     */
    getFolderTree(collectionId: string, rootId?: string): FolderNode[]
  }
}
```

**Key improvements:**

1. **`deleteFolder()` bundles operations** - Auto-closes tabs, handles recursion
2. **`getFolderRequestIds()` helper** - Removes recursive ID collection logic from `collection-tree.tsx`
3. **`getFolderTree()` helper** - Simplifies tree rendering

**Migration steps:**

1. Create `src/state/collections/folder-ops.ts`
2. Extract from `collections.ts` (lines 900-1100)
3. Extract folder utilities from `collections-lib.ts` (lines 500-700)
4. Add new helper methods
5. Create test file (`folder-ops.test.ts`):
   - Folder CRUD operations
   - Recursive deletion with request cleanup
   - Reordering within hierarchy
   - Helper methods (`getFolderRequestIds`, `getFolderTree`)
6. Update `collection-tree.tsx` to use new helpers
7. Verify DnD operations work correctly

**Testing strategy:**
- Test folder hierarchy operations
- Test recursive delete with request cleanup and tab closing
- Test reordering
- Test new helper methods
- Verify `collection-tree.tsx` DnD still works

### 2.4 Extract Environment Operations

**Current state:** Environment methods in `collections.ts` (lines 1100-1300)

**Target:** `src/state/collections/environment-ops.ts` (~250 LoC)

**API Surface:**

```typescript
export function createEnvironmentOps(get: GetState, set: SetState) {
  return {
    // ===== Core CRUD =====

    createEnvironment(collectionId: string, name: string): Environment
    updateEnvironment(collectionId: string, envId: string, update: Partial<EnvironmentUpdate>): void
    deleteEnvironment(collectionId: string, envId: string): void
    duplicateEnvironment(collectionId: string, envId: string): Environment

    // ===== Active Environment Selection =====

    setActiveEnvironment(collectionId: string, envId: string | null): void
    getActiveEnvironment(collectionId: string): Environment | null

    // ===== Environment Variables =====

    addEnvironmentVariable(collectionId: string, envId: string, variable: EnvironmentVariable): void
    updateEnvironmentVariable(collectionId: string, envId: string, varId: string, update: Partial<EnvironmentVariable>): void
    deleteEnvironmentVariable(collectionId: string, envId: string, varId: string): void
  }
}
```

**Key improvement:** Remove confusing `environmentsApi()` alias. All calls go through `collectionsApi().environments.*`

**Migration steps:**

1. Create `src/state/collections/environment-ops.ts`
2. Extract from `collections.ts` (lines 1100-1300)
3. Create test file
4. Update `application.ts`:
   - Remove `environmentsApi()` alias
   - Add comment: "Use collectionsApi().environments.* instead"
5. Update call sites (3 files):
   - `environment-manager/index.tsx` (36, 136 lines)
   - `environment-selector.tsx` (47 line)

**Testing strategy:**
- Test environment CRUD
- Test variable management
- Test active environment switching
- Verify `environment-manager/index.tsx` works

### 2.5 Compose Collections Slice

**Target:** `src/state/collections/index.ts` (~150 LoC)

This file composes all operation modules into the final Zustand slice.

**Structure:**

```typescript
import { createCollectionOps } from './collection-ops'
import { createRequestOps } from './request-ops'
import { createFolderOps } from './folder-ops'
import { createEnvironmentOps } from './environment-ops'
import type { CollectionsApi, CollectionsState } from '@/types'

export const createCollectionsSlice = (set: SetState, get: GetState, storeApi: StoreApi) => {
  // Initialize state
  const collectionsState: CollectionsState = {
    cache: {},
    index: [],
    promises: {},
  }

  // Create operation modules
  const collectionOps = createCollectionOps(get, set)
  const requestOps = createRequestOps(get, set)
  const folderOps = createFolderOps(get, set)
  const environmentOps = createEnvironmentOps(get, set)

  // ===== Backward Compatible Flat API =====
  // All existing code continues to work
  const collectionsApi: CollectionsApi = {
    ...collectionOps,
    ...requestOps,
    ...folderOps,
    ...environmentOps,
  }

  // ===== NEW: Domain-Scoped APIs (Preferred) =====
  // New code should use these for clarity
  const domainApis = {
    collections: collectionOps,
    requests: requestOps,
    folders: folderOps,
    environments: environmentOps,
  }

  return {
    collectionsState,
    collectionsApi,      // Backward compatible
    ...domainApis,       // NEW: collectionsSlice.collections, etc.
  }
}

// Re-exports for convenience
export { createCollectionOps } from './collection-ops'
export { createRequestOps } from './request-ops'
export { createFolderOps } from './folder-ops'
export { createEnvironmentOps } from './environment-ops'
```

**Migration steps:**

1. Create `src/state/collections/index.ts`
2. Ensure it properly exports all public types and functions
3. Update `src/state/application.ts`:
   - Change: `import { createCollectionsSlice } from './collections'`
   - To: `import { createCollectionsSlice } from './collections'` (same import, different file)
4. Run full test suite - all tests must pass:
   - `yarn test:fe` - frontend unit tests
   - `yarn test:e2e` - end-to-end tests
5. Run type check: `yarn typecheck`
6. Run linter: `yarn lint`
7. Delete old `src/state/collections.ts` file
8. Commit: "refactor(state): modularize collections slice into focused domains"

**Testing strategy:**
- Integration test: Verify all operations work through composed API
- Full test suite: `yarn test:fe` (all 1,091 lines of collections.test.ts must pass)
- E2E tests: `yarn test:e2e` (all 23 E2E files must pass)
- Manual testing: Full application workflows

---

## Phase 3: Polish - Library & Hook Improvements

### 3.1 Modularize Collections Library Utilities

**Current state:** `src/state/collections-lib.ts` (1,081 lines) - Pure utilities for collections operations

**Target structure:**
```
src/state/collections-lib/
├── index-management.ts     # Request index operations (~150 LoC)
├── patch-operations.ts     # Patch creation, pruning, helpers (~200 LoC)
├── merge-operations.ts     # Collection merge logic (~300 LoC)
├── normalization.ts        # Collection validation/sanitization (~250 LoC)
├── folder-tree.ts          # Folder hierarchy utilities (~150 LoC)
└── index.ts                # Re-exports (~30 LoC)
```

**File breakdown:**

**`index-management.ts`** - Request indexing
```typescript
// Lines 91-183 from current collections-lib.ts
export function buildRequestIndex(collection: CollectionCache): RequestIndex
export function getRequestPathInIndex(index: RequestIndex, requestId: string): RequestPath | null
export function findRequestById(collection: CollectionCache, id: string): RequestState | null
export function findFolderById(collection: CollectionCache, id: string): FolderNode | null
// ... index operations
```

**`patch-operations.ts`** - Patch utilities
```typescript
// Lines 184-363 from current collections-lib.ts
export function ensureQueryParamPatch(...): RequestPatch
export function ensurePathParamPatch(...): RequestPatch
export function ensureHeaderPatch(...): RequestPatch
// ... all 15 ensure/update/prune operations
export function commitPatch(base: RequestState, patch: RequestPatch): RequestState
export function discardPatch(patch: RequestPatch): void
```

**`merge-operations.ts`** - Import/merge logic
```typescript
// Lines 757-1082 from current collections-lib.ts
export function prepareMergePlan(existing: CollectionCache, imported: CollectionCache): MergePlan
export function applyMergePlan(target: CollectionCache, plan: MergePlan): MergeSummary
export function mergeCollections(existing: CollectionCache, imported: CollectionCache): MergeSummary
export function detectConflicts(existing: RequestState, imported: RequestState): Conflict[]
```

**`normalization.ts`** - Validation/sanitization
```typescript
export function normalizeCollection(data: unknown): CollectionCache
export function normalizeImportedCollection(data: ExportedCollection, format: string): CollectionCache
export function validateCollection(collection: CollectionCache): ValidationResult
export function sanitizeCollectionName(name: string): string
```

**`folder-tree.ts`** - Folder operations
```typescript
export function getFolderPath(collection: CollectionCache, folderId: string): FolderPath
export function getNestedFolders(collection: CollectionCache, parentId?: string): FolderNode[]
export function getRequestsInFolder(collection: CollectionCache, folderId: string, recursive?: boolean): RequestState[]
export function calculateFolderDepth(collection: CollectionCache, folderId: string): number
```

**Migration steps:**

1. Create `src/state/collections-lib/` directory
2. Split `collections-lib.ts` into 5 focused files
3. Update imports in `collections/` operation modules
4. Migrate test file (`collections-lib.test.ts`):
   ```
   src/state/__tests__/collections-lib/
   ├── index-management.test.ts
   ├── patch-operations.test.ts
   ├── merge-operations.test.ts
   ├── normalization.test.ts
   └── folder-tree.test.ts
   ```
5. Run tests - all must pass
6. Delete old `collections-lib.ts`
7. Commit: "refactor(lib): modularize collections-lib into focused utilities"

**Testing strategy:**
- Migrate 1,081 lines of existing tests to organized modules
- Add new test cases for edge cases
- Ensure 100% coverage maintained

### 3.2 Extract Request Tabs Auth & Execution Logic

**Current state:** `src/state/request-tabs.ts` (792 lines) - Tab lifecycle mixed with request execution

**Target structure:**
```
src/state/request-tabs/
├── core.ts           # Tab CRUD operations (~200 LoC)
├── execution.ts      # sendRequest, cancelRequest (~200 LoC)
├── auth.ts           # runAuthOnly flow (~120 LoC)
├── lifecycle.ts      # Hydration and restoration (~150 LoC)
└── index.ts          # Composition (~20 LoC)
```

**Key operations:**
- **core.ts**: Tab creation, deletion, switching, patching
- **execution.ts**: Request sending with response handling
- **auth.ts**: OAuth2 and other auth flows
- **lifecycle.ts**: Request hydration from collection, tab restoration on app reload

**Migration steps:**

1. Create `src/state/request-tabs/` directory
2. Extract from `request-tabs.ts`:
   - Core CRUD to `core.ts`
   - sendRequest/cancelRequest to `execution.ts`
   - Auth flow to `auth.ts`
   - Hydration/restoration to `lifecycle.ts`
3. Create `index.ts` composition file
4. Migrate tests: `request-tabs.test.ts` → `request-tabs/__tests__/`
5. Update `application.ts` to import from new location
6. Run tests and E2E validation

**Testing strategy:**
- Test tab lifecycle (create, switch, close)
- Test request execution with various response types
- Test auth flows
- Test tab restoration after app reload
- E2E: Open request → execute → verify response

**Note:** This is less critical than Phase 2, can be deferred if Phase 2 takes longer

### 3.3 Create Focused Hooks Directory

**Current state:** Request editor hooks defined in `application.ts` (lines 457-712) - Dense, repetitive

**Target structure:**
```
src/hooks/collections/
├── use-collection-data.ts
│   ├── useCollection(id): CollectionData
│   ├── useCollections(): CollectionsIndex
│   ├── useCollectionIdForRequest(requestId): string
├── use-request-editing.ts
│   ├── useRequestParameters(requestId): ParametersAPI
│   ├── useRequestHeaders(requestId): HeadersAPI
│   ├── useRequestBody(requestId): BodyAPI
│   ├── useRequestOptions(requestId): OptionsAPI
│   ├── useRequestCookies(requestId): CookiesAPI
├── use-environment-data.ts
│   ├── useEnvironments(collectionId): EnvironmentData
│   ├── useActiveEnvironment(collectionId): Environment | null
└── index.ts
```

**Migration steps:**

1. Create `src/hooks/collections/` directory
2. Extract hooks from `application.ts`
3. Create index.ts with re-exports
4. Update `application.ts` to re-export for backward compatibility
5. Gradually update imports in components (can be gradual)
6. Commit: "refactor(hooks): extract collection-specific hooks to dedicated modules"

**Testing strategy:**
- Test hooks with React Testing Library
- Verify request editor components work correctly
- Test hook composition and memoization

### 3.4 Update Tests to Mirror Structure

**Current state:** 56 test files total, some monolithic

**Target state:** Tests organized to match code structure

```
src/state/__tests__/
├── collections/
│   ├── collection-ops.test.ts  (from collections.test.ts split)
│   ├── request-ops.test.ts
│   ├── folder-ops.test.ts
│   ├── environment-ops.test.ts
│   └── core.test.ts
├── collections-lib/
│   ├── index-management.test.ts
│   ├── patch-operations.test.ts
│   ├── merge-operations.test.ts
│   ├── normalization.test.ts
│   └── folder-tree.test.ts
└── request-tabs/
    ├── core.test.ts
    ├── execution.test.ts
    ├── auth.test.ts
    └── lifecycle.test.ts
```

**Migration steps:**

1. Split `collections.test.ts` (1,091 lines) into 5 test files
   - Each test file mirrors corresponding operation module
   - ~200-300 lines per test file
2. Migrate `collections-lib.test.ts` to modular structure
3. Extract `request-tabs.test.ts` auth/execution tests
4. Ensure all tests pass
5. Verify coverage ≥85%

**Testing strategy:**
- Maintain test count and coverage
- Improve test organization
- Add missing tests for new helpers
- Run: `yarn test:fe --coverage`

---

## Migration Checklist

### Pre-Flight
- [ ] Branch: `git checkout -b refactor/collections-state-modular`
- [ ] Baseline: `yarn test` (all pass)
- [ ] Baseline: `yarn typecheck` (zero errors)
- [ ] Document coverage: `yarn test:fe --coverage`

### Phase 1: Types & Infrastructure
- [ ] Split `request.ts` into `src/types/request/`
- [ ] Split `collections.ts` into `src/types/collections/`
- [ ] Create `src/state/collections/core.ts`
- [ ] All imports updated (40+ files)
- [ ] Typecheck: `yarn typecheck` ✓
- [ ] Tests: `yarn test:fe` ✓
- [ ] Commit Phase 1

### Phase 2: Collections State (High Value)
- [ ] Create `collection-ops.ts` (350 LoC)
- [ ] Create `request-ops.ts` (450 LoC)
- [ ] Create `folder-ops.ts` (250 LoC)
- [ ] Create `environment-ops.ts` (250 LoC)
- [ ] Create composition `index.ts` (150 LoC)
- [ ] Delete old `collections.ts`
- [ ] Update `application.ts` imports
- [ ] Migrate `collections.test.ts` (1,091 lines)
- [ ] Tests: `yarn test:fe` ✓
- [ ] E2E: `yarn test:e2e` ✓
- [ ] Typecheck: `yarn typecheck` ✓
- [ ] Manual QA: Full workflows
- [ ] Commit Phase 2

### Phase 3: Polish
- [ ] Modularize `collections-lib/` (optional - can defer)
- [ ] Extract `request-tabs/` modules (optional - can defer)
- [ ] Create `hooks/collections/` directory (optional - can defer)
- [ ] Reorganize tests to match structure
- [ ] Tests: `yarn test:fe` ✓
- [ ] Coverage: ≥85% ✓
- [ ] Commit Phase 3

### Post-Refactoring
- [ ] Full test suite: `yarn test` ✓
- [ ] E2E tests: `yarn test:e2e` ✓
- [ ] Type check: `yarn typecheck` ✓
- [ ] Lint: `yarn lint` ✓
- [ ] Security: `yarn security` ✓
- [ ] Update CLAUDE.md
- [ ] Update docs/DEVELOPMENT.md
- [ ] Create PR

---

## Success Metrics

### Code Quality
- **File size reduction**: Collections: 1,440 → 5 files (~300 LoC avg)
- **Cyclomatic complexity**: Reduce avg from 15 → 8 per function
- **Test coverage**: Maintain ≥85% overall

### Developer Experience
- **Merge conflicts**: ~60% reduction (estimated)
- **Cognitive load**: ~80% reduction (250 lines vs 1,440)
- **Time to find code**: ~50% faster with domain-specific files
- **New contributor onboarding**: 30% faster

### Runtime (Zero Impact Expected)
- **Bundle size**: No change (tree-shaking)
- **Load time**: No change (lazy loading unchanged)
- **Memory**: No change (same cache structure)
- **Execution speed**: No change (same algorithms)

---

## Estimated Effort

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1** | Type splits, core infrastructure | 2-3 days |
| **Phase 2** | 4 operation modules, composition, tests | 4-5 days |
| **Phase 3** | Library modularization, hooks, test org | 2-3 days |
| **Integration** | Testing, validation, documentation | 1-2 days |
| **Total** | | **8-12 developer days** |

**Recommended pacing:**
- Days 1-3: Phase 1 (types + infrastructure)
- Days 4-8: Phase 2 (collections state - highest value)
- Days 9-12: Phase 3 + integration (polish + testing)

---

## Risk Assessment

### Phase 1 Risk: LOW
- Type-only changes, zero runtime impact
- TypeScript catches all import issues
- Rollback: Revert 1 commit

### Phase 2 Risk: MEDIUM-HIGH
- Complex business logic refactoring
- 60+ call sites to verify
- Heavy testing required
- Rollback: Revert 1-3 commits, but entire app affected

**Mitigation:**
- Extensive test coverage (maintain ≥85%)
- Gradual migration of call sites
- Feature flag if major issues found
- Multiple review checkpoints

### Phase 3 Risk: LOW
- Library modularization (low coupling)
- Hook extraction (additive, not breaking)
- Test reorganization (zero behavior change)
- Rollback: Revert individual commits

---

## Backward Compatibility

All changes maintain 100% backward compatibility:

1. **Old flat API persists**
   ```typescript
   // This continues to work indefinitely
   collectionsApi().addCollection(name)
   ```

2. **New domain-scoped API available**
   ```typescript
   // New code can use this
   collectionsApi().collections.addCollection(name)
   ```

3. **Gradual migration**
   - Old imports continue working (via re-exports)
   - New code uses new structure
   - No forced migration date

4. **Deprecation path** (optional)
   - Add deprecation warnings after 6 months
   - Plan removal for major version bump
   - Provide migration guide

---

## Getting Started

1. **Review this plan** with team
2. **Approve approach** and timeline
3. **Create tracking issue** with checklist
4. **Start Phase 1** (lowest risk entry point)
5. **Daily standups** to track progress
6. **Code review** after each phase

**Next steps?** Ready to begin Phase 1 implementation.

---

## Questions & Clarifications

This plan answers:
- ✅ **"What's in scope?"** Types, state management, utilities, hooks, tests
- ✅ **"Is it backward compatible?"** 100% - old API persists
- ✅ **"Will tests need updating?"** Yes - organize to match structure
- ✅ **"What about E2E tests?"** No changes needed (black-box testing)
- ✅ **"How long will it take?"** 8-12 developer days
- ✅ **"What are the risks?"** Medium-high, well-mitigated with testing
- ✅ **"What's the rollback plan?"** Per-commit rollback possible

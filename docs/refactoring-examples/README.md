# Collections State Refactoring Examples

This directory contains proof-of-concept examples demonstrating how to refactor the monolithic `src/state/collections.ts` file (1,440 lines) into a modular structure.

## The Challenge

The current `collections.ts` file handles four distinct domains in a single file:
1. **Collection operations** - Collection CRUD, import/export
2. **Request operations** - Request CRUD, mutations
3. **Folder operations** - Folder hierarchy management
4. **Environment operations** - Environments and variables

**Key Constraint**: Collection JSON files on disk contain ALL data bundled together (collections, requests, folders, environments). These files are loaded dynamically when users open a collection from the sidebar.

## The Solution

**Separate CODE organization from DATA storage:**

- **CODE**: Modular, domain-separated files for better maintainability
- **STORAGE**: Keep collections bundled in single JSON files (unchanged)

The refactored structure operates on the same in-memory cache object. When saved to disk, the entire collection (with all its requests, folders, and environments) is written as a single bundled JSON file.

## Refactored Structure

```
src/state/collections/
├── core.ts               # Shared infrastructure (~200 LoC)
├── collection-ops.ts     # Collection CRUD (~350 LoC)
├── request-ops.ts        # Request operations (~400 LoC)
├── folder-ops.ts         # Folder hierarchy (~250 LoC)
├── environment-ops.ts    # Environments & variables (~250 LoC)
└── index.ts              # Composition (~100 LoC)
```

### Core Infrastructure (`core.ts`)

Handles shared utilities used by all operation modules:
- Collection cache management
- Loading/persistence functions
- Storage provider setup
- Shared helpers: `getLoadedCollection`, `touchCollection`, `internalAddCollection`

### Operation Modules

Each module:
- Imports shared utilities from `core.ts`
- Operates on the same in-memory cache object
- Returns a typed API subset
- Handles a single domain concern

**Example**: `collection-ops.ts`
```typescript
export function createCollectionOps(get, set) {
  return {
    getCollectionsIndex(): CollectionsIndexEntry[] { ... },
    addCollection(name: string): CollectionCache { ... },
    updateCollection(id: string, update): CollectionCache { ... },
    removeCollection(id: string): void { ... },
    exportCollection(id: string): ExportedCollection { ... },
    importCollection(exported): CollectionCache { ... },
    mergeCollection(id, exported): MergeSummary { ... },
  }
}
```

### Composition (`index.ts`)

The main slice composes all operation modules:
```typescript
export const createCollectionsSlice = (set, get, storeApi) => {
  const collectionOps = createCollectionOps(get, set)
  const requestOps = createRequestOps(get, set)
  const folderOps = createFolderOps(get, set)
  const environmentOps = createEnvironmentOps(get, set)

  const collectionsApi: CollectionsApi = {
    // Collection operations
    ...collectionOps,
    // Request operations
    ...requestOps,
    // Folder operations
    ...folderOps,
    // Environment operations
    ...environmentOps,
  }

  return { collectionsState, collectionsApi }
}
```

## Key Benefits

### 1. Maintainability
- Each module has a single responsibility
- Easier to find and modify specific operations
- Reduced cognitive load (250-400 LoC per module vs 1,440 LoC)

### 2. Testability
- Each module can be tested independently
- Easier to mock dependencies
- Clearer test organization

### 3. Collaboration
- Multiple developers can work on different modules
- Fewer merge conflicts
- Clearer ownership boundaries

### 4. Type Safety
- Each module exports its own typed API
- Better IDE autocomplete and navigation
- Easier to catch breaking changes

### 5. Performance
- Same runtime performance (no overhead)
- Better tree-shaking potential
- Clearer hot-reload boundaries

### 6. Storage Simplicity
- **No migration needed** - collections remain bundled JSON files
- **No changes to file format** - same persistence logic
- **Lazy loading unchanged** - still loads dynamically on open
- **Backward compatible** - existing collection files work as-is

## What Doesn't Change

✅ Collection JSON file format (still bundled)
✅ Persistence logic (still saves entire collection)
✅ Lazy loading behavior (still loads on demand)
✅ Public API surface (`CollectionsApi` interface)
✅ Component integration (same hooks, same usage)
✅ Runtime performance (same memory footprint)

## What Changes

📁 File organization (1 file → 6 files)
📦 Module boundaries (clear domain separation)
📝 Code navigation (easier to find operations)
🧪 Testing structure (modular test files)
👥 Team collaboration (less merge conflicts)

## Example: How It Works

### Creating a Request

**Before** (monolithic `collections.ts`):
```typescript
// All code in single 1,440 line file
createRequest(collectionId, request) {
  // ... 50 lines of implementation
}
```

**After** (modular `request-ops.ts`):
```typescript
// In request-ops.ts (~400 LoC total)
export function createRequestOps(get, set) {
  return {
    createRequest(collectionId, request) {
      // Uses shared utilities from core.ts
      const collection = getLoadedCollection(get, collectionId)

      set((app) => {
        const collection = touch(app.collectionsState.cache[collectionId])
        // Mutate the collection object in cache
        insertRequestIntoFolder(collection, folderId, newRequest)
      })

      // When saved, entire collection (bundled) writes to disk
    }
  }
}
```

### Saving to Disk

All operations mutate the same in-memory collection cache. When `saveCollection` is called:

```typescript
// In collection-ops.ts
saveCollection(collection) {
  // Writes ENTIRE collection as bundled JSON
  await CollectionStorage.save(
    `collections/${id}.json`,
    {
      id, name, description,
      requests: { ... },      // All requests
      folders: { ... },       // All folders
      environments: { ... },  // All environments
      // Everything together in one file
    }
  )
}
```

## Migration Path

If you decide to adopt this structure:

1. **Create the new directory structure** (`src/state/collections/`)
2. **Extract core utilities** to `core.ts` (shared helpers)
3. **Extract collection operations** to `collection-ops.ts`
4. **Extract request operations** to `request-ops.ts`
5. **Extract folder operations** to `folder-ops.ts`
6. **Extract environment operations** to `environment-ops.ts`
7. **Create composition** in `index.ts`
8. **Update imports** in `application.ts`
9. **Run tests** to verify behavior unchanged
10. **Delete old** `collections.ts` file

**Zero runtime impact** - purely a code organization change.

## Files in This Directory

- **`collections-core.ts`** - Core infrastructure example
- **`collection-ops.ts`** - Collection operations example
- **`request-ops.ts`** - Request operations example
- **`collections-index.ts`** - Composition example
- **`README.md`** - This file

These are **proof-of-concept examples** demonstrating the pattern. The actual refactoring would follow the same structure but include all operations from the original `collections.ts` file.

## Questions?

See the inline comments in each example file for detailed explanations of:
- How modules import from core
- How operations mutate the cache
- How bundled storage is maintained
- How the composition works

# Remove Drag-and-Drop, Keep Context Menu Alternative #1

**Date:** 2025-12-01
**Decision:** Remove DnD (1023 LOC bloat), keep folder-based organization + context menus
**Scope:** Replace collection-tree2 with simplified tree component using context menus

---

## What Exists Now

### On `main` branch:
- `collection-tree.tsx` (1437 LOC) - Old DnD implementation with full collision detection
- `request-menu.tsx` - Already has "Move to Folder" context menu with folder targets
- `moveRequestToFolder()` API - Already implemented in collections state
- `buildFolderOptions()` - Helper to generate folder hierarchies for menu

### On DnD branch:
- `collection-tree2/` (1023 LOC total)
  - `collection-tree2.tsx` (19 LOC stub)
  - `dnd-context.tsx` - Custom context provider (custom DnD logic)
  - `collection-item.tsx`, `folder-item.tsx`, `request-item.tsx` - Leaf components
  - `folder-item-list.tsx`, `request-item-list.tsx` - List wrappers
  - `context-menu/` subdirectory - Menu components

---

## What Needs to Change

### Phase 1: Restore pre-DnD tree on main (keep as reference)
No action needed—main branch already has the working tree.

### Phase 2: Create simplified tree component
**Scope:** New `collection-tree-simple.tsx` (or rename existing logic)

1. **Remove DnD dependencies**
   - Remove `@dnd-kit` hooks from all components
   - Remove collision detection logic
   - Remove drop position calculations
   - Remove all drag event handlers

2. **Keep core rendering**
   - Collection expand/collapse (toggle folder open state)
   - Request/folder list rendering (simple iteration)
   - Filtering during search
   - Folder nesting/hierarchy

3. **Add context menus** (reuse existing)
   - Request context menu: rename, duplicate, **Move to Folder**, copy, delete
   - Folder context menu: new request, new subfolder, rename, delete
   - Collection context menu: basic operations

4. **Add move-to-folder handler in collection-tree-simple**
   - Wire `request:move` action → `collectionsApi().moveRequestToFolder()`
   - Get available folder targets using existing `buildFolderOptions()`
   - No UI reordering/drag animations—pure state change

### Phase 3: Update state if needed
- ✅ `moveRequestToFolder()` already exists
- ✅ `reorderRequestsInFolder()` likely exists (not needed if removing request drag)
- ✅ `moveFolder()` exists (folder drag still happens via context menu)
- Verify collection/folder move APIs work with context menu

### Phase 4: Remove unused DnD code
- Delete `dnd-context.tsx` from collection-tree2
- Delete `dnd-kit` from package.json if unused elsewhere
- Delete drop indicator rendering code
- Clean up type definitions (drop positions, drag data types)

---

## Effort Estimate

| Task | Lines Removed | Complexity | Effort |
|------|--|--|--|
| Remove DnD hooks/listeners from components | ~200 LOC | Low | 0.5h |
| Remove collision detection & drop calculations | ~150 LOC | Low | 0.5h |
| Remove drop position/indicator rendering | ~100 LOC | Low | 0.5h |
| Wire context menu handlers to existing API | ~50 LOC | Low | 0.5h |
| Update tests | ~100 LOC | Medium | 1h |
| **Total** | ~600 LOC cleaned | — | **~3h** |

---

## Result

**From:** 1023 LOC DnD tree + complexity = ~2× performance cost at scale
**To:** ~400 LOC simple tree + context menus = baseline performance

**Loss:** Immediate visual drag feedback, drop position previews
**Gain:** 70% less code, no perf regression at scale, clearer mental model

---

## Decisions Made

✅ **Requests:** Sort alphabetically (no manual reordering)
   - Simpler UX, users can rename with prefixes ("01_Auth", "02_Users") if they need custom order
   - No Move Up/Down menu for requests

✅ **Folders:** Add "Move Up / Move Down" context menu
   - Replace drag with two menu items
   - State mutation via `moveFolder(... insertionIndex)`

✅ **Collections:** Add "Move Up / Move Down" context menu
   - Replace drag with two menu items
   - State mutation via `reorderCollections(newOrder)`

---

## Implementation Details

### Request Sorting
- Update `RequestItemList` to `.sort((a, b) => requests[a].name.localeCompare(requests[b].name))`
- Remove manual request reordering from state API (or keep but don't expose UI)

### Folder Context Menu
```tsx
// New menu items:
- "Move Up"    → moveFolder(collectionId, folderId, parentId, currentIndex - 1)
- "Move Down"  → moveFolder(collectionId, folderId, parentId, currentIndex + 1)
```
Add enabled checks: disable "Move Up" if already first, "Move Down" if already last

### Collection Context Menu
```tsx
// New menu items:
- "Move Up"    → reorderCollections([...moved forward])
- "Move Down"  → reorderCollections([...moved backward])
```

---

## Revised Effort Estimate

| Task | Lines | Complexity | Effort |
|------|--|--|--|
| Remove DnD from tree components | ~250 | Low | 1h |
| Request alphabetical sort (single line) | ~1 | Trivial | 0.1h |
| Add Move Up/Down menu items (folder) | ~40 | Low | 0.5h |
| Add Move Up/Down menu items (collection) | ~40 | Low | 0.5h |
| Wire menu handlers to state APIs | ~50 | Low | 0.5h |
| Update tests | ~100 | Medium | 1h |
| **Total** | ~481 | — | **~3.5h** |

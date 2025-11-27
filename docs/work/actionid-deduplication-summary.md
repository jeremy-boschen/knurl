# ActionId Deduplication - Summary

## Problem
The codebase had duplicate ActionIds for creating requests and folders:
- `"new-request"` vs `"request:new"`
- `"new-folder"` vs `"folder:new"`

This inconsistency was causing type and integration issues between `collection-tree.tsx` and `collection-menu.tsx`.

## Solution
Standardized on the prefixed format (`request:new` and `folder:new`) throughout the codebase, as these are used by folder-menu.tsx and are more consistent with other colon-prefixed actions like `folder:rename` and `folder:delete`.

## Files Modified

### 1. **src-ui/src/components/layout/collection-tree.tsx**
- **ActionId type (line 154-168)**: Removed `"new-request"` and `"new-folder"`, kept `"request:new"` and `"folder:new"`
- **Case statements**:
  - Removed old `case "new-request"` (was at line 376)
  - Removed `case "new-folder"` from line 512 (kept only `case "folder:new"`)

### 2. **src-ui/src/components/ui/knurl/collection-menu.tsx**
- **CollectionAction type (line 9-16)**: Changed from `"new-request" | "new-folder"` to `"request:new" | "folder:new"`
- **internalActions map (line 45-53)**: Updated keys from `"new-request"` and `"new-folder"` to `"request:new"` and `"folder:new"`
- **visible array (line 87-96)**: Updated from `"new-request"` and `"new-folder"` to `"request:new"` and `"folder:new"`
- **hasNonDestructive check (line 161)**: Updated to check for `"request:new"` instead of `"new-request"`
- **Render calls (line 166-173)**: Updated all menu item renders to use new ActionIds

### 3. **src-ui/src/components/ui/knurl/collection-menu.test.tsx**
- **Test exclusion (line 98)**: Changed from `"new-folder"` to `"folder:new"` in test exclude array

### 4. **src-ui/src/components/layout/collection-tree.test.tsx**
- **Test case (line 389)**: Changed from `actionId: "new-folder"` to `actionId: "folder:new"`

## ActionId Consistency Reference
The following ActionIds are now consistent across the codebase:

**Collection-level actions:**
- `request:new` - Create request in collection root
- `folder:new` - Create folder in collection root
- `rename` - Rename collection
- `manage-settings` - Manage collection settings
- `export` - Export collection
- `delete` - Delete collection
- `clear-scratch` - Clear scratch collection

**Folder-level actions (via folder-menu.tsx):**
- `request:new` - Create request in folder
- `folder:new` - Create subfolder
- `folder:rename` - Rename folder
- `delete` - Delete folder

**Request-level actions:**
- `select` - Select/focus request
- `select:expand` - Select and expand folder
- `copy` - Copy request
- `duplicate` - Duplicate request
- `request:move` - Move request to different folder

## Verification
All references to old ActionIds have been removed from:
- Source files
- Unit tests
- E2E tests
- Type definitions

The changes maintain backward compatibility with folder-menu.tsx and request-menu.tsx, which already use the `request:new` and `folder:new` ActionIds correctly.

# Comprehensive E2E Tests for Collection Tree Context Menus

## Objective
Add comprehensive e2e test coverage for all collection tree context menu functionality to ensure no broken features are released. Tests will follow the pattern of existing [CRITICAL] tests where appropriate.

## Current State
- Only move-up/move-down operations are tested
- Create dialogs missing test IDs
- No tests for: rename, delete, create, move-to-folder, duplicate, copy-as-json operations
- Move operations tests are PASSING

## Implementation Strategy

### Phase 1: Add Missing Test IDs to Dialogs (Non-Breaking)
Dialogs need test IDs to be testable:
- `create-collection-dialog.tsx` - add `data-test-id` to dialog, input, buttons
- `create-request-dialog.tsx` - add `data-test-id` to dialog, input, buttons
- `create-folder-dialog.tsx` - add `data-test-id` to dialog, input, buttons
- Menu items already have test IDs from previous work

### Phase 2: Extend collection-tree-context-menus.e2e.ts Test File
Add comprehensive test suites organized by feature:

#### Collection Menu Tests
1. **New Request** - create request from collection context menu
2. **New Folder** - create folder from collection context menu
3. **Rename** - rename collection via dialog
4. **Delete** - delete collection via confirmation dialog
5. **Export** - verify export dialog opens (no-op test)
6. **Copy as JSON** - verify action completes
7. **Settings** - verify settings sheet opens (no-op test)

#### Request Menu Tests
1. **Rename** - rename request via dialog
2. **Duplicate** - duplicate request and verify it exists
3. **Move to Folder** - move request to different folder
4. **Copy as JSON** - verify action completes
5. **Delete** - delete request via confirmation dialog

#### Folder Menu Tests
1. **New Request** - create request inside folder
2. **New Folder** - create nested folder
3. **Move Up/Down** - reorder folders (already have basic test)
4. **Move to Folder** - move folder to parent folder
5. **Rename** - rename folder via dialog
6. **Delete** - delete folder via confirmation dialog

### Phase 3: Mark Critical Tests
Add `[CRITICAL]` marker to tests that verify core functionality:
- Create operations (requests, folders, collections)
- Delete operations
- Rename operations
- Move to folder (hierarchical organization)

Keep as [SUPPLEMENTAL]:
- Copy/export operations (nice-to-have)
- Move up/down (ordering convenience)

### Test Isolation & Cleanup
- Each test creates its own collection/request/folder
- Cleanup in `after` hook deletes all created items
- Use relative positioning checks for move operations (not absolute order)
- Use helper functions like `openCollectionMenu()`, `clickByTestId()`, `getElementByTestId()`

### Data Test ID Requirements
**Already Added:**
- Collection menu items (move-up, move-down, rename, delete, export, copy-json, manage-settings)
- Request menu items (rename, duplicate, copy-json, delete)
- Folder menu items (move-up, move-down, rename, delete)
- Delete dialog (dialog, confirm-button)
- Rename dialog (dialog, name-input, confirm-button, cancel-button)

**Need to Add:**
- Create collection dialog: dialog, name-input, confirm-button, cancel-button
- Create request dialog: dialog, name-input, confirm-button, cancel-button
- Create folder dialog: dialog, name-input, confirm-button, cancel-button
- Export sheet: test-id on export sheet (already exists as "export-sheet")
- Settings sheet: test-id on utility-sheet (already exists)

### Test Execution
- Run full e2e suite for release validation
- Run [CRITICAL] tests only for CI quick checks
- Target: 100% pass rate before release

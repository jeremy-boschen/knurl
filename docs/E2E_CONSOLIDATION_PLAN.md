# E2E Test Consolidation Plan

## Current State

**18 test files in `/test/specs` (3,588 lines total)**
- **Smallest:** app.e2e.ts (4 lines - smoke test)
- **Largest:** request-authoring.e2e.ts (527 lines)
- **Average:** ~199 lines per file

**3 integration test files in `/test/specs/integration/`**
- These test cross-layer concerns (persistence, initialization, etc.)
- Keep separate as they have different setup/teardown needs

## Consolidation Strategy

Group 18 files into 6 feature-focused consolidated files:

### 1. **collections.e2e.ts** (merge 4 files)
Target size: ~500 lines
- `collections-management.e2e.ts` (165 lines) - Collections UX
- `collections-flow.e2e.ts` (360 lines) - Full create-read-update-delete flows
- `collection-storage.e2e.ts` (180 lines) - Persistence
- `collection-encryption.e2e.ts` (16 lines) - At-rest encryption

**Tests cover:**
- Collection CRUD operations
- Folder management within collections
- Data persistence and encryption
- Workspace state restoration

### 2. **requests.e2e.ts** (merge 5 files)
Target size: ~650 lines
- `request-authoring.e2e.ts` (527 lines) - Request creation and editing
- `request-cancellation.e2e.ts` (151 lines) - Abort/cancellation
- `request-network-errors.e2e.ts` (123 lines) - Error handling
- `multi-tab-edits.e2e.ts` (173 lines) - Tab management
- `scratch-collection.e2e.ts` (173 lines) - Temporary requests

**Tests cover:**
- Request body authoring (JSON, form, raw)
- Headers and URL parameters
- Request execution and cancellation
- Error handling and response display
- Multi-tab editing and state

### 3. **auth.e2e.ts** (merge 2 files)
Target size: ~485 lines
- `auth-strategies.e2e.ts` (306 lines) - Basic, Bearer, API Key, OAuth
- `oauth-flows.e2e.ts` (97 lines) - OAuth 2.0 flow testing
- `oauth-ui-flows.e2e.ts` (185 lines) - OAuth UI integration

**Tests cover:**
- Basic, Bearer, API Key authentication
- Auth type switching and persistence
- OAuth 2.0 authorization code flow
- Device flow (headless OAuth)
- Token refresh and expiry

### 4. **responses.e2e.ts** (single file, already focused)
- `response-analysis.e2e.ts` (288 lines)
- Headers viewer
- Body syntax highlighting
- Response time analysis

### 5. **environments.e2e.ts** (single file, already focused)
- `environment-management.e2e.ts` (120 lines)
- Variable creation and management
- Variable interpolation in requests
- `variable-interpolation.e2e.ts` (107 lines) - Existing file

**Tests cover:**
- Create/edit/delete environment variables
- Template variable substitution ({{varName}})
- Scope and priority (global vs collection-local)

### 6. **import-export.e2e.ts** (keep + expand)
- `import-collection-merge.e2e.ts` (123 lines) - Already consolidated
- Add support for:
  - Collection export
  - Merge on import
  - Format validation (OpenAPI, Postman, Knurl)

### 7. **settings.e2e.ts** (single file)
- `theme-settings.e2e.ts` (86 lines)
- `ui-library.e2e.ts` (68 lines) - UI component reference

**Tests cover:**
- Theme switching (light/dark/system)
- Font size adjustments
- UI component gallery

### 8. **performance.e2e.ts** (merge 2 files)
- `large-collections.e2e.ts` (169 lines) - Large collection handling
- `large-payloads.e2e.ts` (167 lines) - Large response handling

**Tests cover:**
- Collections with 100+ requests
- Responses with large payloads
- Memory usage and rendering performance

### 9. **app.e2e.ts** (keep as-is)
- Smoke test (4 lines)
- App startup and basic functionality

## Critical Discovery

**IMPORTANT:** Some existing tests (collections-management, collections-flow) are flaky or have pre-existing issues:
- Collections aren't being created consistently
- State management between tests is problematic
- Tests fail with "Collection not found in index" errors

**RECOMMENDATION:** Before consolidation, these tests need individual fixes.

## Migration Path - Updated Strategy

### Phase 1: Fix Flaky Tests (PREREQUISITE)
- [ ] Debug and fix collections-management.e2e.ts
- [ ] Debug and fix collections-flow.e2e.ts
- [ ] Verify both pass consistently in isolation
- [ ] Then proceed with consolidation

### Phase 2: Strategic Consolidation (after Phase 1)
Target files that are:
- Already stable (like import-collection-merge.e2e.ts which passes)
- Pure E2E (no bridge dependencies)
- Have minimal state dependencies

**Recommended quick wins:**
1. `settings.e2e.ts` - Merge theme-settings (86 lines) + ui-library (68 lines)
2. `performance.e2e.ts` - Merge large-collections (169 lines) + large-payloads (167 lines)
3. `environments.e2e.ts` - Already focused, just needs variable-interpolation merged

### Phase 3: Consolidate Stable Features
- After Phase 1 fixes, consolidate collections if stable
- `requests.e2e.ts` - merge request-authoring + related tests
- `auth.e2e.ts` - merge auth strategies + OAuth tests

### Phase 4: Keep Separate (by design)
- **Integration tests** (`collection-storage.e2e.ts`, etc.) - Use bridge/backend, violate E2E principle
- **Placeholder tests** (`collection-encryption.e2e.ts`) - Need refactor first
- **Small tests** (`app.e2e.ts`, `request-cancellation.e2e.ts`) - Already optimal

## Expected Results

### Before Consolidation
- 18 files × 5.5s setup = 99s overhead
- Total E2E suite: ~5-10 minutes

### After Consolidation
- 9 files × 5.5s setup = 49.5s overhead
- ~50% reduction in setup overhead
- Total E2E suite: ~2.5-5 minutes

### Validation
- All tests pass
- Same test coverage
- No test pollution between features
- Faster feedback loop

## Rollback Plan

All original files will be kept in git history. If consolidation causes issues:
1. Revert the consolidation commit
2. Keep using individual files (slower but stable)
3. Revisit consolidation approach

## Notes

- Use `resetAppState()` between describe blocks if needed for isolation
- Each consolidated file should have single `before()` hook
- Group related tests with nested `describe()` blocks
- Keep test data fixtures organized by feature

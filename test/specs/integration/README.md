# Integration Tests

Integration tests verify cross-layer behavior that cannot be tested in isolation through E2E or unit tests. These tests use `callBridgeReplacement()` to access backend state and file system operations for **verification only**.

## Purpose

Integration tests validate:
- **Persistence at rest** - Collections and workspace state are correctly encrypted and stored on disk
- **Reload recovery** - Application state is properly restored after a restart
- **Backend command routing** - Tauri commands execute correctly and return proper results
- **Authentication processing** - Auth backends process credentials and return tokens correctly

## When to Use Integration Tests

Create an integration test when:

1. **Backend verification is essential** - The behavior being tested depends on correct backend implementation (file I/O, encryption, command execution) that is not exposed in the UI
2. **Cannot test via E2E alone** - The outcome cannot be verified by inspecting the UI after user interactions
3. **Cannot test via unit tests** - The behavior requires real app state, actual file system, or Tauri backend integration

## When NOT to Use Integration Tests

Use E2E tests instead if:
- State can be created via UI interactions
- Outcome can be verified by inspecting the UI (DOM queries, visual elements)
- Bridge access is not needed for verification

Use unit tests instead if:
- Testing business logic in isolation with mocked dependencies
- No real backend/file system access needed

## Current Integration Tests

### `launch-hydration.e2e.ts`
- **Purpose**: Verifies collections are persisted to disk and restored on startup
- **Bridge usage**: `saveAppData()`, `loadAppData()` - verify file I/O
- **Why justified**: Cannot verify file persistence through UI alone

### `workspace-restore.e2e.ts`
- **Purpose**: Verifies workspace state (open tabs, selected environment) persists across reload
- **Bridge usage**: `getWorkspaceSnapshot()`, file operations - verify state recovery
- **Why justified**: Requires both backend state inspection and UI verification

### `tauri-integration.e2e.ts`
- **Purpose**: Tests Tauri backend functionality (commands, file access, auth processing)
- **Bridge usage**: `invoke()`, file operations, auth methods - test backend directly
- **Why justified**: Tests backend implementation not exposed through UI

### `collection-merge.e2e.ts` (pending)
- **Purpose**: Tests collection merge analysis and application
- **Bridge usage**: `analyze_merge()`, `apply_merge()` - verify merge logic
- **Status**: Blocked - merge methods not yet implemented in bridge-replacement

## Running Integration Tests

To run integration tests exclusively:

```bash
yarn test:e2e:integration
```

To exclude integration tests from standard E2E run:

```bash
yarn test:e2e --exclude 'test/specs/integration/**'
```

## Bridge Usage Guidelines

Bridge methods can be used in integration tests for **verification only**, not state creation:

**✅ Acceptable**:
```typescript
// Verify file was saved correctly
const saved = await callBridgeReplacement('loadAppData', 'path/file.json')
expect(saved).toEqual(expectedContent)

// Verify auth cache entry created
const cached = await callBridgeReplacement('getAuthCacheEntry', requestId)
expect(cached.token).toBeDefined()
```

**❌ Not acceptable** (use UI instead):
```typescript
// Creating state via bridge - use UI instead
const collection = await callBridgeReplacement('create_collection', { name: 'Test' })

// Verification that duplicates E2E - use DOM queries instead
const snapshot = await callBridgeReplacement('getWorkspaceSnapshot')
```

## Adding New Integration Tests

When proposing a new integration test:

1. **Document justification** - Explain why the test cannot be E2E or unit
2. **Show bridge usage** - List which bridge methods are used and why
3. **Verify alternatives** - Confirm E2E and unit testing approaches are not viable
4. **Add header comment** - Include the test purpose and bridge justification
5. **Place in `test/specs/integration/`** - Not in main `test/specs/` folder

See `CLAUDE.md` for the full integration test approval criteria.

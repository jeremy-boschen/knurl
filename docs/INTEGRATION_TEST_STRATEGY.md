# Integration Test Strategy

## Overview

This document outlines the plan to expand integration tests from 26 to 150+ tests, addressing the test pyramid inversion where E2E tests were testing application logic.

**Goal:** Move all cross-layer logic testing from E2E to integration tests, keeping E2E focused only on user workflows.

---

## Test Responsibility Matrix

| Concern | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------|
| Auth resolution logic | ✅ | - | - |
| Auth header injection | ✅ | ✅ (full flow) | - |
| Request preparation | ✅ | ✅ (full flow) | - |
| Collections CRUD | ✅ | ✅ (with persistence) | - |
| File I/O & encryption | - | ✅ | - |
| Response rendering | ✅ | - | - |
| User workflows | - | - | ✅ |

---

## Integration Test Structure

### 1. Request Lifecycle Integration Tests
**Location:** `test/specs/integration/request-lifecycle/`
**Purpose:** Verify request preparation, auth injection, and environment resolution work correctly end-to-end

#### Files and Coverage:

**preparation.e2e.ts** (10 tests)
- Path parameter substitution (single, multiple, special chars)
- Query parameter encoding (arrays, special characters)
- Header merging (request + auth + defaults)
- Cookie serialization and merging
- URL construction (all components)

**auth-injection.e2e.ts** (10 tests)
- Basic auth: encoding → header injection
- Bearer token: placement in header/query/cookie
- API key: placement in header/query/cookie
- OAuth2 client credentials: fetch → cache → reuse
- Auth caching and cache invalidation

**environment-resolution.e2e.ts** (5 tests)
- Single variable substitution
- Multiple variable substitution
- Secure variable handling (not logged/exported)
- Variable precedence (collection vs global)
- Nested variable resolution

---

### 2. Collections Persistence Integration Tests
**Location:** `test/specs/integration/collections-persistence/`
**Purpose:** Verify collections are correctly saved, encrypted, and restored

#### Files and Coverage:

**file-io.e2e.ts** (10 tests)
- Collection created → saved to disk
- Collection updated → changes persisted
- Collection deleted → file removed
- Multiple collections → all saved correctly
- Concurrent saves → no corruption
- Rapid updates → final state correct

**encryption.e2e.ts** (8 tests)
- Collection file encrypted at rest (not plaintext)
- Decrypt file → matches in-memory state
- Encryption key management (system keyring)
- Corrupted encrypted file → graceful recovery

**index-management.e2e.ts** (8 tests)
- Collection index file updated on create/delete/reorder
- Malformed index → graceful recovery
- Missing collection file referenced in index → handled
- Index consistency after rapid changes

**request-persistence.e2e.ts** (7 tests)
- Request created → saved in collection file
- Request updated → changes persisted
- Request deleted → removed from file
- Request moved between folders → structure persisted
- Folder hierarchy → structure persisted

---

### 3. Workspace State Integration Tests
**Location:** `test/specs/integration/workspace-state/`
**Purpose:** Verify workspace state (tabs, environments) persists across reloads

#### Files and Coverage:

**tab-persistence.e2e.ts** (8 tests)
- Open tabs → persisted to workspace file
- Active tab → restored on reload
- Tab closed → removed from workspace file
- Multiple tabs → all restored
- Tab switched → active tab updated
- Scratch requests in tabs → persisted

**environment-selection.e2e.ts** (7 tests)
- Selected environment → persisted per collection
- Environment switched → selection persisted
- Environment deleted → selection reset to default
- Environment created → can be selected
- Multiple collections → independent env selection

---

### 4. Request Execution Integration Tests
**Location:** `test/specs/integration/request-execution/`
**Purpose:** Verify HTTP/WebSocket execution and response handling work correctly

#### Files and Coverage:

**http-engine.e2e.ts** (10 tests)
- HTTP request sent → backend command invoked
- HTTP response received → parsed correctly
- HTTP error (network) → error propagated
- HTTP timeout → timeout error returned
- HTTP redirect → followed correctly
- Cookies received → stored in jar
- Cookies sent → from jar

**websocket-engine.e2e.ts** (5 tests)
- WS connection opened → backend command invoked
- WS message sent → delivered to server
- WS message received → delivered to app
- WS connection closed → state updated
- WS reconnect on failure

---

### 5. Import/Export Integration Tests
**Location:** `test/specs/integration/import-export/`
**Purpose:** Verify import/export functionality for different formats

#### Files and Coverage:

**import.e2e.ts** (10 tests)
- Postman import → collection created with requests
- Insomnia import → collection created
- OpenAPI import → requests generated from spec
- Import duplicate → merge options presented
- Invalid data → validation errors

**export.e2e.ts** (8 tests)
- Export collection → file contains all requests
- Export with secure variables → excluded
- Export to Postman → compatible file
- Export to OpenAPI → valid spec
- Export to native format → roundtrip compatibility

---

### 6. Error Handling & Edge Cases Integration Tests
**Location:** `test/specs/integration/error-handling/`
**Purpose:** Verify robustness under error conditions

#### Files and Coverage:

**data-integrity.e2e.ts** (10 tests)
- Corrupted collection file → graceful recovery
- Missing collection file → removed from index
- File write failure → error propagated
- Disk full → error handled
- Permission denied → error displayed

**concurrency.e2e.ts** (8 tests)
- Multiple requests sent simultaneously → all succeed
- Collection saved while request executing → no conflict
- Auth token refreshed during request → request retried
- Multiple collections saved concurrently → no corruption

**edge-cases.e2e.ts** (10 tests)
- Empty collection → saved/loaded correctly
- 1000+ requests → loads without performance issues
- Very large request body → handled correctly
- URL with special characters → encoded correctly
- Headers with Unicode → preserved correctly

---

## Integration Test Pattern

### Basic Structure

```typescript
/**
 * Integration Test: [Descriptive title]
 *
 * Tests [specific cross-layer behavior]. This verifies that [component A]
 * correctly integrates with [component B] when [condition]. We use the
 * bridge API to verify [backend behavior] because [backend behavior is
 * not exposed through the normal UI].
 *
 * Setup: [via UI or describe steps]
 * Verification: [via bridge API]
 */

describe('[Feature] Integration', () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it('creates request with auth injection', async () => {
    // Setup via UI
    const collectionId = await createCollectionViaUI({ name: 'Auth Test' })

    // Verify via bridge (backend behavior)
    const auth = await callBridgeReplacement('invokeAuthViaTauri', {
      authType: 'bearer',
      token: 'abc123'
    })

    expect(auth.headers.Authorization).toBe('Bearer abc123')
  })
})
```

### Bridge API Usage

**For State Inspection:**
- `getWorkspaceSnapshotFromState()` - app state at any point
- `getAllCollectionsFromState()` - collections in memory
- `getAuthCacheEntryFromState(requestId)` - cached auth results

**For File System Access:**
- `loadAppDataFile(path)` - read files from app data dir
- `writeAppDataFile(path, data)` - write files
- `deleteAppDataFile(path)` - delete files
- `appDataFileExists(path)` - check existence

**For Tauri Commands:**
- `invokeAuthViaTauri(authConfig, requestId)` - auth processing
- `invokeCommandViaTauri(commandName, params)` - generic command

---

## Writing Integration Tests: Checklist

- [ ] Test file in correct subdirectory (`request-lifecycle/`, `collections-persistence/`, etc.)
- [ ] Include justification header comment
- [ ] Setup via UI where possible (don't bypass UI if testable)
- [ ] Verification via bridge API (backend behavior)
- [ ] No WDIO selectors or DOM inspection
- [ ] No arbitrary pauses (use bridge to verify state)
- [ ] Test one aspect per test (not combinatoric)
- [ ] Clear test name describing what is verified
- [ ] Passes in isolation and in suite

---

## Implementation Schedule

**Week 1:** Request lifecycle tests (auth injection, request preparation)
- [ ] preparation.e2e.ts (10 tests)
- [ ] auth-injection.e2e.ts (10 tests)
- [ ] environment-resolution.e2e.ts (5 tests)

**Week 2:** Collections persistence tests (file I/O, encryption)
- [ ] file-io.e2e.ts (10 tests)
- [ ] encryption.e2e.ts (8 tests)
- [ ] index-management.e2e.ts (8 tests)
- [ ] request-persistence.e2e.ts (7 tests)

**Week 3:** Workspace state tests (tab/env persistence)
- [ ] tab-persistence.e2e.ts (8 tests)
- [ ] environment-selection.e2e.ts (7 tests)

**Week 4:** Request execution tests (HTTP/WS)
- [ ] http-engine.e2e.ts (10 tests)
- [ ] websocket-engine.e2e.ts (5 tests)

**Week 5:** Import/export tests
- [ ] import.e2e.ts (10 tests)
- [ ] export.e2e.ts (8 tests)

**Week 6:** Error handling tests
- [ ] data-integrity.e2e.ts (10 tests)
- [ ] concurrency.e2e.ts (8 tests)
- [ ] edge-cases.e2e.ts (10 tests)

---

## Success Criteria

**Per Test:**
- Passes consistently (no flakiness)
- Tests one aspect (not combinatoric)
- Uses bridge API properly (no DOM inspection)
- Includes clear justification
- Runs in <5 seconds

**Per Week:**
- 20-35 new tests written
- All tests passing
- Zero regressions in existing tests
- Covered more cross-layer logic than previous week

**Final (After 6 weeks):**
- 135+ new integration tests
- CI runtime <20 minutes (vs current 60-100 mins)
- Ready to delete redundant E2E tests
- Test pyramid correctly inverted

---

## Related Documents

- `TEST_SUITE_ARCHITECTURE_CRITIQUE.md` - Why test pyramid is inverted
- `TEST_AUDIT_REPORT.md` - Specific violations in current test suite
- `CLAUDE.md` - Integration test approval criteria


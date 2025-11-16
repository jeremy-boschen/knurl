# Test Coverage Gaps - Integration/Unit Tests Needed

This document tracks functionality removed from E2E tests that should be covered by integration or unit tests instead.

## Collection Storage & Data Persistence

**Removed from:** `test/specs/collections-core.e2e.ts`

**Reason:** These tests verify backend behavior (data persistence, encryption, file I/O), not user-visible E2E behavior. Using `callBridgeReplacement` to access `__vite_ssr_modules__` violates E2E discipline.

**Tests to implement:**

### Unit Tests (src-tauri/tests/ or inline #[cfg(test)])

- **Persists collection data after creation**
  - Create collection via API
  - Verify JSON file exists in app data directory
  - Verify collection ID matches filename

- **Retrieves collection data without corruption**
  - Create and write collection JSON
  - Load via API
  - Verify all fields match original

- **Maintains data integrity across multiple operations**
  - Create collection
  - Update name, description, fields
  - Verify each update persists correctly
  - Verify no partial/corrupted state

- **Handles sensitive data in collections**
  - Create collection with auth credentials
  - Verify encryption at rest (AES-GCM)
  - Verify credentials are not stored in plaintext

- **Prevents data loss on rapid successive updates**
  - Perform multiple updates in tight loop (no await between)
  - Verify final state matches last update
  - Verify no lost intermediate states

### Integration Tests (test/specs/integration/)

- **Maintains collection list consistency**
  - Create 3+ collections via UI
  - Reload app
  - Verify all collections appear in list
  - Verify ordering preserved

- **Creates multiple collections and verifies persistence**
  - Create collections sequentially via UI
  - Reload browser
  - Verify each collection persists and is queryable

## WebDriver/Concurrent Operations Issue

**Issue:** E2E tests using `Promise.all()` on concurrent WebDriver operations may cause socket exhaustion and session crashes.

**Affected code:** `test/specs/collections-core.e2e.ts` (removed test: "survives concurrent collection operations")

**Symptoms:**
- `UND_ERR_SOCKET` errors on WebDriver protocol requests
- `Connection refused` on localhost:4444
- WebDriver session becomes unresponsive
- Cannot clean up session (DELETE request fails)

**Root cause:** Multiple concurrent `browser.executeAsync()` or `callBridgeReplacement()` calls exhaust WebDriver socket connections before responses complete.

**Workaround applied:** Refactor concurrent operations to sequential loops. E2E tests should test user-visible behavior (which is inherently sequential), not concurrent backend operations.

**Recommendation:** Concurrency testing belongs in unit/integration tests where operations can be controlled synchronously, not in E2E where they're mediated through WebDriver protocol.

## Notes

- E2E tests should verify user-visible behavior only
- Backend behavior (persistence, encryption, race conditions) belongs in unit/integration tests
- Data corruption/integrity testing requires direct backend/filesystem access, not UI interactions
- Concurrent operation testing should use synchronous test harnesses, not async WebDriver calls

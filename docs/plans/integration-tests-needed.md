# Integration Tests Needed

Tests that require **integration testing** (WebDriver.io + backend access) because cross-layer behavior verification is essential and cannot be tested via E2E (UI-only) or unit tests.

## Format
- **Test Name:** Name of the behavior being tested
- **Current Location:** Where it's currently attempted as E2E
- **Rationale:** Clear justification for why E2E or unit testing won't work
- **Suggested Design:** Brief design notes for the integration test
- **Status:** Pending, Approved, or Implemented

---

## Tests to Convert

### collection-encryption.e2e.ts
- **Rationale:** Encryption at-rest is a critical security feature. The encrypted data format and key isolation must be verified at the filesystem level, not just through UI interactions. Users can't visually verify encryption happened.
- **Suggested Design:**
  - Setup: Create collection via UI
  - Verification: Read collection file from disk, verify it's encrypted (binary/non-plaintext format), verify encryption key differs from other collections
  - Requires `callBridgeReplacement` helpers for filesystem access
- **Status:** Pending approval

### collection-merge.e2e.ts
- **Current Test:** Uses `analyze_merge`, `apply_merge`, `get_collection` bridge methods
- **Rationale:** Collection merge is a complex feature involving backend computation (conflict detection, diff analysis). Tests create state via backend (`create_collection`, `get_collection`, `apply_merge`) instead of UI.
- **Classification:** **Should be Integration Test**
  - Setup: Create collections via UI
  - Operations: Perform merge via UI (import bundle dialog)
  - Verification: Read collections from disk via `callBridgeReplacement` to verify merge operations succeeded
- **Note:** Tests currently all wrapped in try-catch because backend methods don't exist yet. Merge feature itself may still be in design phase.
- **Status:** Pending design/approval

### collection-storage.e2e.ts
- **Current Test:** Uses `create_collection`, `get_collection`, `update_collection` bridge methods
- **Rationale:** Uses backend to create and retrieve collections instead of UI. But fundamental tests ("collection appears in UI after creation") are actually E2E-capable.
- **Classification:** **MIXED - Needs Split**
  - **E2E tests:** "persists collection data after creation" - can use UI helpers to create
  - **Integration tests:** "maintains data integrity across operations" - needs backend verification to ensure on-disk state
- **Suggested Design:**
  - E2E: Create collection via UI, verify it appears in sidebar
  - Integration: Create/modify via UI, read disk to verify persistence
- **Status:** Pending approval

### large-collections.e2e.ts
- **Current Test:** Uses `create_collection`, `get_all_collections` bridge methods
- **Rationale:** Performance test creating 50 collections via backend shortcut. Performance testing is E2E-worthy (measuring UI responsiveness), but setup should be via UI.
- **Classification:** **Should be E2E**
  - This is fundamentally a performance/responsiveness test
  - Can create large collections via rapid UI interactions (looped clicks)
  - Verify scrolling, searching, opening collections from large list
  - Measures time to create collections as metric (acceptable via UI)
- **Suggested Design:**
  - Loop: Click new collection button, enter name, save (50x)
  - Measure: Time to create collections
  - Verify: Sidebar renders, scrolling works, search filters, collections open quickly
- **Status:** Pending approval for E2E refactor

---

## Approval Status
- [ ] collection-encryption.e2e.ts - Awaiting approval (Integration test candidate)
- [ ] collection-merge.e2e.ts - Awaiting approval (Integration test, depends on merge feature design)
- [ ] collection-storage.e2e.ts - Awaiting approval (Mix of E2E + Integration)
- [x] large-collections.e2e.ts - Refactor to pure E2E (use UI loops for setup)


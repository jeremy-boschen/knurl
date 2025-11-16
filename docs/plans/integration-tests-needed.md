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
- **Current Test:** Uses `analyze_merge` bridge method
- **Rationale:** Collection merge analysis computes diff/conflict data. If this is a pure UI mock or display operation, it's E2E. If it requires backend computation that can't be seen in the UI, it's integration.
- **Suggested Design:** Review what `analyze_merge` actually does. If it's backend-only logic, move to integration. If it's just displaying pre-computed data, move to E2E.
- **Status:** Pending review

### collection-storage.e2e.ts
- **Current Test:** Uses `get_collection` bridge method to read persisted state
- **Rationale:** Testing data persistence across operations requires reading from disk to verify the collection structure is correctly saved. This isn't visible via UI alone.
- **Suggested Design:**
  - Setup: Perform collection operations via UI (create, edit requests, etc.)
  - Verification: Read collection file from disk, verify structure matches expected state
  - Verify across operations: modify via UI, read disk, verify changes persisted
- **Status:** Pending approval

### large-collections.e2e.ts
- **Current Test:** Uses `create_collection` bridge method
- **Rationale:** Performance behavior (loading large collections) might need backend setup to create consistent test data. But this might be E2E if we can create large collections via UI interactions.
- **Suggested Design:** Review if large collections can be created via UI. If performance is the focus, this is E2E (measure UI responsiveness). If we need specific backend state that's hard to build via UI, move to integration.
- **Status:** Pending review

---

## Approval Status
- [ ] collection-encryption.e2e.ts - Awaiting approval
- [ ] collection-merge.e2e.ts - Awaiting review
- [ ] collection-storage.e2e.ts - Awaiting approval
- [ ] large-collections.e2e.ts - Awaiting review


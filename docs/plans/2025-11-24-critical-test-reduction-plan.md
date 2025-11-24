# CRITICAL Test Reduction Plan

**Goal:** Mark only essential individual tests as [CRITICAL] for quick smoke test runs. Most other tests stay in existing describe blocks but are unmarked/supplemental.

## Proposed Changes

Mark individual tests with [CRITICAL] prefix:

### **collections-core.e2e.ts** - 2 [CRITICAL] tests

Keep describe block title as-is. Mark these tests [CRITICAL]:
- ✓ `it("[CRITICAL] creates multiple collections through the sidebar menu")`
- ✓ `it("[CRITICAL] persists collections across browser reload")`

Leave unmarked (supplemental):
- ⊗ "deletes a collection through the sidebar menu"
- ⊗ "creates a collection and scratch request"
- ⊗ "Collection Encryption & At-Rest Storage" placeholder

### **request-execution.e2e.ts** - 3 [CRITICAL] tests

Already correct. Mark these:
- ✓ `it("[CRITICAL] sends a GET request and displays response")`
- ✓ `it("[CRITICAL] handles HTTP error responses without crashing")`
- ✓ `it("[CRITICAL] allows retrying requests")`

### **auth.e2e.ts** - 1 [CRITICAL] test

Keep describe blocks as-is. Mark only one basic test:
- ✓ `it("[CRITICAL] configures and sends Basic auth request")`

Leave unmarked:
- ⊗ All other auth tests (Bearer, ApiKey, OAuth2, inheritance)

### **collections-management.e2e.ts** - 1 [CRITICAL] test

Keep describe block. Mark one test:
- ✓ `it("[CRITICAL] creates, renames, and deletes collections through the sidebar menu")`

### **request-configuration.e2e.ts** - 0 [CRITICAL] tests

Mark as [SUPPLEMENTAL] in describe title. These are covered by request-execution.e2e.ts smoke tests.

### **requests.e2e.ts** - 0 [CRITICAL] tests

Mark as [SUPPLEMENTAL] in describe title. Tab management, unsaved edits, context menus are not essential for smoke tests.

### **collection-encryption.e2e.ts** - 0 [CRITICAL] tests

Mark as [SUPPLEMENTAL] in describe title. Encryption testing is not smoke-test-essential.

## Summary

| File | [CRITICAL] Tests | Unmarked/[SUPPLEMENTAL] |
|------|-----------------|------------------------|
| **collections-core.e2e.ts** | 2 | 2 |
| **request-execution.e2e.ts** | 3 | 0 |
| **auth.e2e.ts** | 1 | 10+ |
| **collections-management.e2e.ts** | 1 | 0 |
| **request-configuration.e2e.ts** | 0 | 2 |
| **requests.e2e.ts** | 0 | 6+ |
| **collection-encryption.e2e.ts** | 0 | 1 |
| **Other files** | 0 | unmarked |
| **TOTAL [CRITICAL]** | **7 tests** | **~25+ supplemental** |

## Running Tests

### Quick Smoke Tests Only
```bash
# Run only [CRITICAL] marked tests
yarn test:check
# This should run ~7 tests in 30-40s
```

### Full Test Suite
```bash
# Run all tests (CRITICAL + unmarked/supplemental)
yarn test:e2e
```

## Core Smoke Test Coverage

These 7 tests verify:
- ✓ App starts and hydrates (collections-core setup)
- ✓ Collections can be created & shown in UI
- ✓ Collections persist across reload
- ✓ Requests can be created
- ✓ Requests can be executed (GET)
- ✓ Responses display correctly
- ✓ Error responses don't crash (500 error)
- ✓ Requests can be retried
- ✓ Basic auth can be set (auth working)
- ✓ Collections can be renamed/deleted (management works)

## NOT Covered by Smoke Tests (OK - detailed testing)
- ⊗ Authentication permutations (Bearer, ApiKey, OAuth2, header/query/cookie placement)
- ⊗ Request configuration details (POST body, query params, various headers)
- ⊗ Tab management (unsaved edits, context menus, tab closing)
- ⊗ Encryption and at-rest storage
- ⊗ Settings and UI customization
- ⊗ Advanced request features (WebSocket, streaming, etc)

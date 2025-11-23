# E2E Test Categorization: [CRITICAL] vs [SUPPLEMENTAL]

This document categorizes end-to-end tests to optimize CI/CD execution time and test coverage.

## Test Categories

### [CRITICAL] - Run in CI on Every Commit

Core user workflows that must never break. These tests verify fundamental application functionality.

**Collections Management:**
- `test/specs/collections-core.e2e.ts`: Collections Management & Storage
- `test/specs/collections-management.e2e.ts`: Collections Management UX, Scratch Collection UX

**Request Execution:**
- `test/specs/request-execution.e2e.ts`: Request Execution & Responses (smoke tests)
- `test/specs/request-configuration.e2e.ts`: Request Configuration (body types, headers, params, cookies)

**Authentication:**
- `test/specs/auth.e2e.ts`: Basic, Bearer, API Key authentication
- `test/specs/auth.e2e.ts`: Collection auth inheritance, auth persistence

**Data Persistence:**
- `test/specs/collection-encryption.e2e.ts`: Collection encryption & at-rest storage
- `test/specs/workspace-restore.e2e.ts`: Workspace state restoration after reload

**Request Authoring:**
- `test/specs/requests.e2e.ts`: Request Tab Context Menu, Multi-Tab Edits

---

### [SUPPLEMENTAL] - Nightly/Pre-Release Only

Edge cases, advanced features, and performance tests. These verify robustness but are less critical.

**Advanced Features:**
- `test/specs/environments.e2e.ts`: Environment manager UX (smoke level)
- `test/specs/settings-ui.e2e.ts`: Settings & UI customization, Theme settings

**Request Authoring Advanced:**
- `test/specs/requests.e2e.ts`: Request Authoring Advanced (UI state, refactoring verification)

**OAuth & Advanced Auth:**
- `test/specs/oauth-flows.e2e.ts`: OAuth2 flows, grant types, PKCE

**Performance & Load:**
- `test/specs/performance.e2e.ts`: Large Collections Performance
- `test/specs/request-execution.e2e.ts`: Large Payload Handling

**Event System & Internals:**
- `test/specs/event-system.e2e.ts`: Event System (internal state propagation)
- `test/specs/setinput-refactor-verification.e2e.ts`: Input helper refactoring (verification)
- `test/specs/setvalue-verification.e2e.ts`: Input value helper verification
- `test/specs/tauri-concurrent-invoke.e2e.ts`: Tauri concurrency bug (regression check)

**Integration Tests:**
- `test/specs/integration/tauri-integration.e2e.ts`: Tauri IPC integration
- `test/specs/integration/launch-hydration.e2e.ts`: App startup & hydration
- `test/specs/integration/request-lifecycle/*.e2e.ts`: Auth injection, environment resolution, request preparation

---

## Rationale

**Critical tests verify:**
1. Core workflows users depend on daily (create collection, make request, manage auth)
2. Data integrity (encryption at rest, persistence across reloads)
3. Essential authentication schemes
4. UI interaction basics (editing, context menus)

**Supplemental tests verify:**
1. Optional features (custom themes, advanced OAuth)
2. Performance characteristics (large payloads, many collections)
3. Edge cases and advanced configurations
4. Refactoring verification (internal helpers, event propagation)
5. Platform integration details (Tauri IPC, WebDriver interactions)

---

## Suggested CI/CD Strategy

### In Main CI (Run on every commit):
```bash
yarn test:e2e:critical
```
- Runs only [CRITICAL] tests
- Should complete in ~3-5 minutes
- Blocks PR merges if failing

### Pre-Release (Run nightly or before release):
```bash
yarn test:e2e
```
- Runs all E2E tests (critical + supplemental)
- More comprehensive coverage
- Identifies regressions in advanced features
- Can run longer (~15-20 minutes)

---

## Implementing Tag Filtering

To support filtering by tags, tests should be marked with `vitest` tags or WebDriver.io suite names:

```typescript
describe("[CRITICAL] Collections Management", () => {
  // Critical tests
})

describe("[SUPPLEMENTAL] Performance", () => {
  // Supplemental tests
})
```

Then filter via:
```bash
# Critical only
yarn test:e2e -- --grep "\[CRITICAL\]"

# Supplemental only
yarn test:e2e -- --grep "\[SUPPLEMENTAL\]"
```

---

## Test Review Process

When adding new E2E tests:
1. Ask: "Is this a core user workflow?" → [CRITICAL]
2. Ask: "Is this testing an optional feature or edge case?" → [SUPPLEMENTAL]
3. Add tag to test file: `describe("[CRITICAL] ...", () => {...})` or `describe("[SUPPLEMENTAL] ...", () => {...})`
4. Update this document if new test category needed

# E2E.md — End-to-End Test Implementation Guide

Agent-focused guide for writing, debugging, and optimizing E2E tests.

## Golden Rule (Non-Negotiable)

**Only test user-visible behavior via UI interactions.**

- **Setup:** Create state EXCLUSIVELY through UI actions (clicks, typing)
- **Verify:** Inspect ONLY what the UI displays (DOM queries, visual elements)
- **Never:** Access internal state, call Tauri commands, touch filesystem

Violation = Move to integration test with explicit approval.

## Test Architecture

### Files & Organization

```
test/
├── specs/                      E2E test files
│   ├── *.e2e.ts                Single-feature tests
│   └── integration/             Approved cross-layer tests
├── support/
│   ├── ui.ts                    Canonical helper functions (ALL helpers here)
│   ├── E2E_OVERVIEW.md          User-facing patterns (junior dev friendly)
│   └── E2E_GUIDELINES.md        Detailed patterns and anti-patterns
├── fixtures/                    Test data
│   └── settings.json            Auto-save disabled for tests
└── mocks/                       Mock server, Tauri mocks
```

**CRITICAL:** All UI helpers are in `test/support/ui.ts` only. No other helper files.

### Session Initialization

```
1. onPrepare (once per run):     Start tauri-driver, Vite, mock endpoints
2. beforeSession (per file):     Create isolated temp config dir
3. before (per describe block):  Wait for app ready, refresh page
4. Test execution:               Run individual tests
5. after (per describe block):   Close overlays, clean state
6. Reload:                       browser.refresh() between files
```

**Cost:** ~5-6s cold start, ~100ms hot reload

## Implementation Patterns

### Basic Test Structure

```typescript
import { expect } from "@wdio/globals"
import {
  ensureWorkspaceReady,
  createCollection,
  clickByTestId,
  setInputText,
  waitForCollectionIdByName,
  resetOverlays,
} from "../support/ui"

describe("Feature Name", () => {
  before(async () => {
    await browser.refresh()
    await ensureWorkspaceReady()
  })

  after(async () => {
    await resetOverlays()
  })

  it("creates a collection", async () => {
    // Arrange
    const name = `Test ${Date.now()}`

    // Act
    const collectionId = await createCollection(name)

    // Assert
    const found = await waitForCollectionIdByName(name)
    expect(found).toBe(collectionId)
  })
})
```

### Persistence Across Reload

```typescript
it("persists collection name across reload", async () => {
  // 1. Create
  const collectionId = await createCollection("Original")

  // 2. Wait for auto-save (default 5000ms, add buffer)
  await browser.pause(2000)

  // 3. Reload (use browser.refresh(), NOT location.reload())
  await browser.refresh()
  await ensureWorkspaceReady()

  // 4. Verify
  const found = await waitForCollectionIdByName("Original")
  expect(found).toBe(collectionId)
})
```

**Critical:** Always pause before reload. Default 500ms is too short.

### Menu/Dialog Interactions

```typescript
it("renames collection via menu", async () => {
  const collectionId = await createCollection("Original")
  const newName = "Renamed"

  // Open context menu
  await openCollectionMenu(collectionId)

  // Click menu item (handles async menu state)
  await clickByTestId(`collection-menu:item:rename:${collectionId}`)

  // Dialog appears, interact
  await setInputText("rename-dialog:name-input", newName)
  await clickByTestId("rename-dialog:submit")

  // Verify UI updated
  const found = await waitForCollectionIdByName(newName)
  expect(found).toBe(collectionId)
})
```

## Helper Functions (Use These)

All helpers are in `test/support/ui.ts`. **Never use raw WebDriver commands** (e.g., `await $()`, `await element.click()`). Helpers have retry logic and proper polling.

### Core Setup

**ensureWorkspaceReady()** — Wait for app hydration
```typescript
before(async () => {
  await ensureWorkspaceReady()
})
```

**ensureSidebarExpanded()** — Expand sidebar before collection tree
```typescript
await ensureSidebarExpanded()
await createCollection("My Collection")
```

### Element Interaction (Retry-Safe)

**getElementByTestId(testId, timeout?, options?)** — Find element with retries
```typescript
// Has built-in retry + 50ms polling
const button = await getElementByTestId("submit-button")

// Raw WebDriver (WRONG - no retries)
const button = await $('[data-test-id="submit-button"]')
```

**clickByTestId(testId)** — Click with proper timing
```typescript
await clickByTestId("save-button")  // ✅ Correct
await element.click()                // ❌ Wrong
```

**setInputText(testId, value)** — Clear + set with focus
```typescript
await setInputText("name-input", "New Name")  // ✅ Handles clear
await input.setValue("New Name")               // ❌ May not clear
```

**clearInputText(testId)** — Clear field completely
```typescript
await clearInputText("search-input")
```

### Collections

**createCollection(name)** — Create via UI, return ID
```typescript
const id = await createCollection("My Collection")
```

**waitForCollectionIdByName(name)** — Find collection, throw if not found
```typescript
const id = await waitForCollectionIdByName("My Collection")
```

**openCollectionMenu(collectionId)** — Open context menu
```typescript
await openCollectionMenu(collectionId)
```

**selectMenuActionById(actionId, options?)** — Click menu item
```typescript
await selectMenuActionById("collection-menu:item:delete:123", {
  triggerTestId: "collection-menu:trigger"
})
```

### Requests

**waitForRequestEditor()** — Wait for URL input to appear
```typescript
await openNewRequestViaUI()
await waitForRequestEditor()
```

**waitForActiveRequestTab()** — Get currently active request tab key
```typescript
const tabKey = await waitForActiveRequestTab()
expect(tabKey).toBeTruthy()
```

### State Verification

**expectAttributeValue(testId, attr, expected)** — Assert attribute
```typescript
await expectAttributeValue("collection-row:123", "data-selected", "true")
```

**expectTextContent(testId, expected)** — Assert text content
```typescript
await expectTextContent("collection-name:123", "My Collection")
```

### Cleanup

**resetOverlays()** — Close modals, sheets, dropdowns
```typescript
after(async () => {
  await resetOverlays()
})
```

## Common Issues & Solutions

### Test Waits Too Long for Element (15s timeout)

**Problem:** `getElementByTestId()` waits full 15s when element appears in 100ms

**Solution:** Element has wrong test-id or different DOM structure
- Check browser console for actual test-id values
- Verify element is actually visible (not hidden)
- Use `getElementByTestId(..., 5000)` for shorter timeout

### Tests Fail After Running Multiple Files

**Problem:** State pollution from previous test suites

**Solution:** Already isolated via temp config dirs. If still failing:
1. Verify `test/fixtures/settings.json` has `autoSave: 0`
2. Add explicit `beforeEach` cleanup
3. Use `browser.refresh()` between feature areas

### Reload Breaks WebDriver Session

**Problem:** Using `browser.execute(() => window.location.reload())`

**Solution:** Always use `browser.refresh()`:
```typescript
// ❌ WRONG - breaks WebDriver
await browser.execute(() => window.location.reload())

// ✅ RIGHT
await browser.refresh()
await ensureWorkspaceReady()
```

### Keyboard Events Don't Work

**Problem:** WebDriver focus on element, not window

**Solution:**
```typescript
await browser.execute(() => window.focus())
await browser.keys(['Control', 'r'])
```

### Test Is Flaky (Intermittent Failures)

**Causes & Fixes:**
1. Missing `ensureWorkspaceReady()` — Add to `before()`
2. Using raw `$()` instead of helpers — Replace with `getElementByTestId()`
3. Sidebar collapsed — Call `ensureSidebarExpanded()` before tree interaction
4. Reload too fast — Add `await browser.pause(2000)` before reload
5. Hidden element interaction — Open container first

## Performance Optimization

### Polling Intervals

All helpers use **50ms polling** (vs 500ms default) = 10x faster detection.

```typescript
// Fast detection (50ms polling)
await getElementByTestId("button", 15000, { pollingInterval: 50 })

// Slow detection (500ms polling, default)
await $('[data-test-id="button"]').waitForDisplayed({ timeout: 15000 })
```

### Timing Guidelines

| Operation | Expected Time | Notes |
|---|---|---|
| App startup | 5.5s | Cold Tauri + React init |
| Page reload | 5.5s | Full re-init |
| Element detection | 50-150ms | 50ms polling vs 500-1000ms default |
| Dialog open/close | 1-2s | Includes animations |
| Import parse | 0.1-0.5s | Very fast, UI renders ~60ms |

### Test Settings Fixture

Auto-save disabled in tests:
```json
{
  "requests": {
    "autoSave": 0
  }
}
```

This is auto-copied to each session's config dir. Prevents background saves from interfering.

## Running Tests

### Targeted Execution

```bash
# Run single file (fastest for development)
yarn test:e2e --spec="test/specs/requests.e2e.ts"

# Run specific test within file
yarn test:e2e --spec="test/specs/requests.e2e.ts" --test="creates a new request"

# Run multiple files
yarn test:e2e --spec="test/specs/{app,auth,requests}.e2e.ts"

# Full suite (slow, only before PR)
yarn test:e2e
```

### Debug Mode

```bash
# With trace logging
yarn test:e2e --spec="test/specs/app.e2e.ts" --loglevel=trace

# With longer timeout
timeout=180000 yarn test:e2e --spec="test/specs/app.e2e.ts"
```

## Anti-Patterns (Don't Do These)

### ❌ Access Internal State

```typescript
// WRONG - violates golden rule
const state = await browser.execute(() => {
  const modules = window.__vite_ssr_modules__
  return modules.useApplication.getState()
})
```

→ Move to integration test or verify via UI instead

### ❌ Use Bridge Methods

```typescript
// WRONG - bridge for integration tests only
await callBridgeReplacement("flushStorage")
const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
```

→ Verify state via UI inspection

### ❌ Skip ensureWorkspaceReady()

```typescript
// WRONG - app may not be hydrated
before(async () => {
  await createCollection("test")  // No ensureWorkspaceReady()
})
```

→ Always call in `before()` and after `browser.refresh()`

### ❌ Use Direct Page Navigation

```typescript
// WRONG - breaks WebDriver
await browser.url("/")
await browser.navigateTo("/?reset=true")
```

→ Use `browser.refresh()`

### ❌ Use Raw WebDriver Clicks/Inputs

```typescript
// WRONG - flaky, no retries
const input = await $('[data-test-id="name"]')
await input.setValue("Name")
const btn = await $('[data-test-id="save"]')
await btn.click()
```

→ Use helpers:
```typescript
await setInputText("name", "Name")
await clickByTestId("save")
```

### ❌ Hard-Code Timeouts

```typescript
// WRONG - fragile
await browser.pause(1000)
const el = await getElementByTestId("something")
```

→ Use helpers with built-in timeouts

### ❌ Interact with Hidden Elements

```typescript
// WRONG - element may not be visible
const item = await getElementByTestId("dropdown-item")
await clickByTestId("dropdown-item")
```

→ Open container first:
```typescript
await clickByTestId("dropdown-trigger")
await clickByTestId("dropdown-item")  // Now visible
```

## Cross-References

- **E2E_OVERVIEW.md** — User-facing patterns (developers)
- **E2E_GUIDELINES.md** — Detailed patterns from test/support/
- **TESTING.md** — When to use E2E vs unit vs integration
- **COMMANDS.md** — How to run tests
- **test/data-test-ids.md** — All valid test IDs

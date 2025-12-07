# E2E Testing Guidelines

This document defines best practices and requirements for writing E2E tests in Knurl. All E2E tests must follow the **golden rule**: test only user-visible behavior via UI interactions. See `CLAUDE.md` for the full context.

## Test Session Architecture

The E2E test suite uses a shared `tauri-driver` instance across all test files. Each test file gets its own isolated config directory to prevent state pollution while keeping initialization costs minimal.

### Initialization Flow

1. **onPrepare** (once per test run): Start single `tauri-driver`, Vite dev server, mock endpoints
2. **beforeSession** (once per test file): Create unique temp config dir, copy test settings fixture
3. **before** (once per describe block): Wait for app ready
4. **Test execution**: Run individual tests
5. **Reload**: Call `browser.refresh()` to reload page for next spec file

### Performance Optimizations

#### Aggressive Polling Intervals

All WebdriverIO wait operations use a 200ms polling interval minimum (vs default 500ms):

```typescript
// Element detection with reasonable polling
const element = await getElementByTestId('test-id', 15000, {
  pollingInterval: 200
})

// UI state checks with reasonable polling
await browser.waitUntil(
  async () => document.querySelector('[data-test-id="ready"]'),
  { timeout: 10000, interval: 200 }
)
```

200ms prevents browser event loop starvation while still providing reasonable responsiveness.

#### Test Settings Fixture

Auto-save is disabled during tests to prevent background operations:

```json
// test/fixtures/settings.json
{
  "requests": {
    "autoSave": 0  // Disables auto-save (0 interval)
  }
}
```

This fixture is automatically copied to each test session's config directory.

#### Manual Readiness Observation

During test development, press 'M' to log a timestamped readiness marker. Compare these with test detection timestamps to identify UI-test sync issues.

```
[E2E-MANUAL] 2025-11-16T21:08:17.789Z UI appears ready (manually marked)
[TEST] 2025-11-16T21:08:17.738Z Paste button clicked  <- Test detected 51ms after visual ready
```

### Timing Guidelines

| Operation | Expected Time | Notes |
|-----------|---|---|
| App startup | 5.5s | Cold Tauri/React init |
| Page reload | 5.5s | Full re-init from scratch |
| Element detection | 50-150ms | With 50ms polling vs 500-1000ms default |
| Dialog open/close | 1-2s | Includes animations |
| Import parse | 0.1-0.5s | Very fast, UI renders in ~60ms |
| Paste operation | <100ms | Via E2E bridge |

## Golden Rule

> **Only test user-visible behavior via UI interactions. Create test state exclusively through UI actions (clicking, typing, etc.). Verify outcomes only what the UI displays.**

If you need to access internal state, bridge methods, or filesystem, use an **integration test** in `test/specs/integration/` instead.

## Preconditions

### App Readiness

Before interacting with the UI, **always** call `ensureWorkspaceReady()`:

```typescript
before(async () => {
  await ensureWorkspaceReady()
})
```

This function:
- Waits for `document.readyState === "complete"`
- Waits for the title bar close button to be displayed
- Ensures full hydration has completed and all state is loaded

### Why This Matters

The app uses React Suspense for lazy loading. Calling UI helpers without `ensureWorkspaceReady()` can cause flaky tests or premature interactions before the UI is ready.

## UI State Requirements

### Collection Tree Interactions

**Requirement:** The sidebar must be in expanded state to interact with the collection tree.

Use the helper function to ensure sidebar expansion:

```typescript
// ✓ CORRECT: Use helper function
await ensureSidebarExpanded()
await createCollection("My Collection")

// ❌ WRONG: Don't manually check sidebar
const sidebar = await $('[data-test-id="sidebar"]')
await expect(sidebar).toBeDisplayed()
```

### Request Tab Interactions

**Requirement:** A request tab must be open and active before interacting with request editor panels.

```typescript
// Create a tab first via UI
const tabKey = await openNewRequestViaUI()
await waitForRequestEditor()

// Then interact with editor
await setInputText("request-url-input", "https://example.com")
```

## Reload Patterns

### Full Page Reload

Use `browser.refresh()` to reload the entire page and reset all UI state:

```typescript
before(async () => {
  await browser.refresh()
  await ensureWorkspaceReady()
})

after(async () => {
  await browser.refresh()
})
```

**When to use:** Between test suites to ensure clean state.

### Reload with Persistence Verification

When testing that data persists across reload:

```typescript
// 1. Perform actions (create, rename, etc.)
await createCollection("My Collection")
const initialName = await getCollectionName(collectionId)

// 2. Wait for auto-save to complete
// Default auto-save interval is 5000ms, but add buffer
await browser.pause(2000)

// 3. Reload
await browser.execute(() => window.location.reload())
await ensureWorkspaceReady()

// 4. Verify persistence
const persistedName = await getCollectionName(collectionId)
expect(persistedName).toBe(initialName)
```

**Important:** Always pause before `window.location.reload()` to allow auto-save to complete. The default pause of 500ms is too short.

### Avoid Direct Page Navigation

❌ **Don't use:** `await browser.url("/")`

Page navigation can break WebDriver sessions. Use `browser.refresh()` instead.

## Helper Functions

### ⚠️  CRITICAL: All Helpers in One File

**All E2E UI helper functions are in `test/support/ui.ts` - there are no separate `collections.ts` or `request.ts` files.**

If you see imports like `from "../support/collections"` or `from "../support/request"` - **those are old and wrong**. Update them to:

```typescript
// ✓ CORRECT - all from ui.ts
import {
  ensureWorkspaceReady,
  createCollection,
  clickByTestId,
  setInputText,
  waitForRequestEditor,
  openCollectionMenu,
  // ... all helpers from ui.ts
} from "../support/ui"

// ❌ WRONG - these files don't exist
import { createCollection } from "../support/collections"  // DELETED
import { waitForRequestEditor } from "../support/request"  // DELETED
```

### Why Use Helper Functions?

**IMPORTANT:** Always use the helper functions below instead of raw WebDriver commands. They handle timing, retries, and polling correctly. Using raw `$()`, `.click()`, etc. directly in tests is a common source of flaky tests.

### Core Setup Functions

#### ensureWorkspaceReady()
Waits for app hydration. **Must be called** before any UI interaction.

```typescript
before(async () => {
  await ensureWorkspaceReady()
})
```

### Element Interaction (Use These, Not Raw WebDriver)

#### getElementByTestId(testId, timeout?, options?)
**Preferred way** to find elements. Has built-in retries and polling.

```typescript
// ✓ CORRECT - has retry logic
const button = await getElementByTestId("submit-button")

// ❌ WRONG - no retry logic, flaky
const button = await $('[data-test-id="submit-button"]')
```

#### clickByTestId(testId)
Click an element by test ID. **Use this instead of `.click()`**.

```typescript
// ✓ CORRECT
await clickByTestId("save-button")

// ❌ WRONG - raw WebDriver, no handling
const element = await $('[data-test-id="save-button"]')
await element.click()
```

#### setInputText(testId, value)
Set text in an input field. **Use this instead of `.setValue()`**.

```typescript
// ✓ CORRECT - handles focus, clears existing text
await setInputText("name-input", "New Name")

// ❌ WRONG - may not clear existing text properly
const input = await $('[data-test-id="name-input"]')
await input.setValue("New Name")
```

#### clearInputText(testId)
Clear an input field completely.

```typescript
await clearInputText("name-input")
```

### Collection Functions

#### ensureSidebarExpanded()
Expand the sidebar if collapsed. Call this before interacting with collection tree.

```typescript
await ensureSidebarExpanded()
await createCollection("My Collection")
```

#### createCollection(name)
Create a collection via UI and return its ID. **Handles all UI steps automatically.**

```typescript
const collectionId = await createCollection("My Collection")
```

#### waitForCollectionIdByName(name)
Find a collection by name in the tree and return its ID. Throws if not found.

```typescript
const id = await waitForCollectionIdByName("My Collection")
```

#### clickVisibleNewCollectionButton()
Click the new collection button (works in both expanded and collapsed sidebar).

```typescript
await clickVisibleNewCollectionButton()
```

### Request Functions

#### waitForRequestEditor()
Wait for the request editor panel (URL input) to appear.

```typescript
await openNewRequestViaUI()
await waitForRequestEditor()
```

#### waitForActiveRequestTab()
Get the active request tab key.

```typescript
const tabKey = await waitForActiveRequestTab()
```

### Overlay & Menu Functions

#### resetOverlays()
Close any open modals, sheets, or dropdowns.

```typescript
after(async () => {
  await resetOverlays()
})
```

#### openCollectionMenu(collectionId)
Open the context menu for a collection.

```typescript
await openCollectionMenu(collectionId)
```

#### selectMenuActionById(actionId, options)
Click a menu action by ID. Handles menu open/close timing.

```typescript
await selectMenuActionById("collection-menu:item:delete:123", {
  triggerTestId: "collection-menu:trigger"
})
```

### State Verification

#### expectAttributeValue(testId, attribute, expected)
Assert an element's attribute value.

```typescript
await expectAttributeValue("collection-row:123", "data-selected", "true")
```

#### expectTextContent(testId, expected)
Assert element text content.

```typescript
await expectTextContent("collection-name:123", "My Collection")
```

## Common Patterns

### Create and Verify Collection

```typescript
it("creates a collection", async () => {
  const name = `Test Collection ${Date.now()}`
  const collectionId = await createCollection(name)

  // Verify in UI
  const found = await waitForCollectionIdByName(name)
  expect(found).toBe(collectionId)
})
```

### Create Request in Collection

```typescript
it("creates a request in a collection", async () => {
  const collectionId = await createCollection("My Collection")

  // Open collection menu and create request
  await openCollectionMenu(collectionId)
  await clickByTestId(`collection-menu:item:new-request:${collectionId}`)

  // Wait for request editor to load
  await waitForRequestEditor()

  // Verify tab is active
  const tabKey = await waitForActiveRequestTab()
  expect(tabKey).toBeTruthy()
})
```

### Rename and Persist

```typescript
it("renames a collection and persists on reload", async () => {
  const collectionId = await createCollection("Original")
  const newName = "Renamed"

  // Rename via UI
  await openCollectionMenu(collectionId)
  await clickByTestId(`collection-menu:item:rename:${collectionId}`)
  await setInputText("rename-dialog:name-input", newName)
  await clickByTestId("rename-dialog:submit")

  // Wait for auto-save to complete
  await browser.pause(2000)

  // Reload (use browser.refresh(), not window.location.reload())
  await browser.refresh()
  await ensureWorkspaceReady()

  // Verify
  const found = await waitForCollectionIdByName(newName)
  expect(found).toBe(collectionId)
})
```

## Why Use Helper Functions?

Helper functions are **not optional**. They solve critical problems:

1. **Retry Logic**: Built-in retries handle timing issues. Raw WebDriver fails immediately.
   ```typescript
   // Helper has 50ms polling + retries
   await clickByTestId("button")  // Works even if element takes 200ms to appear

   // Raw WebDriver fails immediately if not ready
   await $('[data-test-id="button"]').click()  // "element not visible" error
   ```

2. **Polling Intervals**: 50ms polling (vs 500ms default) = 10x faster element detection.

3. **Test ID Focus**: Keeps tests tied to semantic test IDs, not brittle selectors.

4. **Consistent Timing**: All helpers use the same timeout/interval config.

5. **Fallback Mechanisms**: Some helpers (like `withFallbackClick`) handle edge cases (focus, event dispatching).

**Result:** Helper-based tests are 5-10x more reliable and rarely flaky.

## Anti-Patterns

### ❌ DON'T: Access Internal State

```typescript
// WRONG - violates E2E golden rule
const state = await browser.execute(() => {
  const modules = window.__vite_ssr_modules__
  return modules.useApplication.getState()
})
```

→ Use integration tests in `test/specs/integration/` if you need this.

### ❌ DON'T: Use Bridge Methods

```typescript
// WRONG - bridge methods are for integration tests only
await callBridgeReplacement("flushStorage")
const snapshot = await callBridgeReplacement("getWorkspaceSnapshot")
```

→ Verify state via UI inspection instead, or move to integration test.

### ❌ DON'T: Skip ensureWorkspaceReady()

```typescript
// WRONG - app may not be hydrated
before(async () => {
  // Missing: await ensureWorkspaceReady()
  await createCollection("test")
})
```

→ Always call `ensureWorkspaceReady()` in `before()` and after `browser.refresh()`.

### ❌ DON'T: Use Direct Page Navigation

```typescript
// WRONG - breaks WebDriver session
await browser.url("/")
await browser.navigateTo("/?reset=true")
```

→ Use `browser.refresh()` to reload the page.

### ❌ DON'T: Reload Without Pause

```typescript
// WRONG - auto-save may not complete
await createCollection("test")
await browser.refresh()  // Too fast!
await ensureWorkspaceReady()
```

→ Always `await browser.pause(2000)` before reload to allow auto-save.

### ❌ DON'T: Use Raw WebDriver for Clicks/Inputs

```typescript
// WRONG - flaky, no retries
const input = await $('[data-test-id="name-input"]')
await input.setValue("New Name")
const button = await $('[data-test-id="save"]')
await button.click()
```

→ Use helper functions with built-in retry logic:

```typescript
// RIGHT - reliable, with retries
await setInputText("name-input", "New Name")
await clickByTestId("save")
```

### ❌ DON'T: Hard-Code Timeouts

```typescript
// WRONG - fragile and flaky
await browser.pause(1000)
const element = await getElementByTestId("something")
```

→ Use `getElementByTestId()` which has built-in retries and timeout handling.

### ❌ DON'T: Interact with Hidden Elements

```typescript
// WRONG - element may not be visible
const button = await getElementByTestId("dropdown-item")
await button.click()
```

→ Open the dropdown first:

```typescript
// RIGHT
await clickByTestId("dropdown-trigger")
await getElementByTestId("dropdown-item") // Waits for display
await clickByTestId("dropdown-item")
```

## Test Suite Structure

```typescript
import { expect } from "@wdio/globals"
import {
  ensureWorkspaceReady,
  createCollection,
  clickByTestId,
  openCollectionMenu,
  resetOverlays,
  setInputText,
  waitForCollectionIdByName,
  // Import all helpers from test/support/ui.ts ONLY
  // NO imports from collections.ts or request.ts (those files are deleted)
} from "../support/ui"

describe("Feature Name", () => {
  before(async () => {
    // Fresh start for this suite
    await browser.refresh()
    await ensureWorkspaceReady()
  })

  after(async () => {
    // Clean up any open overlays
    await resetOverlays()
  })

  it("does something", async () => {
    // Arrange - create test state
    const collectionId = await createCollection(`Test ${Date.now()}`)

    // Act - perform user interaction
    await openCollectionMenu(collectionId)
    await clickByTestId(`collection-menu:item:rename:${collectionId}`)
    await setInputText("rename-dialog:name-input", "Renamed")
    await clickByTestId("rename-dialog:submit")

    // Assert - verify UI state
    const found = await waitForCollectionIdByName("Renamed")
    expect(found).toBe(collectionId)
  })
})
```

## Debugging Flaky Tests

### Check Preconditions

1. **Missing `ensureWorkspaceReady()`?** Add it to `before()`.
2. **Not waiting for element to display?** Use `getElementByTestId()` instead of `$()`.
3. **Sidebar collapsed?** Ensure sidebar is visible before collection tree interactions.
4. **Reload too fast?** Add `await browser.pause(2000)` before reload.

### Enable Logging

Add timestamps to debug timing issues:

```typescript
import { logTestTime } from "../support/ui"

it("test", async () => {
  await logTestTime("Starting test")
  await createCollection("test")
  await logTestTime("Collection created")
  await browser.pause(2000)
  await logTestTime("Auto-save pause complete")
  await browser.execute(() => window.location.reload())
  await logTestTime("Page reloaded")
})
```

### Check Test IDs

Verify test IDs match `test/data-test-ids.md`.

## E2E Bridge Functions

The E2E bridge provides clipboard and utility functions for tests:

```typescript
// Set clipboard content
await browser.execute(async () => {
  const bridge = (window as any).__E2E_BRIDGE__
  await bridge.writeClipboard('content')
})

// Read clipboard
const content = await browser.execute(async () => {
  const bridge = (window as any).__E2E_BRIDGE__
  return await bridge.readClipboard()
})
```

The bridge is only available in E2E mode and is NOT exposed to production builds.

## Common Issues & Troubleshooting

### Test Waits Too Long for Element

**Problem:** `getElementByTestId()` waits 15 seconds when element is visible after 100ms

**Solution:** Element might have different test-id or be in different DOM structure. Check browser console.

### Tests Fail After Running Multiple Files

**Problem:** State pollution from previous test files

**Solution:** Tests already use isolated config dirs. If state still bleeds:
1. Check if auto-save is disabled (settings.json has `autoSave: 0`)
2. Consider adding explicit `beforeEach` cleanup
3. Use `browser.refresh()` between feature areas

### Keyboard Events Not Reaching App

**Problem:** `browser.keys(['Control', 'r'])` doesn't reload

**Solution:** WebDriver focus might be on WebElement instead of window. Use:
```typescript
await browser.execute(() => window.focus())
await browser.keys(['Control', 'r'])
```

### Page Reload Breaks WebDriver Session

**Problem:** Using `browser.execute(() => window.location.reload())` breaks the WebDriver connection

**Solution:** Always use `browser.refresh()` instead:
```typescript
// ❌ WRONG - breaks WebDriver
await browser.execute(() => window.location.reload())

// ✅ RIGHT - proper WebDriver refresh
await browser.refresh()
await ensureWorkspaceReady()
```

## When to Use Integration Tests

Move a test to `test/specs/integration/` if:

1. You need to access internal app state (`__vite_ssr_modules__`)
2. You need to verify file persistence or encryption
3. You need bridge method access
4. UI interactions alone cannot create or verify the behavior

See `CLAUDE.md` for integration test approval criteria.

## References

- **Golden Rule:** `CLAUDE.md` - E2E testing section
- **Test IDs:** `test/data-test-ids.md`
- **Integration Tests:** `test/specs/integration/README.md`
- **Helper Functions:** `test/support/ui.ts`, `collections.ts`, `request.ts`

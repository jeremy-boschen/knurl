# E2E Testing Guidelines

This document defines best practices and requirements for writing E2E tests in Knurl. All E2E tests must follow the **golden rule**: test only user-visible behavior via UI interactions. See `CLAUDE.md` for the full context.

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

```typescript
// ✓ Good: Sidebar is visible
const sidebar = await $('[data-test-id="sidebar"]')
await expect(sidebar).toBeDisplayed()

// Then interact with collection tree
await createCollection("My Collection")
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

### From `test/support/ui.ts`

#### ensureWorkspaceReady()
Waits for app hydration. **Must be called** before any UI interaction.

```typescript
before(async () => {
  await ensureWorkspaceReady()
})
```

#### getElementByTestId(testId, timeout?, options?)
Find element by `data-test-id` attribute.

```typescript
const button = await getElementByTestId("submit-button")
await button.click()
```

#### clickByTestId(testId)
Click an element by test ID.

```typescript
await clickByTestId("save-button")
```

#### setInputText(testId, value)
Set text in an input field.

```typescript
await setInputText("name-input", "New Name")
```

#### clearInputText(testId)
Clear an input field.

```typescript
await clearInputText("name-input")
```

#### resetOverlays()
Close any open modals, sheets, or dropdowns.

```typescript
after(async () => {
  await resetOverlays()
})
```

#### waitForActiveRequestTabChange(previousTabKey)
Wait for the active request tab to change.

```typescript
const initialTab = await getActiveRequestTabKey()
await clickNewRequestButton()
await waitForActiveRequestTabChange(initialTab)
```

#### openCollectionMenu(collectionId)
Open the context menu for a collection.

```typescript
await openCollectionMenu(collectionId)
const deleteButton = await getElementByTestId(`collection-menu:item:delete:${collectionId}`)
await deleteButton.click()
```

### From `test/support/collections.ts`

#### createCollection(name)
Create a collection via UI and return its ID.

```typescript
const collectionId = await createCollection("My Collection")
```

#### waitForCollectionIdByName(name)
Find a collection by name. Returns ID or throws if not found.

```typescript
const id = await waitForCollectionIdByName("My Collection")
```

### From `test/support/request.ts`

#### waitForRequestEditor()
Wait for the request editor panel to load.

```typescript
await openNewRequestViaUI()
await waitForRequestEditor()
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

  // Open collection menu
  await openCollectionMenu(collectionId)

  // Click "New Request"
  const newRequestButton = await getElementByTestId(`collection-menu:item:new-request:${collectionId}`)
  await newRequestButton.click()

  // Wait for request editor
  await waitForRequestEditor()

  // Verify request appears
  const tabKey = await getActiveRequestTabKey()
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

  // Wait for auto-save
  await browser.pause(2000)

  // Reload
  await browser.execute(() => window.location.reload())
  await ensureWorkspaceReady()

  // Verify
  const found = await waitForCollectionIdByName(newName)
  expect(found).toBe(collectionId)
})
```

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
await browser.execute(() => window.location.reload())  // Too fast!
await ensureWorkspaceReady()
```

→ Always `await browser.pause(2000)` before reload to allow auto-save.

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
import { ensureWorkspaceReady, createCollection, clickByTestId } from "../support/ui"

describe("Feature Name", () => {
  before(async () => {
    // Fresh start for this suite
    await browser.refresh()
    await ensureWorkspaceReady()
  })

  after(async () => {
    // Clean up any open overlays
    await resetOverlays()
    // Optional: reload to clear state for next suite
    await browser.refresh()
  })

  it("does something", async () => {
    // Arrange
    const id = await createCollection("test")

    // Act
    await openCollectionMenu(id)
    await clickByTestId(`collection-menu:item:rename:${id}`)

    // Assert
    const renamed = await getCollectionNameFromTree(id)
    expect(renamed).toBe("test")
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

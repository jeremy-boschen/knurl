# E2E Testing Guide

This document describes the E2E testing infrastructure and patterns for optimal test performance.

## Test Session Architecture

The E2E test suite uses a shared `tauri-driver` instance across all test files. Each test file gets its own isolated config directory to prevent state pollution while keeping initialization costs minimal.

### Initialization Flow

1. **onPrepare** (once per test run): Start single `tauri-driver`, Vite dev server, mock endpoints
2. **beforeSession** (once per test file): Create unique temp config dir, copy test settings fixture
3. **before** (once per describe block): Wait for app ready
4. **Test execution**: Run individual tests
5. **Reload**: Call `resetAppState()` to reload page for next spec file

## Performance Optimizations

### 1. Aggressive Polling Intervals

All WebdriverIO wait operations use a 50ms polling interval (vs default 500ms):

```typescript
// Fast element detection
const element = await getElementByTestId('test-id', 15000, {
  pollingInterval: 50
})

// Fast UI state checks
await browser.waitUntil(
  async () => document.querySelector('[data-test-id="ready"]'),
  { timeout: 10000, interval: 50 }
)
```

This provides ~10x faster detection when UI is ready.

### 2. Test Settings Fixture

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

### 3. Manual Readiness Observation

During test development, press 'M' to log a timestamped readiness marker. Compare these with test detection timestamps to identify UI-test sync issues.

```
[E2E-MANUAL] 2025-11-16T21:08:17.789Z UI appears ready (manually marked)
[TEST] 2025-11-16T21:08:17.738Z Paste button clicked  <- Test detected 51ms after visual ready
```

## Test Consolidation Strategy

Instead of 20+ single-test files, group related tests into feature-focused files:

### Current Example: `import-collection-merge.e2e.ts`

```typescript
describe('Collection Import from OpenAPI', () => {
  before(async () => {
    await ensureWorkspaceReady()  // 5.5s one-time setup
  })

  it('expands sidebar', () => { })      // ~0.5s
  it('opens import dialog', () => { })  // ~0.5s
  it('pastes and imports', () => { })   // ~1s
  it('verifies responsive', () => { })  // ~0.5s
})
```

**Total: 7.5s per file** (1 setup + 4 tests)

### Recommended Consolidation

Instead of:
- 20 files × 5.5s = 110s startup overhead

Consolidate to:
- 5 feature files × 5.5s = 27.5s startup overhead
- 15-20 tests per file = same coverage, 4x faster

Example file structure:
- `collections.e2e.ts` - Create, read, update, delete operations
- `requests.e2e.ts` - Request authoring, execution, responses
- `auth.e2e.ts` - Auth strategies, OAuth, API keys
- `import-export.e2e.ts` - Collection import/export, merge
- `environments.e2e.ts` - Variable management, substitution

## Using resetAppState()

For tests that need to reset between suites within a single file:

```typescript
describe('Multi-suite test', () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  describe('First feature area', () => {
    it('test 1', () => { })
    it('test 2', () => { })

    afterEach(async () => {
      await resetAppState()  // Page reload + wait for ready
    })
  })

  describe('Second feature area', () => {
    it('test 3', () => { })
    it('test 4', () => { })
  })
})
```

However, prefer grouping tests that don't need state reset together to minimize reloads.

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

## Timing Guidelines

| Operation | Expected Time | Notes |
|-----------|---|---|
| App startup | 5.5s | Cold Tauri/React init |
| Page reload | 5.5s | Full re-init from scratch |
| Element detection | 50-150ms | With 50ms polling vs 500-1000ms default |
| Dialog open/close | 1-2s | Includes animations |
| Import parse | 0.1-0.5s | Very fast, UI renders in ~60ms |
| Paste operation | <100ms | Via E2E bridge |

## Common Issues

### Test Waits Too Long for Element

Problem: `getElementByTestId()` waits 15 seconds when element is visible after 100ms

Solution: Element might have different test-id or be in different DOM structure. Check browser console.

### Tests Fail After Running Multiple Files

Problem: State pollution from previous test files

Solution: Tests already use isolated config dirs. If state still bleeds:
1. Check if auto-save is disabled (settings.json has `autoSave: 0`)
2. Consider adding explicit `beforeEach` cleanup
3. Use `resetAppState()` between feature areas

### Keyboard Events Not Reaching App

Problem: `browser.keys(['Control', 'r'])` doesn't reload

Solution: WebDriver focus might be on WebElement instead of window. Use:
```typescript
await browser.execute(() => window.focus())
await browser.keys(['Control', 'r'])
```

## Best Practices

1. **Group related tests** - Minimize number of test files
2. **Avoid hard-coded delays** - Use `waitForExist()`, `waitUntil()`, etc.
3. **Use test IDs** - Always add `data-test-id` to UI elements you interact with
4. **Test user workflows** - Create request → Execute → Verify response (not individual mutations)
5. **Disable auto-save** - Don't need persistent state between tests
6. **Use E2E bridge for system APIs** - Don't try to access Tauri from `browser.execute()` context

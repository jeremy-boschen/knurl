# E2E Test Annotations

This document explains how to use test annotations to control behavior during E2E test execution.

## Overview

Test annotations are special markers placed in test names that trigger conditional behavior in WebdriverIO hooks. They provide a lightweight, declarative way to customize test setup and teardown without writing custom code.

All annotations follow the pattern: `[ANNOTATION_NAME]` in the test name.

## Built-in Annotations

### `[STATE:PRESERVE]`

**Purpose:** Retain all config directory files and settings from the previous test.

**When to use:**
- Testing persistence of state across multiple operations
- Verifying that collections/settings survive app reload
- Multi-step flows where later tests depend on state created by earlier tests

**Effect:**
- The `beforeTest` hook will NOT reset/wipe the config directory
- Files created by the previous test remain intact
- Settings from the previous test are preserved

**Example:**

```typescript
describe('Collection Persistence', () => {
  it('creates a collection', async () => {
    await createCollection('My Collection');
    // Config directory now contains: collections.json, settings.json, etc.
  });

  it('[STATE:PRESERVE] verifies collection exists after reload', async () => {
    // Config directory preserved from previous test!
    await browser.execute(() => window.location.reload());
    await ensureWorkspaceReady();
    // Collection should still exist
    const collection = await getCollectionByName('My Collection');
    expect(collection).toBeDefined();
  });

  it('next test gets fresh state', async () => {
    // This test gets a clean slate (default behavior)
    // Config directory was reset before this test
  });
});
```

### Default Behavior (no annotation)

When a test doesn't have `[STATE:PRESERVE]`:

1. **Config directory is wiped** - All files are deleted
2. **Fresh settings.json is restored** - Copied from `test/fixtures/settings.json`
3. **Clean slate** - Each test starts with a predictable, known state

This ensures test isolation and prevents cross-test pollution.

## How Annotations Work

### The `beforeTest` Hook

The `beforeTest` hook in `wdio.conf.ts` checks each test's name for annotations and adjusts behavior accordingly:

```typescript
beforeTest: async function (test) {
  const preserveState = shouldPreserveState(test.title);

  if (!preserveState) {
    // Reset: delete all files, restore default settings.json
    resetConfigDirectory(configDir);
  }
  // If preserveState is true: do nothing, keep previous state
}
```

This runs **before every individual test** (not before each suite).

### Test Object Structure

The `test` parameter contains:
- `title` - The test name (from `it("...")`)
- `fullTitle` - Full path, e.g. "Collections › Creates collections › first test"
- `file` - Path to the test file
- `parent` - Parent suite name

## Combining Multiple Tests with State Preservation

Here's a practical pattern for testing multi-step workflows:

```typescript
describe('Import & Merge Workflow', () => {
  it('imports initial collection', async () => {
    await importCollection('initial-collection.json');
    // Config now has: initial-collection.json loaded
  });

  it('[STATE:PRESERVE] imports a second collection', async () => {
    // First collection is still loaded
    await importCollection('merge-collection.json');
    // Config now has: both collections loaded
  });

  it('[STATE:PRESERVE] verifies merged collections persist after reload', async () => {
    // Both collections are still there
    await browser.execute(() => window.location.reload());
    await ensureWorkspaceReady();
    // Verify both are in the UI
    expect(await getCollectionByName('initial-collection')).toBeDefined();
    expect(await getCollectionByName('merge-collection')).toBeDefined();
  });

  it('starts fresh for next workflow', async () => {
    // Config was reset: only default settings.json
  });
});
```

## State Annotation Guidelines

### ✅ DO: Use `[STATE:PRESERVE]`

- Testing persistence across app reload
- Multi-step workflows where state matters
- Verifying that files are written to disk correctly
- Building up complex state incrementally and testing the final result

### ❌ DON'T: Use `[STATE:PRESERVE]`

- For isolated unit-like E2E tests (each test should be independent)
- When test isolation is critical (use default behavior instead)
- To work around test flakiness (that's a code smell—fix the flaky test)
- To hide test setup (use helper functions in shared support files instead)

## Config Directory Reset Details

When a test runs without `[STATE:PRESERVE]`, the reset process:

1. **Deletes all files** in the config directory (collections, caches, temp files, etc.)
2. **Copies fresh `settings.json`** from `test/fixtures/settings.json`
3. **Ensures predictable defaults** like `autoSave: 0` (disabled during tests)

This guarantees:
- Each test starts with identical settings
- No leftover data from previous tests
- Consistent behavior across test runs

## Logging & Debugging

The E2E test hooks log detailed information about state management:

```
[beforeTest] 📋 Starting test: "verifies collection persists"
  title: "verifies collection persists" | fullTitle: "Collections › verifies collection persists"
  state annotation: [STATE:PRESERVE] 💾
  ✓ Preserving config directory state from previous test
```

Check the test output for:
- Whether state was preserved or reset
- What config directory path is being used
- Which settings.json was applied

## Future Annotations

Additional annotations can be added to `wdio.conf.ts` as needed:

```typescript
// Example: future annotation
if (test.title.includes('[SLOW]')) {
  // Increase Mocha timeout to 120s
  this.timeout(120000);
}

if (test.title.includes('[BROWSER:WEBKIT]')) {
  // Only run on WebKit (if we have multi-browser support)
  skipIfNotWebKit();
}
```

Simply add the check to `beforeTest`, and document it here.

## Troubleshooting

### Tests pass individually but fail in sequence

**Problem:** Test A passes alone, but fails when run after Test B.

**Solution:** Check if Test B should have `[STATE:PRESERVE]`. If not, the test might be too sensitive to initial state. Use the logging to verify when state is being reset.

### State seems to not persist even with `[STATE:PRESERVE]`

**Problem:** Marked test with `[STATE:PRESERVE]` but state still gets cleared.

**Solution:** Check:
1. Is the annotation exactly `[STATE:PRESERVE]` (case-sensitive)?
2. Is it in the test title, not in the describe block?
3. Check the console logs to confirm the annotation was detected

### Can't tell if state was reset

**Solution:** Look at the `beforeTest` logs:

```
[beforeTest] 📋 Starting test: "my test"
  state annotation: reset to defaults        ← State will be reset
  ✓ Config directory reset                   ← Confirms reset happened
```

vs.

```
[beforeTest] 📋 Starting test: "[STATE:PRESERVE] my test"
  state annotation: [STATE:PRESERVE] 💾      ← State will be preserved
  ✓ Preserving config directory state...     ← Confirms state kept
```

## References

- `wdio.conf.ts` - Hook implementations and state management utilities
- `test/fixtures/settings.json` - Default settings used for reset
- `test/support/` - Helper functions for UI interactions and state setup

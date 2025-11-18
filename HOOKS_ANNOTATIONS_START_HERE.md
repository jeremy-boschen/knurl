# E2E Test Hooks & Annotations - START HERE 🚀

This document is your entry point. Start here, then follow the links to more detailed information.

## What This Is About

The E2E testing infrastructure in Knurl has comprehensive support for controlling test behavior through:

1. **WebdriverIO Hooks** - Functions that run at different stages of test execution
2. **Test Annotations** - Special markers in test names that control behavior

## Quick Example

### Default: Clean slate for each test

```typescript
it('creates a collection', async () => {
  await createCollection('My Collection');
  // Config directory will be reset before next test
});
```

### With annotation: Keep state from previous test

```typescript
it('[STATE:PRESERVE] verifies collection persists after reload', async () => {
  // Config directory from previous test is intact!
  await browser.execute(() => window.location.reload());
  // Collection created in previous test should still exist
});
```

## The 3 Annotation Concepts

### 1. Per-Test Reset (Default)
Every test starts with:
- Empty config directory
- Fresh `settings.json` from fixtures
- Predictable, isolated state

### 2. State Preservation (Optional)
Add `[STATE:PRESERVE]` to a test name to:
- Keep files from previous test
- Build on previous test's state
- Test multi-step workflows

### 3. Hook Logging (Automatic)
All hooks log their actions:
- What stage is running
- What state actions are taken
- Test duration and result

## Quick Navigation

📖 **1-minute overview:** Read "Annotation Examples" below

📖 **5-minute guide:** `docs/E2E_QUICK_REFERENCE.md`

📖 **Complete documentation:** `docs/E2E_ANNOTATIONS.md`

📖 **All hooks explained:** `docs/E2E_HOOKS_REFERENCE.md`

📖 **Technical details:** `docs/E2E_IMPLEMENTATION_SUMMARY.md`

## Annotation Examples

### ❌ DON'T (unless you need state)

```typescript
describe('Collections', () => {
  it('creates a collection', async () => {
    await createCollection('Test');
    expect(await getCollectionByName('Test')).toBeDefined();
  });

  it('renames a collection', async () => {
    // This test expects a fresh start
    // But the previous test created 'Test'!
    // Default behavior resets, so this is fine
  });
});
```

### ✅ DO (keep related tests together with state)

```typescript
describe('Collection Persistence', () => {
  it('creates a collection', async () => {
    await createCollection('My Collection');
    // Save something to disk
  });

  it('[STATE:PRESERVE] verifies collection loads on startup', async () => {
    // Collection from previous test is still in config directory
    await browser.execute(() => window.location.reload());
    await ensureWorkspaceReady();
    // Verify it loaded
    expect(await getCollectionByName('My Collection')).toBeDefined();
  });

  it('[STATE:PRESERVE] adds a request to the collection', async () => {
    // Still have the collection from step 1
    await createRequest('GET /api/users');
    // Modify it
  });

  it('[STATE:PRESERVE] verifies full state persists', async () => {
    // Both collection and request from previous steps exist
    await browser.execute(() => window.location.reload());
    await ensureWorkspaceReady();
    expect(await getCollectionByName('My Collection')).toBeDefined();
    expect(await getRequestByName('GET /api/users')).toBeDefined();
  });

  it('fresh test gets clean state', async () => {
    // Default: config dir was reset
    // This test starts from scratch
  });
});
```

## When to Use `[STATE:PRESERVE]`

### ✅ Use it for:
- **Multi-step workflows** - Creating → modifying → verifying
- **Persistence testing** - Data survives reload
- **Integration tests** - Testing data flows between components
- **State-dependent features** - Features that build on app state

### ❌ Don't use it for:
- **Isolated unit tests** - Each test should be independent
- **Testing different features** - Don't couple unrelated tests
- **Working around flaky tests** - Fix the test, don't hide it

## How It Works Under the Hood

### Before Each Test

```
[beforeTest hook]
  ├─ Check if test name contains [STATE:PRESERVE]
  ├─ If NO [STATE:PRESERVE]:
  │  ├─ Delete all files in config directory
  │  └─ Copy fresh settings.json from fixtures
  └─ If [STATE:PRESERVE]:
     └─ Do nothing, keep previous state
```

### Config Directory Reset

When NOT using `[STATE:PRESERVE]`:

```
Before Test 1:  Config dir = empty (fresh)
After Test 1:   Config dir = { collections.json, settings.json }

Before Test 2:  Config dir = empty (reset!)
After Test 2:   Config dir = { different collections.json }

Before Test 3:  Config dir = empty (reset!)
After Test 3:   Config dir = { yet different collections.json }
```

When using `[STATE:PRESERVE]`:

```
Before Test 1:  Config dir = empty (fresh)
After Test 1:   Config dir = { collections.json, settings.json }

Before Test 2 [STATE:PRESERVE]:  Config dir = UNCHANGED
After Test 2:   Config dir = { updated collections.json, settings.json }

Before Test 3 [STATE:PRESERVE]:  Config dir = UNCHANGED
After Test 3:   Config dir = { more updates }
```

## Console Output

Run any test and watch for the logging:

```
[beforeTest] 📋 Starting test: "creates a collection"
  title: "creates a collection"
  state annotation: reset to defaults
  resetting config directory...
  ✓ Config directory reset

[beforeTest] 📋 Starting test: "[STATE:PRESERVE] verifies persistence"
  title: "[STATE:PRESERVE] verifies persistence"
  state annotation: [STATE:PRESERVE] 💾
  ✓ Preserving config directory state from previous test

[afterTest] ✓ Test complete: "verifies persistence"
  duration: 3214ms | state: passed
  ✓ Coverage data collected and saved
```

## The 10 WebdriverIO Hooks

All hooks run automatically and log what they're doing:

| Hook | When | Scope | Purpose |
|------|------|-------|---------|
| `onPrepare` | Start of run | Once | Build Rust, start services |
| `beforeSession` | Session starts | Per-session | Create config dir |
| `before` | Before first test | Per-session | Wait for app, inject globals |
| `beforeSuite` | Suite starts | Per-suite | Log suite info |
| `beforeTest` | Before each test | Per-test | Reset state (or preserve it) ⭐ |
| `afterTest` | After each test | Per-test | Collect coverage |
| `afterSuite` | Suite ends | Per-suite | Log completion |
| `after` | After all tests | Per-session | Final cleanup |
| `afterSession` | Session ends | Per-session | Session teardown |
| `onComplete` | End of run | Once | Kill all processes |

**Most important for you:** `beforeTest` (where state management happens)

## Tips

1. **Use clear test names** - Explain what the test does, not just that it tests
2. **Group related tests** - Keep multi-step tests together in same suite
3. **Document why** - Add comments explaining `[STATE:PRESERVE]`
4. **Watch the logs** - They tell you exactly what's happening
5. **Test the feature** - State preservation is for testing real workflows, not a workaround

## Common Patterns

### Testing Import/Export

```typescript
it('exports collection to JSON', async () => {
  await exportCollection('My Collection', 'backup.json');
});

it('[STATE:PRESERVE] imports the exported JSON', async () => {
  const imported = await importCollection('backup.json');
  expect(imported).toEqual(expect.objectContaining({ name: 'My Collection' }));
});
```

### Testing Persistence

```typescript
it('creates environment variables', async () => {
  await createEnvironment('staging', { API_URL: 'https://staging.api' });
});

it('[STATE:PRESERVE] verifies persistence after reload', async () => {
  await browser.execute(() => window.location.reload());
  await ensureWorkspaceReady();
  const vars = await getEnvironmentVariables('staging');
  expect(vars.API_URL).toBe('https://staging.api');
});
```

### Testing Complex Workflows

```typescript
it('step 1: imports collection', async () => { ... });
it('[STATE:PRESERVE] step 2: adds requests', async () => { ... });
it('[STATE:PRESERVE] step 3: sets up environments', async () => { ... });
it('[STATE:PRESERVE] step 4: verifies full setup', async () => { ... });
```

## What Changed

✅ **Added `beforeTest` hook** - Manages state reset/preservation
✅ **Added `beforeSuite` hook** - Logs suite start
✅ **Added `afterSuite` hook** - Logs suite completion
✅ **Enhanced all hooks** - Added detailed logging
✅ **Added utilities** - State management functions
✅ **No breaking changes** - Existing tests work exactly as before

## Next Steps

1. **Understand state preservation:** Read the examples above
2. **Review quick reference:** Open `docs/E2E_QUICK_REFERENCE.md`
3. **Use in your tests:** Add `[STATE:PRESERVE]` to relevant tests
4. **Watch the logs:** Run tests and see the hooks in action
5. **Learn more:** Check `docs/E2E_ANNOTATIONS.md` for details

## Quick Commands

```bash
# Run a test and watch the hooks log their work
yarn test:e2e --spec=test/specs/collections-core.e2e.ts

# Look for output like:
# [beforeTest] 📋 Starting test: ...
# [afterTest] ✓ Test complete: ...
```

## Files to Know

| File | Purpose |
|------|---------|
| `wdio.conf.ts` | Hook implementations |
| `docs/E2E_QUICK_REFERENCE.md` | 1-page quick guide |
| `docs/E2E_ANNOTATIONS.md` | Complete annotation docs |
| `docs/E2E_HOOKS_REFERENCE.md` | All hooks explained |
| `test/fixtures/settings.json` | Default settings for reset |

## Questions?

- **How do hooks work?** → `docs/E2E_HOOKS_REFERENCE.md`
- **When should I use `[STATE:PRESERVE]`?** → `docs/E2E_ANNOTATIONS.md`
- **What's the config directory?** → `docs/E2E_QUICK_REFERENCE.md`
- **How do I debug state issues?** → Troubleshooting section in `docs/E2E_ANNOTATIONS.md`

---

**Ready?** Open `docs/E2E_QUICK_REFERENCE.md` for a quick overview, or jump into using `[STATE:PRESERVE]` in your tests! 🚀

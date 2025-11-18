# E2E Test Hooks & Annotations - Quick Reference

## Test Annotation: `[STATE:PRESERVE]`

### What it does
Preserves the config directory state from the previous test instead of resetting it.

### How to use
Add `[STATE:PRESERVE]` anywhere in your test name:

```typescript
it('[STATE:PRESERVE] verifies collection persists after reload', async () => {
  // Config directory from previous test is intact
});
```

### When to use
✅ Multi-step workflows
✅ Testing persistence across reload
✅ Building complex state incrementally

### When NOT to use
❌ Each test should be independent
❌ To work around test flakiness
❌ When isolation is critical

---

## Default Behavior (no annotation)

Each test starts with a clean config directory:
- All previous files are deleted
- Fresh `settings.json` is copied from `test/fixtures/settings.json`
- Ensures test isolation and predictability

---

## WebdriverIO Hooks Overview

### Global (run once per entire test run)
| Hook | When | What it logs |
|------|------|------------|
| `onPrepare` | Before any tests | Building Rust, starting Vite, mock server |
| `onComplete` | After all tests | Killing processes, cleanup |

### Per-Session (run once per browser session)
| Hook | When | What it logs |
|------|------|------------|
| `beforeSession` | Session startup | Creating config dir |
| `before` | Before first test | App startup state, injecting globals |
| `after` | After all tests | Post-session cleanup |
| `afterSession` | Session end | Session ending |

### Per-Test (run for each individual test)
| Hook | When | What it logs |
|------|------|------------|
| `beforeTest` | Before each test | State reset/preservation decision |
| `afterTest` | After each test | Test result, coverage collection |

### Per-Suite (run for each test suite)
| Hook | When | What it logs |
|------|------|------------|
| `beforeSuite` | Suite starts | Suite name and test count |
| `afterSuite` | Suite ends | Suite completion |

---

## Example: Multi-Step Test Flow

```typescript
describe('Collection Persistence', () => {
  it('step 1: creates a collection', async () => {
    await createCollection('Test Collection');
    // Config dir now has: collections.json
  });

  it('[STATE:PRESERVE] step 2: adds a request to collection', async () => {
    // collections.json still exists from step 1
    await createRequest('GET /api/endpoint');
    // Config dir now has: collections.json (updated with request)
  });

  it('[STATE:PRESERVE] step 3: verifies persistence after reload', async () => {
    // collections.json still exists
    await browser.execute(() => window.location.reload());
    await ensureWorkspaceReady();
    // Verify collection and request are still there
    expect(await getCollectionByName('Test Collection')).toBeDefined();
  });

  it('step 4: next test gets fresh start', async () => {
    // Config dir was reset: only default settings.json
    // This test is completely isolated from previous tests
  });
});
```

---

## Console Output Quick Guide

### State is being reset
```
[beforeTest] 📋 Starting test: "creates a collection"
  state annotation: reset to defaults
  ✓ Config directory reset
```

### State is being preserved
```
[beforeTest] 📋 Starting test: "[STATE:PRESERVE] verifies persistence"
  state annotation: [STATE:PRESERVE] 💾
  ✓ Preserving config directory state from previous test
```

### Test passed with coverage collected
```
[afterTest] ✓ Test complete: "creates a collection"
  duration: 4523ms | state: passed
  ✓ Coverage data collected and saved
```

---

## Common Patterns

### Testing import/export roundtrip
```typescript
it('exports collection as JSON', async () => {
  await exportCollection('My Collection', 'export.json');
});

it('[STATE:PRESERVE] imports exported collection', async () => {
  // export.json still exists from previous test
  await importCollection('export.json');
  // Verify import worked
});
```

### Testing data persistence
```typescript
it('creates environment variables', async () => {
  await createEnvironment('dev', { API_KEY: 'secret' });
});

it('[STATE:PRESERVE] verifies variables persist after reload', async () => {
  await browser.execute(() => window.location.reload());
  await ensureWorkspaceReady();
  const vars = await getEnvironmentVariables('dev');
  expect(vars.API_KEY).toBe('secret');
});
```

### Testing merge workflows
```typescript
it('imports first collection', async () => {
  await importCollection('collection-1.json');
});

it('[STATE:PRESERVE] imports second collection to merge', async () => {
  await importCollection('collection-2.json');
});

it('[STATE:PRESERVE] verifies both collections exist', async () => {
  expect(await getCollectionByName('collection-1')).toBeDefined();
  expect(await getCollectionByName('collection-2')).toBeDefined();
});
```

---

## Troubleshooting

### Problem: State reset when I used `[STATE:PRESERVE]`
**Check:**
- Exact spelling: `[STATE:PRESERVE]` (case-sensitive)
- In test name, not in describe block
- Check logs: `state annotation: [STATE:PRESERVE] 💾` confirms it worked

### Problem: Tests pass alone but fail in sequence
**Likely cause:** Test B creates state that test A doesn't expect
**Solution:** Mark test B with `[STATE:PRESERVE]` if state should flow forward, or verify test A cleans up after itself

### Problem: Can't tell what's happening with state
**Solution:** Look at logs:
- `reset to defaults` = config dir was wiped
- `[STATE:PRESERVE]` = config dir was kept
- Files in config dir: check with test helpers

---

## Tips & Best Practices

1. **Default to isolation** - Use default reset behavior unless you have a reason to preserve state
2. **Group related tests** - Put tests that need state together in same suite
3. **Document why** - Add comments explaining why `[STATE:PRESERVE]` is needed
4. **Test the feature, not the infrastructure** - State preservation is a tool for testing real workflows, not a workaround
5. **Read the logs** - The detailed logging helps understand exactly what's happening

---

## Files to Know

| File | Purpose |
|------|---------|
| `wdio.conf.ts` | Hook implementations and state management |
| `docs/E2E_ANNOTATIONS.md` | Full annotation documentation |
| `test/fixtures/settings.json` | Default settings used for reset |
| `test/support/ui.ts` | UI interaction helpers |
| `test/support/state.ts` | State management helpers |

---

## More Information

- Full docs: `docs/E2E_ANNOTATIONS.md`
- Implementation details: `docs/E2E_IMPLEMENTATION_SUMMARY.md`
- Hook source: `wdio.conf.ts` (lines 200-626)

# E2E Test Hooks & Annotations Implementation Summary

## Overview

This document summarizes the comprehensive additions made to the E2E testing infrastructure in `wdio.conf.ts` and related documentation.

## Changes Made

### 1. ✅ All WebdriverIO Hooks Implemented with Logging

Added every possible WebdriverIO hook with detailed console logging that tracks the test lifecycle. Hooks follow the execution flow from global preparation through per-test execution to final cleanup.

#### Session & Global Hooks

| Hook | Scope | Logging | Purpose |
|------|-------|---------|---------|
| `onPrepare` | Once per entire test run | ✅ Full logging | Build Rust, start Vite, mock server, tauri-driver |
| `beforeSession` | Once per browser session | ✅ Full logging | Create unique config dir, inject Tauri args |
| `before` | Once per session, before first test | ✅ Full logging | Wait for app startup, inject test globals |
| `after` | Once per session, after all tests | ✅ Full logging | Session cleanup (coverage post-processing deferred) |
| `afterSession` | Once per session, after tests end | ✅ Full logging | Mark session as ending |
| `onComplete` | Once after all workers finish | ✅ Full logging | Kill all processes, clean ports |

#### Per-Test Hooks

| Hook | Scope | Logging | Purpose |
|------|-------|---------|---------|
| `beforeTest` | Before each individual test | ✅ Full logging | Reset config dir (unless `[STATE:PRESERVE]`) |
| `afterTest` | After each individual test | ✅ Full logging | Collect coverage, log test result |
| `beforeSuite` | Before each test suite | ✅ Full logging | Log suite start info |
| `afterSuite` | After each test suite | ✅ Full logging | Log suite completion |

#### Sample Log Output

```
================================================================================
[onPrepare] 🔧 Global test preparation (run once for entire test suite)
  timestamp: 2025-11-18T10:30:45.123Z
  cleaning up processes on critical ports...
  killing lingering processes from previous runs...
  ✓ Process cleanup complete
  starting mock endpoint server on port 3000...
  ✓ Mock endpoint server ready
  configuring OAuth environment variables...
  ✓ OAuth configured (issuer: http://127.0.0.1:3000)
  ✓ Environment variables set
  building Rust backend...
  ✓ Rust backend built successfully
  starting Vite dev server on port 1420...
  ✓ Vite dev server ready
  starting tauri-driver...
  ✓ tauri-driver started and ready
[onPrepare] ✓ Global test preparation complete

================================================================================
[beforeSession] 🚀 Session initialization starting
  capabilities: tauri:options
  specs: 25 spec files
  configDir: /tmp/knurl-e2e-config-abc123
  ✓ Copied settings.json fixture to config directory
  ✓ Injected --config-dir into Tauri args
[beforeSession] ✓ Session initialization complete

[beforeSuite] 📦 Suite starting: "Collections Management & Storage"
  fullTitle: "Collections Management & Storage › Collections Management UX"
  tests in suite: 8

[before] 🌐 Per-session setup (run once per session, before first test)
  waiting for app to reach startup state 2...
  ✓ App startup state reached
  ✓ Injected __KNURL_E2E_CONFIG_DIR__ into window
  ✓ Enabled event history tracking
  ✓ Stabilization pause complete
[before] ✓ Per-session setup complete

[beforeTest] 📋 Starting test: "creates, renames, and deletes collections"
  title: "creates, renames, and deletes collections" | fullTitle: "Collections Management & Storage › Collections Management UX › creates..."
  state annotation: reset to defaults
  resetting config directory...
  ✓ Config directory reset

[beforeTest] 📋 Starting test: "[STATE:PRESERVE] verifies collections persist after reload"
  title: "[STATE:PRESERVE] verifies collections persist after reload"
  state annotation: [STATE:PRESERVE] 💾
  ✓ Preserving config directory state from previous test

[ ... test runs ... ]

[afterTest] ✓ Test complete: "creates, renames, and deletes collections"
  title: "creates, renames, and deletes collections" | fullTitle: "..."
  duration: 4523ms | state: passed
  ✓ Coverage data collected and saved

[afterTest] ✓ Test complete: "[STATE:PRESERVE] verifies collections persist after reload"
  title: "[STATE:PRESERVE] verifies collections persist after reload"
  duration: 3214ms | state: passed
  ✓ Coverage data collected and saved

[afterSuite] 📦 Suite complete: "Collections Management & Storage"
  fullTitle: "Collections Management & Storage › Collections Management UX"

[after] 🏁 Post-session cleanup (run once per session, after all tests)
[after] ✓ Session cleanup complete

[afterSession] 🏁 Session ending

================================================================================
[onComplete] 🛑 Global test completion (run once after all test workers finish)
  timestamp: 2025-11-18T10:45:30.456Z
  stopping all test infrastructure...
  waiting for processes to terminate gracefully...
  killing processes on critical ports...
  killing lingering process patterns...
  ✓ All processes cleaned up
[onComplete] ✓ Global test completion done

================================================================================
```

### 2. ✅ Test Annotation System Implemented

Added a lightweight annotation system using test name patterns. Currently supports:

#### `[STATE:PRESERVE]` Annotation

**Pattern:** Include `[STATE:PRESERVE]` anywhere in the test name

**Effect:** The `beforeTest` hook will NOT reset the config directory before running the test

**Implementation:**
```typescript
// In beforeTest hook
const preserveState = shouldPreserveState(test.title); // Checks for '[STATE:PRESERVE]'

if (!preserveState && configDir) {
  resetConfigDirectory(configDir); // Wipe & restore default settings.json
} else if (preserveState && configDir) {
  // Keep previous config directory intact
}
```

**Use case:** Multi-step test workflows where state must persist across tests:

```typescript
it('creates a collection', async () => {
  await createCollection('My Collection');
});

it('[STATE:PRESERVE] verifies collection persists after reload', async () => {
  // Collection from previous test still exists
  await browser.execute(() => window.location.reload());
  // ... verify collection is still there
});
```

### 3. ✅ `beforeTest` Hook with State Management

Complete implementation of the `beforeTest` hook that:

1. **Detects annotations** in test names using `shouldPreserveState()`
2. **Resets config directory** by default:
   - Deletes all files in config dir
   - Copies fresh `settings.json` from `test/fixtures/settings.json`
3. **Preserves state** when `[STATE:PRESERVE]` is detected
4. **Logs everything** with detailed output showing what action was taken

#### State Reset Process

```typescript
function resetConfigDirectory(configDir: string): void {
  // 1. Delete all files
  const files = readdirSync(configDir);
  for (const file of files) {
    rmSync(filePath, { recursive: true, force: true });
  }

  // 2. Restore default settings.json
  copyFileSync(fixtureSettingsPath, configSettingsPath);
}
```

## Utility Functions Added

All state management utilities are defined in `wdio.conf.ts`:

```typescript
// Check for [STATE:PRESERVE] annotation
shouldPreserveState(testTitle: string): boolean

// Wipe config dir and restore defaults
resetConfigDirectory(configDir: string): void

// Format test metadata for logging
formatTestMetadata(test: any): string

// Format test result for logging
formatTestResult(result: any): string
```

## Files Modified

### `wdio.conf.ts` (Primary changes)

- Added imports: `rmSync`, `readdirSync`, `copyFileSync` from `fs`
- Added documentation block (lines 27-43)
- Added state management utilities section (lines 45-104)
- Enhanced `onPrepare` hook with logging (lines 200-425)
- Enhanced `beforeSession` hook with logging (lines 429-451)
- **Added `beforeTest` hook** (lines 455-470) ⭐
- **Added `beforeSuite` hook** (lines 473-477) ⭐
- Enhanced `before` hook with logging (lines 503-541)
- Enhanced `afterTest` hook with logging (lines 545-579) ⭐ Added `result` parameter
- **Added `afterSuite` hook** (lines 582-585) ⭐
- Enhanced `after` hook with logging (lines 588-591)
- Enhanced `onComplete` hook with logging (lines 594-626)

### `docs/E2E_ANNOTATIONS.md` (New file)

Comprehensive documentation covering:
- Overview of the annotation system
- `[STATE:PRESERVE]` annotation details
- How annotations work under the hood
- Multiple test patterns (isolation, state preservation, workflows)
- Guidelines (when to use/not use)
- Debugging troubleshooting
- Future extensibility examples

## Hook Execution Order (Quick Reference)

```
onPrepare                           ← Once, at very start
  ↓
beforeSession                       ← Once per session
  ↓
before                              ← Once per session, before first test
  ↓
[For each test in suite]
  ├─ beforeSuite                    ← Once per suite
  ├─ beforeTest                     ← Before each test (resets state by default)
  ├─ [Test runs]
  ├─ afterTest                      ← After each test (collects coverage)
  └─ afterSuite                     ← Once per suite
  ↓
after                               ← Once per session, after all tests
  ↓
afterSession                        ← Once per session
  ↓
onComplete                          ← Once, at very end
```

## Testing the Implementation

### Quick test to verify hooks work:

```bash
# Run a single test file to see all the logging
yarn test:e2e --spec=test/specs/collections-core.e2e.ts

# Look for output like:
# [beforeTest] 📋 Starting test: ...
# [afterTest] ✓ Test complete: ...
```

### Test the [STATE:PRESERVE] annotation:

```typescript
// In any test file
it('creates a resource', async () => {
  // Create something
});

it('[STATE:PRESERVE] verifies resource persists', async () => {
  // This test will have the resource from the previous test
});
```

Watch the logs:
```
[beforeTest] 📋 Starting test: "creates a resource"
  state annotation: reset to defaults
  ✓ Config directory reset

[beforeTest] 📋 Starting test: "[STATE:PRESERVE] verifies resource persists"
  state annotation: [STATE:PRESERVE] 💾
  ✓ Preserving config directory state from previous test
```

## Benefits

✅ **Visibility** - See exactly what happens at each lifecycle stage
✅ **Isolation** - Tests are independent by default (config reset each time)
✅ **Flexibility** - Easy to preserve state when needed with simple annotation
✅ **Debuggability** - Detailed logs help troubleshoot test issues
✅ **Extensibility** - Add new annotations to `beforeTest` easily
✅ **No breaking changes** - Existing tests work exactly as before, just with logging

## Migration Notes

**Existing tests:** No changes needed! All tests continue to work. The state reset is the default behavior (same as before).

**New tests needing state:** Just add `[STATE:PRESERVE]` to test names for tests that need to preserve previous state.

## Future Enhancements

The annotation system is extensible. Examples of future annotations that could be added:

```typescript
// In beforeTest hook
if (test.title.includes('[SLOW]')) {
  this.timeout(120000); // Increase timeout
}

if (test.title.includes('[FLAKY]')) {
  // Run with retries
}

if (test.title.includes('[BROWSER:WEBKIT]')) {
  skipIfNotWebKit(); // Platform-specific
}
```

## References

- Full annotation documentation: `docs/E2E_ANNOTATIONS.md`
- Configuration file: `wdio.conf.ts`
- Test helpers: `test/support/`
- Example tests using annotations: Look for `[STATE:PRESERVE]` in test specs

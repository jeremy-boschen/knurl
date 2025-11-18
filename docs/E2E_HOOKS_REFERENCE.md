# E2E Hooks Complete Reference

Complete reference guide for all WebdriverIO hooks available during E2E testing, with signatures, scopes, and implementations in `wdio.conf.ts`.

## Hook Execution Timeline

```
┌─────────────────────────────────────────────────────────────┐
│ onPrepare()                                                 │
│ Runs: Once at the very beginning                            │
│ When: Before any worker processes spawn                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ For each test session/capability:                           │
│                                                             │
│ beforeSession(config, capabilities, specs)                  │
│ Runs: Once per session                                      │
│ When: Before WebDriver session initializes                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ before()                                                    │
│ Runs: Once per session                                      │
│ When: After session connects, before first test             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ For each test suite in the session:                         │
│                                                             │
│ beforeSuite(suite)                                          │
│ Runs: Once per suite                                        │
│ When: Before suite tests execute                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ For each test in the suite:                                 │
│                                                             │
│ beforeTest(test)                                            │
│ Runs: Before every test                                     │
│ When: Immediately before test execution                     │
│                                                             │
│ [TEST EXECUTES]                                             │
│                                                             │
│ afterTest(test, result)                                     │
│ Runs: After every test                                      │
│ When: Immediately after test execution                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ afterSuite(suite)                                           │
│ Runs: Once per suite                                        │
│ When: After all suite tests complete                        │
└─────────────────────────────────────────────────────────────┘
                              ↓ (repeat for next suite)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ after()                                                     │
│ Runs: Once per session                                      │
│ When: After all tests in session complete                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ afterSession()                                              │
│ Runs: Once per session                                      │
│ When: Right after WebDriver session ends                    │
└─────────────────────────────────────────────────────────────┘
                              ↓ (repeat for next session)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ onComplete()                                                │
│ Runs: Once at the very end                                  │
│ When: After all workers and sessions finish                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Global Hooks

### `onPrepare()`

**Signature:**
```typescript
onPrepare: async () => {
  // Global setup code
}
```

**When it runs:**
- Once at the start of the entire test run
- Before any worker processes are spawned
- Before any sessions connect

**Scope:** Global (one execution for entire run)

**Currently implemented in Knurl:**
```typescript
onPrepare: async () => {
  console.log('[onPrepare] 🔧 Global test preparation');

  // Kill lingering processes from previous runs
  killProcessesOnPort(1420);
  killProcessesByPattern('vite');
  killProcessesByPattern('tauri-driver');

  // Start mock endpoint server on port 3000
  mockEndpointProcess = spawn('node', ['scripts/mock-endpoint-server.mjs'], ...);
  await waitForEndpoint(...);

  // Build Rust backend
  const buildResult = spawnSync('cargo', ['build', ...]);

  // Start Vite dev server on port 1420
  viteProcess = spawn('vite', [...]);
  await waitForDevServer('http://127.0.0.1:1420');

  // Start tauri-driver
  tauriDriver = spawn(tauriDriverBinary, [...]);
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('[onPrepare] ✓ Global test preparation complete');
}
```

**Use cases:**
- Build dependencies (compile Rust, bundle JS)
- Start long-lived services (servers, drivers)
- Set up global environment variables
- Pre-flight checks

---

### `onComplete()`

**Signature:**
```typescript
onComplete: async () => {
  // Global cleanup code
}
```

**When it runs:**
- Once at the end of the entire test run
- After all workers have finished
- After all sessions have closed

**Scope:** Global (one execution for entire run)

**Currently implemented in Knurl:**
```typescript
onComplete: async () => {
  console.log('[onComplete] 🛑 Global test completion');

  closeProcesses(); // Kill tauri-driver, vite, mock endpoint

  // Clean up ports and lingering processes
  await new Promise((resolve) => setTimeout(resolve, 500));
  killProcessesOnPort(1420);
  killProcessesOnPort(4444);
  killProcessesByPattern('vite');
  killProcessesByPattern('tauri-driver');
  killProcessesByPattern('knurl');

  console.log('[onComplete] ✓ Global test completion done');
}
```

**Use cases:**
- Kill long-running services
- Clean up system resources
- Generate final reports
- Final sanity checks

---

## Session-Level Hooks

### `beforeSession(config, capabilities, specs)`

**Signature:**
```typescript
beforeSession: async (config, capabilities, specs) => {
  // Per-session setup
}
```

**Parameters:**
- `config` - WebdriverIO configuration object
- `capabilities` - Capabilities for this session
- `specs` - Array of spec files for this session

**When it runs:**
- Once per session/capability
- Before WebDriver session connects to browser
- After `onPrepare()` completes

**Scope:** Per-session (one per browser instance)

**Currently implemented in Knurl:**
```typescript
beforeSession: async (config, capabilities, specs) => {
  console.log('[beforeSession] 🚀 Session initialization');

  // Create unique config dir
  const configDir = mkdtempSync(path.join(tmpdir(), 'knurl-e2e-config-'));
  configDirsByCapability.set(process.pid, configDir);

  // Copy settings fixture
  copyFileSync(fixtureSettingsPath, configSettingsPath);

  // Inject into Tauri args
  capabilities['tauri:options'].args.push(`--config-dir=${normalizedConfigDir}`);

  console.log('[beforeSession] ✓ Session initialization complete');
}
```

**Use cases:**
- Create session-specific directories
- Configure session-specific environment variables
- Apply capability-specific settings

---

### `before()`

**Signature:**
```typescript
before: async () => {
  // Called with access to browser object
}
```

**When it runs:**
- Once per session
- After WebDriver session connects and app loads
- Before first test in the session

**Scope:** Per-session (one per browser instance)

**Has access to:**
- `browser` object (for WebDriver commands)

**Currently implemented in Knurl:**
```typescript
before: async () => {
  console.log('[before] 🌐 Per-session setup');

  // Wait for app to reach startup state 2
  await browser.waitUntil(async () => {
    const state = await browser.execute(() => window.__KNURL_STARTUP_STATE__ ?? 0);
    return state === 2;
  }, { timeout: 60000 });

  // Inject config directory path into window
  const configDir = configDirsByCapability.get(process.pid);
  await browser.execute((dir) => {
    window.__KNURL_E2E_CONFIG_DIR__ = dir;
  }, configDir);

  // Enable event history tracking
  await browser.execute(() => {
    window.__KNURL_ENABLE_EVENT_HISTORY = true;
  });

  await browser.pause(2000);
  console.log('[before] ✓ Per-session setup complete');
}
```

**Use cases:**
- Wait for app readiness
- Inject test globals into window
- Set up browser state
- Wait for initial loads

---

### `after()`

**Signature:**
```typescript
after: async () => {
  // Called with access to browser object
}
```

**When it runs:**
- Once per session
- After all tests in the session complete
- Before `afterSession()` runs

**Scope:** Per-session (one per browser instance)

**Has access to:**
- `browser` object (for WebDriver commands)

**Currently implemented in Knurl:**
```typescript
after: async () => {
  console.log('[after] 🏁 Post-session cleanup');
  // Coverage merge is handled separately by scripts/aggregate-e2e-coverage.mjs
  console.log('[after] ✓ Session cleanup complete');
}
```

**Use cases:**
- Final session-level cleanup
- Generate session reports
- Close resources gracefully

---

### `afterSession()`

**Signature:**
```typescript
afterSession: () => {
  // No browser access here
}
```

**When it runs:**
- Once per session
- After all tests complete
- After `after()` runs
- Right before session closes

**Scope:** Per-session (one per browser instance)

**Currently implemented in Knurl:**
```typescript
afterSession: () => {
  console.log('[afterSession] 🏁 Session ending');
  // tauri-driver cleanup is handled in onShutdown
}
```

**Use cases:**
- Final per-session cleanup (no browser access)
- Record session statistics

---

## Per-Suite Hooks

### `beforeSuite(suite)`

**Signature:**
```typescript
beforeSuite: async (suite) => {
  // Per-suite setup
}
```

**Parameters:**
- `suite` - Suite object with properties:
  - `title` - Suite name
  - `fullTitle` - Full path to suite
  - `tests` - Array of tests in suite

**When it runs:**
- Once per test suite (describe block)
- Before any tests in that suite run

**Scope:** Per-suite

**Currently implemented in Knurl:**
```typescript
beforeSuite: async (suite) => {
  console.log('[beforeSuite] 📦 Suite starting: "${suite.title}"');
  console.log(`  fullTitle: "${suite.fullTitle}"`);
  console.log(`  tests in suite: ${suite.tests?.length || 'unknown'}`);
}
```

**Use cases:**
- Suite-level setup
- Logging suite start
- Conditionally skip entire suite
- Set suite-level timeouts

---

### `afterSuite(suite)`

**Signature:**
```typescript
afterSuite: async (suite) => {
  // Per-suite cleanup
}
```

**Parameters:**
- `suite` - Suite object (same structure as `beforeSuite`)

**When it runs:**
- Once per test suite (describe block)
- After all tests in that suite complete

**Scope:** Per-suite

**Currently implemented in Knurl:**
```typescript
afterSuite: async (suite) => {
  console.log('[afterSuite] 📦 Suite complete: "${suite.title}"');
  console.log(`  fullTitle: "${suite.fullTitle}"`);
}
```

**Use cases:**
- Suite-level cleanup
- Logging suite completion
- Recording suite-level metrics

---

## Per-Test Hooks

### `beforeTest(test)`

**Signature:**
```typescript
beforeTest: async (test) => {
  // Called with access to browser object
}
```

**Parameters:**
- `test` - Test object with properties:
  - `title` - Test name (from `it("...")`)
  - `fullTitle` - Full path, e.g. "Suite › Test name"
  - `file` - Path to test file
  - `parent` - Parent suite name
  - `state` - Current test state

**When it runs:**
- Before every individual test (it block)
- After `beforeSuite()` runs
- Immediately before test execution

**Scope:** Per-test (runs for every test)

**Has access to:**
- `browser` object (for WebDriver commands)

**Currently implemented in Knurl:**
```typescript
beforeTest: async (test) => {
  const configDir = configDirsByCapability.get(process.pid);
  const preserveState = shouldPreserveState(test.title);

  console.log(`[beforeTest] 📋 Starting test: "${test.title}"`);
  console.log(`  ${formatTestMetadata(test)}`);
  console.log(`  state annotation: ${preserveState ? '[STATE:PRESERVE] 💾' : 'reset to defaults'}`);

  if (!preserveState && configDir) {
    console.log(`  resetting config directory...`);
    resetConfigDirectory(configDir);
    console.log(`  ✓ Config directory reset`);
  } else if (preserveState && configDir) {
    console.log(`  ✓ Preserving config directory state from previous test`);
  }
}
```

**Use cases:**
- Reset app state between tests
- Check test names and apply conditional logic
- Set up test-specific configuration
- **State management based on annotations** ⭐

---

### `afterTest(test, result)`

**Signature:**
```typescript
afterTest: async (test, result) => {
  // Called with access to browser object
}
```

**Parameters:**
- `test` - Test object (same as `beforeTest`)
- `result` - Test result object with properties:
  - `error` - Error object if test failed, null if passed
  - `state` - 'passed', 'failed', or 'pending'
  - `duration` - Test duration in milliseconds
  - `retries` - Number of retries (if any)

**When it runs:**
- After every individual test completes
- Regardless of pass/fail status
- Before `afterSuite()` runs

**Scope:** Per-test (runs for every test)

**Has access to:**
- `browser` object (for WebDriver commands)

**Currently implemented in Knurl:**
```typescript
afterTest: async (test, result) => {
  console.log(`[afterTest] ✓ Test complete: "${test.title}"`);
  console.log(`  ${formatTestMetadata(test)}`);
  console.log(`  ${formatTestResult(result)}`);

  if (envFlag(process.env.KNURL_SKIP_COVERAGE)) {
    console.log(`  coverage collection skipped`);
    return;
  }

  try {
    const coverage = await browser.execute(() => window.__coverage__);
    if (coverage) {
      const coverageFile = path.join(coverageDir, `coverage-${Date.now()}.json`);
      writeFileSync(coverageFile, JSON.stringify(coverage, null, 2));
      console.log(`  ✓ Coverage data collected and saved`);
    }
  } catch (error) {
    console.warn(`[coverage] Failed to collect coverage:`, error);
  }
}
```

**Use cases:**
- Collect coverage data
- Take screenshots on failure
- Log test results
- Clean up test-specific resources

---

## Additional Available Hooks (Not Currently Used)

The following hooks are available but not currently implemented in Knurl:

### `beforeCommand(commandName, args)`
Runs before every WebdriverIO command (e.g., before `click()`, `execute()`, etc.)

### `afterCommand(commandName, args, result, error)`
Runs after every WebdriverIO command

### Mocha-specific hooks
- `beforeHook()` - Before each `beforeEach()` hook
- `afterHook()` - After each `afterEach()` hook

### Framework-specific hooks
- `beforeFeature()`, `afterFeature()` - Cucumber
- `beforeScenario()`, `afterScenario()` - Cucumber
- `beforeStep()`, `afterStep()` - Cucumber

---

## Test Object Structure

The `test` parameter passed to `beforeTest()` and `afterTest()` has this structure:

```typescript
interface TestObject {
  title: string;           // "my test name"
  fullTitle: string;       // "Suite › Nested › my test name"
  file: string;            // "/path/to/test.e2e.ts"
  parent: string;          // "Nested"
  state: string;           // 'passed' | 'failed' | 'pending'
  duration?: number;       // milliseconds (in afterTest only)
  error?: Error;           // null or Error object
  cid?: string;            // capability ID
  // ... other Mocha-specific fields
}
```

---

## Result Object Structure

The `result` parameter passed to `afterTest()` has this structure:

```typescript
interface TestResult {
  error?: Error;           // Error object if test failed
  state: string;           // 'passed' | 'failed' | 'pending'
  duration: number;        // milliseconds
  retries?: {
    limit: number;
    attempts: number;
  };
  // ... other framework-specific fields
}
```

---

## Hook Access to Global State

| Hook | Has `browser` | Can access `configDirsByCapability` | Can access module-level vars |
|------|---------------|-------------------------------------|------------------------------|
| `onPrepare` | ❌ No | ❌ No | ✅ Yes |
| `beforeSession` | ❌ No | ❌ No | ✅ Yes |
| `before` | ✅ Yes | ✅ Yes | ✅ Yes |
| `beforeSuite` | ✅ Yes | ✅ Yes | ✅ Yes |
| `beforeTest` | ✅ Yes | ✅ Yes | ✅ Yes |
| `afterTest` | ✅ Yes | ✅ Yes | ✅ Yes |
| `afterSuite` | ✅ Yes | ✅ Yes | ✅ Yes |
| `after` | ✅ Yes | ✅ Yes | ✅ Yes |
| `afterSession` | ❌ No | ✅ Yes | ✅ Yes |
| `onComplete` | ❌ No | ✅ Yes | ✅ Yes |

---

## Quick Hook Cheat Sheet

```
Need to start services?             → onPrepare
Need to set up browser?             → before
Need to reset state per test?        → beforeTest ⭐
Need to collect coverage?            → afterTest ⭐
Need per-suite setup?               → beforeSuite
Need final cleanup?                 → onComplete
```

---

## References

- Implementation: `wdio.conf.ts` (lines 200-626)
- Annotations: `docs/E2E_ANNOTATIONS.md`
- Quick reference: `docs/E2E_QUICK_REFERENCE.md`

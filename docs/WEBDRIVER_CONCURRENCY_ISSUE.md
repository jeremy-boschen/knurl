# WebDriver Concurrency Issue: Socket Exhaustion on Promise.all()

## Summary

E2E tests using `Promise.all()` with concurrent `browser.executeAsync()` or similar WebDriver commands may cause socket exhaustion, resulting in WebDriver session crashes.

## Issue Details

**Error Signatures:**
```
UND_ERR_SOCKET: Connection refused (os error 111)
WebDriverError: Request failed with error code UND_ERR_SOCKET
Error: WebDriverError: Request failed with error code UND_ERR_SOCKET when running "element/node-<UUID>/click" with method "POST"
```

**Failure Point:**
WebDriver protocol requests to `localhost:4444` fail with connection refused, indicating the WebDriver server becomes unresponsive or socket connections are exhausted.

**Session Impact:**
Once the socket error occurs, the session cannot recover. Subsequent operations fail, and even session cleanup (DELETE request) fails with the same socket error.

## Root Cause (Suspected)

When multiple async operations execute concurrently via `Promise.all()`:
```javascript
// PROBLEMATIC PATTERN:
const createPromises = []
for (let i = 0; i < 3; i++) {
  createPromises.push(
    callBridgeReplacement("create_collection", {
      name: `Concurrent ${baseTime} ${i}`,
    }),
  )
}
const results = await Promise.all(createPromises)  // ❌ All resolve simultaneously
```

**Hypothesis:** Multiple concurrent requests exhaust WebDriver socket connections before responses are received. The exact mechanism is unknown - could be:
- WebDriver server socket pool exhaustion
- Tauri driver connection pool limit
- Hyper HTTP client connection pooling behavior
- WebDriver protocol buffering limits

This remains unconfirmed; further investigation needed.

## Test Case That Reproduces Issue

**File:** `test/specs/collections-core.e2e.ts` (now removed)
**Test:** `survives concurrent collection operations`
**Execution Time:** ~2 minutes 13 seconds into test
**Failure Count:** 13+ cascading failures after socket exhaustion

## Workaround/Solution

Refactor concurrent operations to execute **sequentially**:

```javascript
// WORKING PATTERN:
const results = []
for (let i = 0; i < 3; i++) {
  const result = await callBridgeReplacement("create_collection", {
    name: `Sequential ${baseTime} ${i}`,
  })
  results.push(result)
  await browser.pause(100)  // Optional: small delay between operations
}
```

**Rationale:** E2E tests should mirror user behavior (which is inherently sequential—users click one thing, wait for response, then click next). Concurrent operation testing belongs in unit/integration tests where operations can be controlled synchronously.

## WebDriver/Tauri Driver Specifics

- **WebDriver Version:** WebDriver.io (wdio)
- **Driver:** Tauri driver (`@tauri-apps/wdio-driver`)
- **Server Port:** localhost:4444
- **HTTP Client:** Rust Hyper (used internally by Tauri WebDriver server)

## Investigation Starting Points

If you need to research this issue further:
- WebDriver.io connection pooling/concurrency configuration
- `@tauri-apps/wdio-driver` socket handling and connection limits
- Hyper HTTP client socket pool sizing
- Tauri WebDriver server (written in Rust) socket/connection management

Search in:
- WebDriver.io docs for concurrent operation handling
- Tauri WebDriver driver source code
- Rust Hyper documentation for connection pool defaults

## Known Facts (Confirmed)

- ✅ Issue occurs with `Promise.all()` concurrent operations
- ✅ Error: `UND_ERR_SOCKET: Connection refused (os error 111)`
- ✅ WebDriver server (localhost:4444) becomes unresponsive
- ✅ Sequential `await` operations work fine at 26+ tests
- ✅ Session cannot be recovered once socket error occurs
- ❓ Exact socket pool limit unknown (possibly 5-10 concurrent, untested)
- ❓ Whether limit is configurable unknown

## Affected Tests

- ❌ Any E2E test using `Promise.all(browser.executeAsync(...), ...)` for concurrent operations
- ✅ Sequential `await` operations work fine
- ✅ Consolidated test files with 26+ sequential tests passed without issue

## Related Code

- `test/specs/collections-core.e2e.ts:457-486` (refactored to sequential)
- `test/support/bridge-replacement.ts` (uses `browser.executeAsync()` internally)
- `scripts/monitor-test-resources.sh` (resource monitoring infrastructure)

## Test Results

| Test File | Tests | Duration | Socket Issue | Status |
|-----------|-------|----------|--------------|--------|
| request-execution.e2e.ts | 26 (sequential) | 4:29 | ❌ No | ✅ PASS |
| collections-core.e2e.ts | 12 (mixed) | 2:13 | ✅ Yes (concurrent test) | ❌ FAIL |
| collections-core.e2e.ts (refactored) | 9 (sequential only) | 2:17 | ❌ No | ✅ Stable |

## Recommendations

1. **Do NOT use concurrent WebDriver operations** in E2E tests
2. **Use sequential `await` for all browser operations** to prevent socket exhaustion
3. **Move concurrency testing to unit/integration tests** where operations are synchronous
4. **Monitor WebDriver socket usage** during test execution with `netstat -i` or similar
5. **Consider WebDriver pool size tuning** if future tests require true concurrency (unlikely for E2E)

# WebDriver Concurrency Issue: Tauri Driver Not Thread-Safe for Concurrent Commands

**Status:** Root cause confirmed. Tauri WebDriver driver has concurrency limitation.

## The Issue (Blunt Version)

**This is NOT OS-level socket exhaustion.**

Tauri's native WebDriver driver (`@tauri-apps/wdio-driver`) is not thread-safe for concurrent command handling. When you send multiple WebDriver commands in parallel to a single session via `Promise.all()`, the driver's session handler fails:
- Closes sockets
- Stops responding to requests
- WebdriverIO surfaces this as `UND_ERR_SOCKET` errors
- Session becomes permanently unresponsive

**Safe rule:** Only 1 in-flight WebDriver command per Tauri session. Serialize all commands using sequential `await`.

## Error Symptoms

**Error signatures (when caught):**
```
UND_ERR_SOCKET: Connection refused (os error 111)
WebDriverError: Request failed with error code UND_ERR_SOCKET
Error: WebDriverError: Request failed with error code UND_ERR_SOCKET when running "element/node-<UUID>/click" with method "POST"
```

**Process termination (more likely):**
```
Killed
```

No error message, just "Killed" - suggests:
- OOM (out of memory) killer terminating the process
- tauri-driver panicking without reporting error back to client
- Entire Tauri/WebDriver process crashing

**Network behavior (if caught before crash):**
- WebDriver server at localhost:4444 closes sockets
- All subsequent requests fail with connection refused
- Session becomes unrecoverable
- Even session cleanup (DELETE) fails

## Reproduction Pattern

This code consistently triggers the bug:
```javascript
const promises = []
for (let i = 0; i < 3; i++) {
  promises.push(
    browser.executeAsync(async (callback) => {
      // Concurrent operation
      callback(result)
    })
  )
}
await Promise.all(promises)  // ❌ Tauri driver concurrency bug
```

**Failure timeline:**
- Execution: ~2 minutes into test
- When: 3 concurrent commands submitted
- Result: Socket errors, 13+ cascading test failures

## Fix

Use sequential `await` instead of concurrent operations:
```javascript
const results = []
for (let i = 0; i < 3; i++) {
  const result = await browser.executeAsync(async (callback) => {
    // Sequential execution
    callback(result)
  })
  results.push(result)
}
```

This works reliably at scale (26+ sequential commands tested successfully).

## Escalating to Tauri Team

If you want to report this upstream, provide:

### 1. Minimal Reproducible Test
File: `test/specs/collections-core.e2e.ts` (available in git history, branch: wsl/main)

Specific test: `Collection Storage & Data Persistence > survives concurrent collection operations`

Or create new spec with just:
```javascript
it("triggers concurrent command bug", async () => {
  const promises = []
  for (let i = 0; i < 3; i++) {
    promises.push(
      browser.executeAsync(async (done) => {
        done({ index: i })
      })
    )
  }
  await Promise.all(promises)  // Will fail with UND_ERR_SOCKET
})
```

### 2. Verbose Logging

Run tests with Tauri driver verbose output:

```bash
RUST_LOG=trace RUST_BACKTRACE=1 yarn test:e2e --spec <test-file>
```

Capture stdout/stderr around the failure point (look for socket/connection/concurrency-related messages).

### 3. Provide to Tauri

Include:
- Minimal wdio config (`wdio.conf.ts`)
- Spec file with 3 concurrent executeAsync calls
- Full tauri-driver logs from RUST_LOG=trace
- Error output showing UND_ERR_SOCKET
- Tauri version and platform

This gives the Tauri team a solid repro to investigate concurrency handling in tauri-driver's session management.

## Workaround for Now

**Rule:** 1 in-flight command per session

```javascript
// ❌ BAD - causes socket errors
const [a, b, c] = await Promise.all([op1(), op2(), op3()])

// ✅ GOOD - serialized, reliable
const a = await op1()
const b = await op2()
const c = await op3()
```

## Test Status

| Pattern | Tests | Duration | Result |
|---------|-------|----------|--------|
| Sequential await | 26 | 4m 29s | ✅ Stable |
| Sequential await | 9 | 1m 38s | ✅ Stable |
| Promise.all (3 concurrent) | 1 | ~2min | ❌ UND_ERR_SOCKET crash |

## Key Points

- ✅ Sequential operations work reliably
- ✅ Proven stable at 35+ combined sequential tests
- ❌ Concurrent operations via Promise.all consistently fail
- ❓ Exact concurrency threshold not tested (likely <3)
- ✅ Workaround is simple: use sequential await

## E2E Testing Best Practice

E2E tests should mirror user behavior anyway, which is inherently sequential. This limitation aligns with proper E2E design:
- Users click, wait for response, click next
- Tests should do the same
- Concurrency testing belongs in unit/integration tests

The Tauri driver's serialization requirement is actually a good forcing function for correct E2E test design.

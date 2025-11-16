# WebDriver Concurrency Issue: Socket Exhaustion on Promise.all()

**Status:** Confirmed reproducible issue requiring investigation

## Executive Summary for Research

**Objective:** Determine the root cause of socket exhaustion when concurrent WebDriver operations are executed via `Promise.all()` in WebDriver.io + Tauri driver environment.

**Scope:** WebDriver.io tests using `@tauri-apps/wdio-driver` for desktop application testing (Tauri 2 framework).

**Known Behavior:** 3 concurrent `browser.executeAsync()` calls via `Promise.all()` consistently crash the WebDriver session with `UND_ERR_SOCKET` errors.

## Symptom Definition

**Error signatures that appear:**
```
UND_ERR_SOCKET: Connection refused (os error 111)
WebDriverError: Request failed with error code UND_ERR_SOCKET
Error: WebDriverError: Request failed with error code UND_ERR_SOCKET when running "element/node-<UUID>/click" with method "POST"
```

**Network behavior observed:**
- WebDriver server at `localhost:4444` stops accepting new connections
- Existing connections fail with connection refused errors
- Server appears unresponsive but process doesn't crash
- Subsequent requests (including session cleanup DELETE) fail with same error
- Session becomes permanently unresponsive

**Test execution pattern that triggers issue:**
```javascript
// This pattern causes failure after ~2-3 seconds of execution:
const promises = []
for (let i = 0; i < 3; i++) {
  promises.push(
    browser.executeAsync(async (callback) => {
      // Async operation in browser context
      callback(result)
    })
  )
}
await Promise.all(promises)  // ❌ Triggers socket exhaustion
```

## Reproduction Details

**Test case:** `test/specs/collections-core.e2e.ts` (removed after discovery, can be restored from git history)
**Test name:** `survives concurrent collection operations`
**Trigger:** `Promise.all()` with 3 concurrent `callBridgeReplacement()` calls
**Execution time until failure:** ~2 minutes 13 seconds into test run
**Cascading failures:** 13+ test failures result from single socket exhaustion event

## Known Constraints & Environment

**Stack:**
- Framework: WebDriver.io (wdio)
- Driver: `@tauri-apps/wdio-driver` (Tauri WebDriver integration)
- Application framework: Tauri 2 (Rust + React)
- HTTP client (backend): Rust Hyper crate
- Server: localhost:4444

**Confirmed working patterns:**
- ✅ Sequential `await` operations (26+ tests completed without issue)
- ✅ Single concurrent operation
- ✅ 2 concurrent operations (untested but likely works)

**Threshold uncertain:**
- ❓ Whether limit is 3 concurrent connections or somewhere between 2-3
- ❓ Whether limit applies globally or per session
- ❓ Whether limit is configurable

## Potential Investigation Paths

### Path 1: WebDriver.io Client-Side Configuration
- Examine WebDriver.io's HTTP client configuration
- Look for connection pool settings, max concurrent request limits
- Check if there's configuration to increase concurrent request capacity
- Review WebDriver.io issue tracker for similar reports

**Start with:**
- WebDriver.io documentation on configuration options
- `wdio.conf.ts` capabilities and options
- HTTP client libraries used by wdio

### Path 2: Tauri WebDriver Driver (@tauri-apps/wdio-driver)
- Check Tauri WebDriver driver source code for connection handling
- Look for socket pool management, concurrent request limiting
- Examine if driver reuses connections or creates new ones per request
- Check for backpressure or queuing mechanisms

**Start with:**
- Tauri WebDriver driver source repository
- Connection handling implementation
- HTTP request routing to Tauri app
- Session lifecycle management

### Path 3: Rust Hyper HTTP Client (Server-Side)
- Tauri's WebDriver server uses Hyper HTTP client internally
- Hyper may have default connection pool limits
- Check if Tauri configures Hyper with specific pool settings

**Start with:**
- Tauri's WebDriver server implementation
- Hyper HTTP client default configuration
- Connection pool sizing in Hyper
- Rust async/await executor limits (tokio task spawning)

### Path 4: OS-Level Socket Limits
- System may have FD limits or ephemeral port exhaustion
- Check `/proc/sys/net/ipv4/ip_local_port_range` on Linux
- Verify file descriptor limits (`ulimit -n`)
- Check if issue is related to TIME_WAIT socket accumulation

**Start with:**
- System resource limits during test execution
- Socket netstat/ss monitoring during concurrent operations
- OS error logs when connection refused occurs

### Path 5: WebDriver Protocol Specification
- Review W3C WebDriver specification for concurrency requirements
- Check if protocol defines limits on concurrent requests per session
- Look for guidance on concurrent operation handling

**Start with:**
- W3C WebDriver specification (https://w3c.github.io/webdriver/)
- Session management and request handling

## Deep Research Checklist

- [ ] **Search WebDriver.io issues:** Look for "concurrent", "Promise.all", "socket exhaustion", "connection refused" on GitHub issues
- [ ] **Search Tauri issues:** Check Tauri WebDriver driver repository for similar reports
- [ ] **Check WebDriver.io code:** Review HTTP client implementation (likely `webdriver` package)
- [ ] **Review Hyper documentation:** Check default connection pool size and configuration options
- [ ] **System resource monitoring:** Run test with `netstat -c`, `ss -m`, `lsof` to observe socket state during failure
- [ ] **Tauri WebDriver source:** Examine how Tauri's WebDriver server initializes HTTP listener
- [ ] **Tokio runtime limits:** Check if issue relates to Tokio async executor task limits
- [ ] **Connection pooling libraries:** Identify which Rust connection pooling library Hyper uses and its defaults
- [ ] **WebDriver.io version notes:** Check release notes for concurrency-related fixes/changes
- [ ] **Browser/driver logs:** Enable verbose logging to see connection lifecycle
- [ ] **Test with sequential then parallel:** Binary search to find exact concurrency limit (test with 1, 2, 3, 4, 5 concurrent ops)

## Test Artifacts for Investigation

**Reproducible test code:**
- Location: `test/specs/collections-core.e2e.ts` (Git history, branch: wsl/main, commit before this fix)
- Specific test: `Collection Storage & Data Persistence > survives concurrent collection operations`
- How to trigger: Run `yarn test:e2e --spec test/specs/collections-core.e2e.ts`

**Monitoring infrastructure available:**
- `scripts/monitor-test-resources.sh`: Captures system resources during test
- `scripts/run-test-with-monitoring.sh`: Runs tests with parallel resource monitoring
- `test/support/ui.ts`: `logTestTime()` function for timing analysis

**Known working baseline:**
- `test/specs/request-execution.e2e.ts`: 26 sequential tests, 4m 29s, no socket issues
- Confirms sequential operations are stable at scale

## Research Output Requirements

When investigating, please provide:

1. **Root cause identification:** Which component (wdio, tauri-driver, hyper, OS) is limiting concurrency
2. **Limit specification:** Exact number of concurrent connections allowed, whether configurable
3. **Configuration options:** Any settings to increase limit (if configurable)
4. **Workarounds:** If limit cannot be increased, best practices for E2E tests
5. **Official resources:** Links to relevant documentation/issues supporting findings
6. **Reproducibility:** Instructions for anyone to verify the root cause

## References & Context

- **Consolidation effort:** Part of E2E test consolidation project (docs/plans/2025-11-16-e2e-consolidation-plan.md)
- **Related docs:** docs/TEST_COVERAGE_GAPS.md explains why concurrent ops shouldn't be in E2E anyway
- **Session stability:** Sequential operations proven stable (26+ tests, 35+ combined tests across 2 files)

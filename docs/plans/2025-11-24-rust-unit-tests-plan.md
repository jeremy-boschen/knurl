# Rust Backend Unit Tests Plan
**Date:** 2025-11-24
**Scope:** Comprehensive unit test coverage for `src-tauri/src/http_client/` and `src-tauri/src/app_data/`

---

## Executive Summary

**Current State:** 24 unit tests across 6 files, ~37% of critical modules untested
**Target:** 150-170 new test functions across all domains
**Critical Gaps:** OAuth2 (1,984 LOC), HTTP engine (1,223 LOC), TLS/connectors (1,064 LOC)

---

## Task Breakdown

### Phase 1: http_client/auth.rs (25-30 tests)
**File:** `src-tauri/src/http_client/auth.rs` (1,984 lines) - **Currently: 0 tests**

- [ ] Basic authentication (base64 encoding, header generation)
- [ ] Bearer token injection
- [ ] API Key authentication (header/query placement)
- [ ] OAuth2 authorization code flow
- [ ] OAuth2 PKCE verification (code challenge/verifier)
- [ ] OAuth2 refresh token handling
- [ ] OAuth2 device code flow
- [ ] OIDC discovery endpoint parsing
- [ ] OIDC token exchange
- [ ] Invalid credentials handling
- [ ] Edge cases (empty tokens, special characters, malformed headers)

**Inline location:** After line 1984

---

### Phase 2: http_client/hyper_engine.rs (20-25 tests)
**File:** `src-tauri/src/http_client/hyper_engine.rs` (1,223 lines) - **Currently: 0 tests**

- [ ] GET request construction and execution
- [ ] POST request with body serialization
- [ ] Request headers normalization
- [ ] Multipart form data assembly
- [ ] Request body streaming
- [ ] Response body reading
- [ ] Response header parsing
- [ ] Status code handling (2xx, 3xx, 4xx, 5xx)
- [ ] Redirect following (max hops)
- [ ] Cookie injection from jar
- [ ] Cookie extraction from response
- [ ] Request logging (verbose flag)
- [ ] Response logging
- [ ] Timeout handling
- [ ] Content-Length validation

**Inline location:** After line 1223

---

### Phase 3: http_client/hyper_engine/connector.rs (15-20 tests)
**File:** `src-tauri/src/http_client/hyper_engine/connector.rs` (1,064 lines) - **Currently: 0 tests**

- [ ] DNS override (custom IP for domain)
- [ ] System root certificate loading
- [ ] Custom CA bundle loading
- [ ] Certificate validation (valid/invalid certs)
- [ ] Self-signed certificate handling
- [ ] TLS version negotiation
- [ ] Invalid certificate rejection
- [ ] File I/O error handling
- [ ] DNS resolution with fallback

**Inline location:** After line 1064

---

### Phase 4: Expand http_client/cookies.rs (8-10 tests)
**File:** `src-tauri/src/http_client/cookies.rs` (183 lines) - **Currently: 5 tests**

- [ ] Domain matching (exact, suffix, wildcard)
- [ ] Path matching (exact, prefix)
- [ ] Secure flag enforcement
- [ ] HttpOnly cookies in requests
- [ ] SameSite attribute handling
- [ ] Cookie expiration
- [ ] RFC 6265 compliance edge cases

**Inline location:** After existing tests (expand at end of file)

---

### Phase 5: Expand app_data/loader.rs (8-10 tests)
**File:** `src-tauri/src/app_data/loader.rs` (170 lines) - **Currently: 2 tests**

- [ ] File creation on missing file
- [ ] Directory creation on missing app data dir
- [ ] Concurrent read access (multiple threads)
- [ ] Concurrent write access (serialization)
- [ ] Corrupted file recovery
- [ ] Permission errors handling
- [ ] Symlink handling

**Inline location:** After existing tests (expand at end of file)

---

### Phase 6: http_client/request.rs & response.rs (5-8 tests each)
**Files:** `request.rs` (81 lines), `response.rs` (100+ lines) - **Currently: 0 tests**

- [ ] Request field validation (URL format, headers)
- [ ] Response struct construction
- [ ] Header case-insensitivity
- [ ] Body encoding/decoding

**Inline location:** After each file's content

---

### Phase 7: Expand app_data/crypto.rs (5-8 additional tests)
**File:** `src-tauri/src/app_data/crypto.rs` (350+ lines) - **Currently: 8 tests**

- [ ] Large payload encryption (>1MB)
- [ ] Concurrent encryption/decryption
- [ ] Nonce uniqueness verification
- [ ] Authentication tag validation
- [ ] Keyring access failures

**Inline location:** After existing tests

---

### Phase 8: Expand lib.rs Tauri commands (5-8 tests)
**File:** `src-tauri/src/lib.rs` (703 lines) - **Currently: 2 tests**

- [ ] HTTP command handler validation
- [ ] Encryption command error handling
- [ ] File I/O command error cases
- [ ] Auth command integration

**Inline location:** After existing tests

---

## Test Structure Template

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_success_case() {
        // Arrange
        // Act
        // Assert
    }

    #[test]
    fn test_feature_error_case() {
        // Arrange
        // Act
        // Assert
    }
}
```

## Running Tests

```bash
# All Rust tests
yarn test:unit

# Specific module
cargo test -p knurl_backend http_client::auth

# With output
cargo test -p knurl_backend -- --nocapture
```

## Success Criteria

- [ ] All test functions compile without warnings
- [ ] 100% of critical paths covered (auth, HTTP, TLS, encryption)
- [ ] All edge cases tested (malformed input, concurrent access, errors)
- [ ] `cargo test` passes with 0 failures
- [ ] `cargo clippy -- -D warnings` passes for test code
- [ ] New tests follow existing patterns in codebase

---

## Status

- [ ] Phase 1: auth.rs tests (IN PROGRESS)
- [ ] Phase 2: hyper_engine.rs tests
- [ ] Phase 3: connector.rs tests
- [ ] Phase 4: cookies.rs expansion
- [ ] Phase 5: loader.rs expansion
- [ ] Phase 6: request.rs & response.rs tests
- [ ] Phase 7: crypto.rs expansion
- [ ] Phase 8: lib.rs expansion
- [ ] Final validation (all tests pass, coverage report)

# Plan — Fix Rust connector unit test failures (2025-12-07)

- [x] Investigate panic in `build_connector_respects_ip_override_and_http2` (missing Rustls `CryptoProvider`).
- [x] Investigate panic in `build_connector_rejects_invalid_ip_override` (missing Rustls `CryptoProvider`).
- [x] Implement minimal fix to satisfy both tests without expanding scope.
- [x] Re-run Rust unit tests for `src-tauri` crate to confirm both pass.

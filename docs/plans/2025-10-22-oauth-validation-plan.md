## OAuth Validation Plan (2025-10-22)

- [x] Audit current OAuth flows (frontend + tauri) and document required real-world scenarios.
- Current support: client credentials & refresh via Rust backend; UI exposes device_code & password but backend rejects; auth code/PKCE missing entirely. Tokens cached via credentials store, fetch uses `getAuthenticationResult`.
- [x] Enhance `scripts/oauth-mock-server.mjs` to model production-like providers (auth code + PKCE, refresh, client credentials, device code).
- [x] Wire mock server into e2e harness (spawn in `wdio` bootstrap, pass env/config to app).
- [x] Ensure frontend/Tauri layers read issuer metadata dynamically via env overrides.
- [x] Implement automated validation (WebdriverIO specs + targeted Vitest) covering happy/error paths.
- [ ] Document workflows and future steps for adding new OAuth fixtures or external conformance runs.

# MVP Release Plan (2025-10-12)

## Scope & Product
- [ ] Capture MVP exit criteria in `README.md` and a short `docs/MVP.md` (request workspace, collections, environments, auth, GraphQL, offline storage) so scope is explicit.
- [ ] Map critical user journeys (scratch request → saved collection, auth token reuse, import/export) into acceptance scenarios we can automate.

## Feature Completion
- [ ] Implement GraphQL introspection + query runner in `src/components/request/editor` with matching command in `src-tauri/src/http_client` and schema caching in state.
- [ ] Finish secrets ergonomics: add copy/mask UX + toasts in `src/components/utility-sheets/environment-manager` and `src/state/collections.ts`, ensure secure fields stay encrypted at rest.
- [ ] Close OAuth2 gaps by wiring token discovery/device-code flows through `src/components/auth/oauth2-editor.tsx` and `src/state/credentials.ts`, covering caching + refresh edge cases.
- [x] Ship “Copy as …” dropdown near Save/Send to export active request as `curl`, `wget`, `fetch()`, etc., leveraging existing request serialization utilities.
- [ ] Ensure request options (TLS, DNS, user agent, redirects) flow through shared request prep and exporter paths.
- [ ] Share collection/request/folder context menus between tree and breadcrumbs (`src/components/ui/knurl/*`).

## Hardening & QA
- [ ] Extend Vitest coverage for request tabs, environments, and credentials (see `src/state/*.test.ts`) to guard dirty-state logic and encrypted writes.
- [ ] Stabilise WDIO e2e smoke (`tests/e2e`) with startup wait utilities, add scenarios for binary upload, auth discovery, and environment substitution.
- [ ] Add Rust integration tests under `src-tauri/tests/` validating AES-GCM persistence (`app_data`) and HTTP error surfaces (timeouts, TLS failures).

## Release Operations
- [ ] Create release checklist doc (build, `yarn check`, signing, `scripts/release-local.mjs`) and template notes for first GA tag.
- [ ] Automate portal bundles via `yarn portal:package`, stash artifacts under CI, and verify signatures across Windows/macOS/Linux.
- [ ] Prepare onboarding assets (final screenshots in `docs/assets`, quickstart video placeholder, in-app changelog) ready for v1 announcement.

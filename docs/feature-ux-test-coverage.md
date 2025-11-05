# Feature UX Test Coverage

This matrix tracks how Knurl's shipped capabilities map to automated coverage. For each capability we highlight the strongest existing tests (unit, component, or UX), identify gaps in end-to-end verification, and outline the UX tests we still need. Update this alongside `docs/feature-inventory.md` whenever features or test coverage changes.

## Workspace & Navigation

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Restore open requests, active panels, and scroll position on restart | `test/specs/collections-flow.e2e.ts` (tab open/close lifecycle), `src/state/request-tabs.test.ts` (store restoration logic), `test/specs/workspace-restore.e2e.ts` (UX reload) | Covered – `workspace-restore.e2e.ts` reloads the shell and verifies tabs, active panels, and index entries survive | — |
| Always-present scratch collection for ad-hoc work | `test/specs/collections-flow.e2e.ts` (new scratch requests + save-to-collection flow), `test/specs/scratch-collection.e2e.ts` (restart + clear UX), `src/state/collections.test.ts` (scratch persistence rules) | Covered – `scratch-collection.e2e.ts` verifies restart survival, menu restrictions, and clear-all behaviour | — |
| Collections sidebar ordering, counts, and metadata updates | `test/specs/collections-flow.e2e.ts` (new collection visibility), `src/components/layout/collection-tree.test.tsx` (render smoke) | Partial – no UX assertions for ordering, counts, or timestamp badges | Introduce a sidebar management UX test that creates multiple collections, reorders them, confirms count badges update after request changes, and validates persistence after reload |
| Launch hydration with required collections and post-hydrate hooks | `src/state/application.test.ts` (store bootstrap), `test/specs/launch-hydration.e2e.ts` (UX) | Covered – launch spec seeds persisted data, verifies collections/tabs hydrate, and ensures malformed storage recovers cleanly | — |

## Collections & Library Management

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Create, rename, duplicate, reorder, and delete collections | `test/specs/collections-flow.e2e.ts` (create, scratch-to-collection save), `test/specs/collections-management.e2e.ts` (rename/delete UX), `src/components/ui/knurl/collection-menu.test.tsx` (menu actions) | Partial – duplication and reorder flows still lack UX automation | Extend `collections-management.e2e.ts` with duplication + reorder scenarios once UI exposes stable hooks |
| Hierarchical folders with drag-and-drop organisation | `src/state/collections.test.ts` (folder tree operations) | Missing – no UI verification of folder creation, nesting, or drag-drop | Create `collection-folders.e2e.ts` that builds nested folders, drags requests between levels, and confirms persistence after restart |
| Import/export native bundles with secret scrubbing | `src/components/utility-sheets/export-collection/index.test.tsx`, `src/components/utility-sheets/import-collection/*` (sheet logic), `src/lib/request/exporters.test.ts` (sanitisation) | Partial – component/unit coverage only | Design an e2e flow that exports a collection, inspects generated file for redacted secrets, then imports and validates the restored structure in-app |
| Merge workflow with conflict summaries | `src/state/collections.test.ts` (merge planner) | Missing – no UX validation of merge dialogs or summary display | Add a merge UX scenario that imports a bundle with conflicts, steps through the merge UI, and verifies summary output plus resulting collection changes |
| Persisted “opened” arrays repopulate request tabs | `src/state/request-tabs.test.ts` (API), `test/specs/workspace-restore.e2e.ts` (persistence UX) | Covered – workspace restore spec confirms `opened` entries reopen tabs and prune stale ids | — |

## Request Authoring Experience

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Full HTTP method support with URL and parameter editing | `src/components/request/editor/request-editor.test.tsx`, `src/components/request/editor/request-parameters-panel.test.tsx`, `test/specs/auto-docs.e2e.ts` (walkthrough) | Partial – no UX assertions for every method or parameter type | Create `request-methods.e2e.ts` to iterate through verbs, edit path/query params, send requests, and confirm method-specific behaviour in the response |
| Body composer for raw, JSON, form, and multipart payloads | `src/components/request/editor/request-body-panel.test.tsx`, `src/request/pipeline.test.ts` (payload prep) | Missing – UI does not exercise each body mode end-to-end | Add `request-bodies.e2e.ts` that configures each body type, sends to an echo endpoint, and validates payload structure |
| Header editor with toggles and ordering | `src/components/request/editor/request-headers-panel.test.tsx` | Missing – no UX check for enabling/disabling headers | Implement `request-headers.e2e.ts` verifying add/remove/toggle flows and ensuring disabled headers are omitted from outbound requests |
| Clone, rename, and multi-tab management of requests | `src/state/request-tabs.test.ts` (logic), `test/specs/collections-flow.e2e.ts` (basic tab lifecycle) | Partial – lacks UX coverage for cloning/renaming and multi-tab sync | Expand UX coverage with a scenario that clones requests, renames them via UI, opens same request in multiple tabs, and ensures edits sync correctly |
| Variable interpolation across the request | `src/lib/environments.test.ts`, `src/request/pipeline.test.ts` | Missing – no UX validation of environment substitution in actual sends | Build `environment-interpolation.e2e.ts` hitting an echo API to confirm rendered URL, headers, and body reflect environment values |

## Authentication & Authorization

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Switchable strategies: None, Basic, Bearer, API Key, OAuth2 | `src/components/request/editor/request-auth-panel.test.tsx` | Partial – only component-level coverage | Create `request-auth-strategies.e2e.ts` that configures each strategy through the UI, sends against the mock server, and inspects outbound auth material |
| OAuth discovery, credential storage, and refresh support | `src/components/auth/oauth2-editor.test.tsx`, `test/specs/oauth-flows.e2e.ts` (bridge), `test/specs/oauth-ui-flows.e2e.ts` (UX) | Covered – OAuth UI spec discovers endpoints, fetches tokens, and exercises cached credential reuse per request | — |
| Grant coverage: client credentials, auth code + PKCE, device code | `test/specs/oauth-flows.e2e.ts` (bridge), `test/specs/oauth-ui-flows.e2e.ts` (UX) | Covered – `oauth-ui-flows.e2e.ts` drives each grant through the UI and validates returned tokens | — |
| Secret scoping per collection | `src/state/collections.test.ts` (secret handling), `src/components/utility-sheets/collection-settings/index.test.tsx` | Missing – no UX check when switching collections or exporting | Add coverage that switches active collections, ensures tokens don’t bleed between them, and validates exports omit secrets |

## Environment & Secret Management

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Named environments with enable/disable toggles | `src/components/layout/environment-selector.test.tsx`, `src/state/collections.test.ts` | Partial – no UX send asserting correct environment is active | Include environment switching assertions in `environment-interpolation.e2e.ts`, verifying toggles affect outbound requests |
| Secure values retained only at runtime | `src/state/collections.test.ts` (persistence rules) | Missing – no UX proof that secrets disappear from exports/UI after restart | Plan an e2e scenario that inputs secure values, restarts, ensures UI masks them, and confirms exports omit them |
| Per-request environment selection with fallbacks | `src/state/application.test.ts` (store hooks) | Missing – no UX coverage | Add a UX test that assigns different environments per tab, switches active tab, and confirms fallbacks behave as expected |

## Execution & Networking

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Staged execution pipeline producing telemetry | `src/request/pipeline.test.ts`, `src/request/http/engine.test.ts`, `src/request/ws/engine.test.ts` | Partial – backend only | Add UX smoke sending requests and assert timeline/log UI reflects pipeline stages |
| Cancel long-running requests from the UI | `src/state/request-tabs.test.ts` (cancellation logic) | Missing – no UI automation hitting cancel | Create `request-cancel.e2e.ts` using mock server delays to exercise cancel button and confirm backend aborts |
| Unified error messaging for failures | `src/components/error/error-boundary.test.tsx`, `src/request/pipeline.test.ts` | Partial – lacks UX coverage for transport and validation failures | Add UX scenarios that trigger network errors, TLS failures, and validation issues, verifying user-facing error toasts/dialogs |
| Native backend via libcurl with TLS/proxy support | Manual QA only | Missing – not automated | Consider targeted integration tests or nightly UX runs that hit TLS-protected and proxy-required endpoints via the mock server |

## Response Analysis

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Response viewer modes (pretty, raw, headers) | `test/specs/auto-docs.e2e.ts` (documentation capture), `src/components/request/editor/request-editor.test.tsx` (tabs) | Partial – no assertions that content renders correctly | Create `response-viewer.e2e.ts` verifying each tab renders expected data from an echo service and supports copy actions |
| Timeline/log diagnostics | `test/specs/auto-docs.e2e.ts` (captures) | Missing – no UX assertion of log contents | Extend response UX tests to assert log entries populate with correct phases and severity filters |
| Safe handling of binary/large payloads | Manual coverage | Missing – unchecked | Add UX coverage that downloads a binary via mock server, ensures download prompt appears, and verifies UI does not attempt inline rendering |
| Persistent metadata (status, latency, size, redirects) | `src/components/request/editor/request-editor.test.tsx` (derived data) | Missing – no UX coverage | Add assertions in `response-viewer.e2e.ts` to confirm metadata persists when switching tabs or navigating away/back |

## Storage, Privacy & Resilience

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| All data remains local (no telemetry) | Architectural guarantee | Missing – needs regression guard | Add automated checks that network requests remain within mock servers during test runs (e.g., block unexpected domains and fail if accessed) |
| Per-collection encryption at rest | `src/state/collections.test.ts` (sanitisation), Rust backend unit tests | Missing – no black-box verification | Consider integration test harness that writes sample data then inspects encrypted files for expected headers (non-UX) and a UX smoke ensuring data inaccessible without app |
| Graceful handling of missing/corrupt files | `src/state/collections.test.ts` | Missing – no UX scenario | Build resilience UX test that simulates corrupted storage, launches app, and confirms recovery messaging plus recreated defaults |
| Secret scrubbing from exports/logs | `src/lib/request/exporters.test.ts`, `src/components/utility-sheets/export-collection/index.test.tsx` | Partial – no UX confirmation | Extend export/import UX flow to open the generated artifact and assert secrets are absent |

## Desktop Integration & Extensibility

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Tauri desktop bundle across Windows, macOS, and Linux | `test/specs/app.e2e.ts` (launch smoke), `src-tauri/src/lib.rs` (launch guards) | Partial – only launch smoke runs on CI; does not exercise desktop integrations on every OS | Expand smoke suite to cover menu accelerators, window behaviours, and clipboard/file command via UX automation across OS targets |
| Backend commands for networking, storage, export, clipboard, and auth | `src-tauri/src/http_client/manager.rs` (cancel tests), `src-tauri/src/app_data/loader.rs` (persistence tests), `src-tauri/src/lib.rs` (command smoke) | Missing – no UX coverage proving commands stay responsive end-to-end | Create `tauri-commands.e2e.ts` to invoke file export, clipboard helpers, request execution, and auth flows via UI, asserting command responses |
| E2E bridge for automation (`VITE_MODE=e2e`) | `test/specs/oauth-flows.e2e.ts` | Met – bridge invoked in automation | Maintain coverage; add regression test ensuring bridge disabled in production mode |
| Platform prerequisites validation | Manual release process | Missing – no automated check | Consider CI guard or UX setup test verifying WebView2 presence and user-friendly error when missing |

## Quality, Testing & Tooling

These items are primarily enforced via tooling and CI, but we should still maintain awareness of UX gaps.

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| Vitest + React Testing Library suite with mocked bridges | `yarn test`, `src/test/setup.ts`, `vitest.config.ts` | Not applicable – enforced via unit/component harness | — |
| WebdriverIO e2e harness with OAuth mock server | `test/specs/*.e2e.ts`, `test/support/ui.ts` | Covered – suite exercises critical UX flows today | Continue extending specs when new surface areas land |
| Rust backend validation (`cargo test`, Clippy, fmt) | `src-tauri/Cargo.toml`, `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt --check` | Not applicable – tooling gate rather than UX flow | — |
| Biome lint + Lefthook pre-commit enforcement | `package.json` scripts, `lefthook.yml` | Not applicable – automation ensures consistency | — |

## Roadmap & Known Gaps

| Capability | Existing Coverage | UX Coverage Status | Proposed UX Tests |
| --- | --- | --- | --- |
| GraphQL schema introspection workflow | None – roadmap item | Missing | Plan dedicated UX suite once feature ships |
| UI-driven OAuth automation across flows | Pending work | Missing | Covered by `oauth-ui-flows.e2e.ts` proposal above |

---

Next steps:

1. Prioritise UX automation for high-risk areas (workspace persistence, OAuth UI flows, request authoring).
2. Track progress by ticking entries above and linking new specs as they land.
3. Re-run this inventory whenever features move from roadmap to delivered or when new UX surfaces appear.

TODO
- [x] Run `yarn test:unit` (2025-12-07) — suite passed; coverage merge warned about missing coverage-summary.json.
- [x] Identify next best areas for adding unit test coverage:
  - UI: `src-ui/src/components/request/editor/request-parameters-panel.tsx`, `src-ui/src/worker/prettier.worker.ts`, `src-ui/src/state/application.ts`, `src-ui/src/state/collections/request-ops.ts`, `src-ui/src/lib/request/prepared-http.ts`, `src-ui/src/components/auth/auth-forms.tsx`, `src-ui/src/components/layout/mode-toggle.tsx`.
  - Rust: `src-tauri/src/http_client/engine.rs`, `src-tauri/src/http_client/hyper_engine/connector.rs`, `src-tauri/src/http_client/auth.rs`, `src-tauri/src/lib.rs`.

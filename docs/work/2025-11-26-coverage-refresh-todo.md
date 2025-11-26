TODO
- [x] Remove local `coverage` directory.
- [x] Run `yarn test:unit` to gather current coverage across frontend and backend.
- [x] Identify next best areas to add tests to increase coverage.

Next test targets (lowest coverage):
- Frontend 0%: `src/components/layout/app-header.tsx`, request editor `empty-state.tsx`, `section-header.tsx`, `ui/knurl/tooltip.tsx`, import validation `validation-error-display.tsx`, `pages/not-found.tsx`, `worker/prettier.worker.ts`.
- Frontend <70% (post-run, major gaps remain): request editor panels (`request-headers/body/parameters/options.tsx` ~67–71%), `response/response-viewer.tsx` (~59%), `bindings/knurl.ts` (~61%), `request/http/engine.ts` (~67%), `request/editor/request-body-panel.tsx` (~68%).
- Rust low coverage: `src-tauri/src/http_client/engine.rs` (0%), `src-tauri/src/lib.rs` (~5%), `http_client/hyper_engine/connector.rs` (~27%), `http_client/auth.rs` (~37%), `http_client/hyper_engine.rs` (~41%).
- New tests added: `empty-state`, `section-header`, `tooltip`, `validation-error-display`, `not-found`, and expanded `lib/environments` coverage; stubbed `components/ui/card` to satisfy not-found page.
- Current totals: Frontend ~82.15% lines (lcov.info), Rust ~44.33% lines (rust-lcov.info).

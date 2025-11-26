## Coverage Refresh Plan (2025-11-26)

- [x] Remove local `coverage` directory.
- [x] Run `yarn test:unit` to collect current coverage (frontend + backend).
- [x] Review coverage report and note next best areas for additional tests.

Status: Tests now passing; coverage reports generated in `coverage/`.

Notes:
- Added unit tests for empty-state, section-header, tooltip, validation-error-display, not-found; expanded `lib/environments` coverage.
- Added request editor coverage (headers/options/body helpers) and response viewer behaviors (preview, status coloring, language detection).
- Frontend coverage: ~82.15% lines (lcov.info). Rust coverage: ~44.33% lines (rust-lcov.info).
- Remaining biggest gaps: request editor panels (~67–71% lines), response-viewer (~59% before latest additions), request/http/engine.ts (~67%); Rust http_client engine/lib/hyper_engine/auth.

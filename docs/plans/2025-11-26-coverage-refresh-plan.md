## Coverage Refresh Plan (2025-11-26)

- [x] Remove local `coverage` directory.
- [x] Run `yarn test:unit` to collect current coverage (frontend + backend).
- [x] Review coverage report and note next best areas for additional tests.

Status: Tests now passing; coverage reports generated in `coverage/`.

Notes:
- Added unit tests for empty-state, section-header, tooltip, validation-error-display, not-found; expanded `lib/environments` coverage.
- Added request editor coverage (headers/options/body helpers) and response viewer behaviors (preview, status coloring, language detection).
- Added request body panel edge-case coverage (format toggle, binary/form drops, file content types).
- Added response viewer download naming + large preview disablement coverage.
- Added backend hyper engine tests for log redaction/truncation and file body content-type inference (requires PartialEq on LogLevel).
- Added auth.rs tests for trim/require_value, stubbed OAuth token generation/logging, and scope handling.
- Added response viewer file-path preview actions and binary body rendering; request headers unsaved/secure masking coverage.
- Added CSV preview edge cases (BOM/comments, empty CSV) and YAML save defaults; marked request options unsaved states.
- Frontend coverage (2025-11-26 run): ~83% lines (see coverage/index.html). Rust coverage: ~44.33% lines (rust-lcov.info).
- Remaining biggest gaps: request editor panels (~68% lines on parameters/body subsections), response-viewer now ~88% but more room on headers/logs filtering, request/http/engine.ts (~67%); Rust http_client engine/lib/hyper_engine/auth.

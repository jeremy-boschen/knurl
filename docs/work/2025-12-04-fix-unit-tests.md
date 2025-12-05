# TODO - Fix failing unit tests (2025-12-04)
- Identify and list failing unit tests in the current codebase.
- Update tests to match current UI behavior (do not change app code unless necessary).
- Surface any expectation changes that cannot be confirmed from code for guidance.
- Add coverage-focused unit tests for uncovered helpers/components (`collection-tree-filter`, `performance-benchmark`, request/window context menus, NotFound page).
- Run `yarn test:unit`; investigate and report any failures.
- Treat React `act(...)` warnings as errors.

## Deferred
- Export-related coverage/workstreams (e.g., export-collection) are postponed per guidance; handle after other areas are green.

## Status
- New tests added for collection tree filter, performance benchmark helper, request/window context menus, NotFound page, collection-tree collapsed UI, dialogs slice/components, and profiler bridge.
- `yarn test:unit` completes all tests but coverage gate still fails: lines 65.42%, statements 65.65% (threshold 70%). Functions/branches now pass.
- Largest remaining deficits: Rust `src-tauri/src/http_client/auth.rs` (~39% of 1991 stmts), `hyper_engine/connector.rs` (~27% of 976 stmts), `http_client/engine.rs` (0%). Frontend stragglers: `not-found.tsx` still shows 0% despite test, `validation-error-display.tsx`, `tooltip.tsx`, `prettier.worker.ts`.
- React dialog warnings (aria/act) still emitted from existing tests (settings/data dialogs, knurl dialog) — needs follow-up if we must treat warnings as errors.

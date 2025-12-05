# 2025-12-04 - Fix Failing Unit Tests Plan

## Task Checklist
- [x] Discover failing unit tests and capture failure details.
- [x] Update tests to reflect current UI/state behavior (tests only unless discrepancy found).
- [x] Re-run targeted suites (layout, request editor panels, collections) to confirm green; full `yarn test:unit` now runs but coverage gate still below thresholds.
- [x] Escalate any expectations that remain ambiguous from code review. *(Collections patch cleanup resolved by adding defaults in tests.)*
- [ ] Raise coverage above thresholds (lines/statements 70%, branches 65%). Current blockers: merged coverage includes low Rust http_client modules (auth.rs ~39%, hyper_engine/connector.rs ~27%, engine.rs 0%) plus UI dialogs (`src-ui/src/components/dialogs/*`), collection-tree-collapsed.tsx, state/collection-tree.ts, lib/profiler-bridge.ts. Export/Export-collection items deferred per guidance; tackle remaining UI/state gaps first, then revisit export last.

## Notes
Follow AGENTS discipline; no app source changes unless explicitly needed to correct test harness issues.

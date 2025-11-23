# Test Suite Audit Plan (Future Work)

## Priority Problem Spots

| File | Test Block | Type | Issue | Action |
|------|------------|------|-------|--------|
| test/specs/requests.e2e.ts | Authoring/Advanced/Multi-Tab/Scratch/Context Menu | e2e | Duplicates store logic; heavy DOM scraping; placeholder asserts; template literal bugs | Collapse to 1–2 happy-path UI flows; move tab/persistence to unit/integration; fix selectors; remove placeholder expects |
| test/specs/auth.e2e.ts | All auth blocks incl. OAuth flows | e2e | Combinatorial matrix duplicating auth unit/integration; pauses; backend logic assertions | Keep single happy-path per auth type; shift placement/validation to Vitest integration; drop pauses |
| test/specs/performance.e2e.ts | Large Collections/Payload | e2e | Timing-based, flaky, not user-visible | Delete or replace with non-timed smoke; move perf checks to profiling |
| test/specs/setvalue-verification.e2e.ts | setValue experiment | e2e | Helper experiment, not product behavior; CodeMirror scraping | Delete or convert to helper/unit test |
| test/specs/setinput-refactor-verification.e2e.ts | Refactored Input Helpers | e2e | Same helper experiment; network use for onChange | Delete or move to unit test of helpers |
| test/specs/tauri-concurrent-invoke.e2e.ts | Concurrency repro | e2e | Not app behavior; intentionally flaky | Remove; keep note in docs if needed |
| test/specs/integration/tauri-integration.e2e.ts | Entire file | e2e (mis-layer) | Bridge-only backend checks, no UI | Port to Vitest/Rust integration; drop WDIO |
| test/specs/collections-management.e2e.ts | Collections Management UX | e2e | DOM scraping for ordering; overlaps state tests; console logging | Keep single create/delete happy-path using data-test IDs; drop ordering and console logs |

## Overlap Guidance
- Treat Vitest unit/integration as source of truth for: auth header/placement (`src/lib/auth.test.ts`, `src/request/http/engine.test.ts`), request tabs/state (`src/state/request-tabs.test.ts`), collection CRUD/persistence (`src/state/collections*.test.ts`, `native-roundtrip.test.ts`), env resolution (`src/lib/environments.test.ts`).
- E2E should cover only one visible happy-path per feature (send request, create collection, env switch, import via UI).

## Remediation Steps
1) Prune/problematic E2Es above (delete or trim to happy paths).
2) Move backend/bridge and helper-behavior checks into Vitest integration/unit where noted.
3) Ensure remaining E2Es use only `data-test-id` selectors and explicit waits (no raw `browser.execute` scraping, no pauses).
4) Keep one UI persistence smoke (collection or scratch) and one send-request smoke; rely on unit/integration for logic matrices.
5) Re-run `yarn test:e2e --spec <kept specs>` to confirm stability after pruning.

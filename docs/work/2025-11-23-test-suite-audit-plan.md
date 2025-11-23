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

## Classification (focused set)

| File | Type | Scope Summary | Overlap/Notes |
|------|------|---------------|---------------|
| test/specs/app.e2e.ts | e2e | Launch smoke/title | OK keep |
| test/specs/requests.e2e.ts | e2e | Authoring, tabs, scratch, context menus | Overlaps request-tabs/store/persistence unit tests; trim |
| test/specs/auth.e2e.ts | e2e | Auth matrices incl. OAuth | Duplicates lib/auth + engine tests; keep one per auth type |
| test/specs/performance.e2e.ts | e2e | Perf/timing and large payload | Flaky; delete or replace |
| test/specs/setvalue-verification.e2e.ts | e2e | Helper experiment (setValue) | Should be unit/helper; remove |
| test/specs/setinput-refactor-verification.e2e.ts | e2e | Helper experiment (setInputText) | Move to unit; remove from e2e |
| test/specs/tauri-concurrent-invoke.e2e.ts | e2e | WDIO driver bug repro | Not product behavior; remove |
| test/specs/integration/tauri-integration.e2e.ts | e2e (mis-layer) | Bridge/backend auth+storage | Move to Vitest/Rust integration |
| test/specs/integration/launch-hydration.e2e.ts | e2e | Hydration/launch via bridge | If no UI, move to integration; else keep minimal UI |
| test/specs/integration/workspace-restore.e2e.ts | e2e | Workspace restore/persistence | Overlaps storage unit; keep one happy-path UI |
| test/specs/collection-encryption.e2e.ts | e2e | Encryption via UI | Ensure visible assertion; overlaps Rust storage tests |
| test/specs/collection-storage.e2e.ts | e2e | Collection persistence UI | Keep single happy-path; rest covered by unit |
| test/specs/collections-core.e2e.ts | e2e | Collection CRUD UI | Overlaps collections store; keep minimal |
| test/specs/collections-flow.e2e.ts | e2e | General collection flow | Merge with collections-core |
| test/specs/collections-management.e2e.ts | e2e | Sidebar create/rename/delete | DOM scraping; trim to happy-path |
| test/specs/environments.e2e.ts | e2e | Env selection UI | Overlaps env manager unit; keep one path |
| test/specs/event-system.e2e.ts | e2e | Event UX | Likely fine; ensure data-test IDs |
| test/specs/import-collection-merge.e2e.ts | e2e | Import merge via UI | Overlaps import unit; keep single flow |
| test/specs/request-execution.e2e.ts | e2e | Send request UI | Keep one send smoke; logic in unit |
| test/specs/settings-ui.e2e.ts | e2e | Settings UI | Overlaps settings unit; keep one happy-path |
| src/components/...*.test.ts(x) | unit | Component render/behavior | Canonical for UI logic; no issues |
| src/lib/*.test.ts | unit | Helpers/auth/env/request prep | Canonical for logic; rely here |
| src/state/*.test.ts | unit | Store slices, persistence | Canonical; overlaps e2e persistence |
| src/request/http/engine.test.ts | unit | HTTP engine mapping | Canonical for auth/header/body; overlaps e2e send |
| src/request/pipeline.test.ts | unit | Pipeline composition | Canonical; overlaps request-execution e2e |
| src/components/utility-sheets/import-collection/native-roundtrip.test.ts | unit | Export/import roundtrip | Covers persistence; overlaps e2e import |
| src/pages/e2e-ux-reference.test.tsx | unit | UX reference page | OK |
| src-tauri/src/** (cfg(test)) | rust | Backend storage/crypto/cookies | Canonical backend coverage; overlaps collection-storage e2e |
## Overlap Guidance
- Treat Vitest unit/integration as source of truth for: auth header/placement (`src/lib/auth.test.ts`, `src/request/http/engine.test.ts`), request tabs/state (`src/state/request-tabs.test.ts`), collection CRUD/persistence (`src/state/collections*.test.ts`, `native-roundtrip.test.ts`), env resolution (`src/lib/environments.test.ts`).
- E2E should cover only one visible happy-path per feature (send request, create collection, env switch, import via UI).

## Remediation Steps
1) Prune/problematic E2Es above (delete or trim to happy paths).
2) Move backend/bridge and helper-behavior checks into Vitest integration/unit where noted.
3) Ensure remaining E2Es use only `data-test-id` selectors and explicit waits (no raw `browser.execute` scraping, no pauses).
4) Keep one UI persistence smoke (collection or scratch) and one send-request smoke; rely on unit/integration for logic matrices.
5) Re-run `yarn test:e2e --spec <kept specs>` to confirm stability after pruning.

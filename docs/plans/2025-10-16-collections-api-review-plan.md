# Collections API Review (2025-10-16)

- [x] Inventory existing `collectionsApi` surface and map concrete callers.
- [x] Spotlight highest-complexity methods (shared updaters, multi-purpose funcs) and capture pain points.
- [ ] Propose refactor strategy: smaller focused commands, clearer data flow, migration steps.
- [ ] Sequence implementation phases with owner + risk notes.

## Guardrails (2025-10-16)

- Enforce single `loadCollection` entrypoint; collections stay resident post-load with aggressive asserts on any access.
- Keep collections API strictly synchronous aside from initial load; mutators/readers must be pure sync.
- Scope creep ban: implement only requirements in current UX flows; reject “optional/future” toggles.

## Refactor Plan

### Phase 0 · Baseline Hardening

- Owner: Agent · Risk: medium (hidden legacy loaders in tests).
- [x] Confirm `collectionsApi.loadCollection` is the sole IO entry: add wrapper that asserts once loaded, refuse redundant async paths.
- [x] Sweep callers for direct cache reads; add `assertCollectionLoaded` helper (sync) invoked before access.
- [x] Instrument dev-only assertions to flag any cache miss after load (supports guardrail #1).

### Phase 1 · Request Patch Simplification

- Owner: Agent · Risk: high (touches request editor + hot keyboard flows).
- [x] Design focused request mutators (`setRequestMeta`, `setQueryParam`, `setHeader`, `setBodyContent`, `setBodyFormField`, etc.).
- [x] Refactor `updateRequestPatch` callsites (hooks + components) to use new mutators.
- [x] Delete generic `updateRequestPatch` + friends once callsites migrated; ensure sync + minimal scope.
- [x] Update tests to cover new API slices and enforce single mutation path.

### Phase 2 · Folder & Request Move Primitives

- Owner: Agent · Risk: high (tree drag/drop regressions, ordering).
- [x] Introduce dedicated helpers for `moveRequest`, `reorderRequests`, `moveFolder`, `deleteFolderCascade` with shared bookkeeping extracted to `collections-lib`.
- [x] Rewrite `deleteFolder`, `moveFolder`, `moveRequestToFolder`, `reorderFolders` to delegate to primitives.
- [x] Validate index integrity via existing assertions; extend tests for ancestry + ordering.

### Phase 3 · Import / Merge Pipeline Cleanup

- Owner: Agent · Risk: medium (edge-case compatibility with external exports).
- [x] Split parsing, reconciliation, and application into pure functions returning mutation plans.
- [x] Reuse normalized helpers from `collections-lib` to eliminate duplicated logic.
- [x] Ensure end result still sync (load step already async); extend integration tests for merge scenarios.

### Phase 4 · API Surface Prune & Consumers

- Owner: Agent · Risk: medium (hidden usage from utility sheets).
- [x] Audit unused/duplicated API members (`setCollectionsIndex`, `saveCollection`, etc.) and remove or hide behind internal module.
- [x] Replace ad-hoc `collectionsApi().getCollection` fetches with selector hooks where appropriate, honoring loaded-only invariant.
- [x] Document remaining public methods + expectations in README/Architecture note.

### Phase 5 · Verification & Rollout

- Owner: Agent · Risk: low (execution-focused).
- [x] Run lint/test suites; add targeted regression cases (patch updates, folder ops, merge).
- [x] Pair manual QA checklist for request editor + collection tree flows.
- [x] Communicate API changes to frontend consumers; provide migration note.

#### Manual QA Checklist (2025-10-19)

- [x] Launch `yarn dev`, load default workspace, ensure existing collections render and expand.
- [x] Create request, mutate headers/query/body/auth tabs, confirm dirty indicators mirror store updates.
- [x] Drag/drop request between folders plus reorder siblings; verify order persists after reload.
- [x] Move nested folders across branches and confirm ancestry breadcrumbs update in UI.
- [x] Save request, duplicate via breadcrumbs, ensure new entry opens without stale data.
- [x] Trigger export flow from collection menu and confirm sheet loads with active collection context.

#### Comms & Artifacts

- [x] Added API surface documentation in `docs/DEVELOPMENT.md` (Collections API Surface).
- [x] Published migration summary in `docs/collections-api-migration-2025-10-19.md` for downstream consumers.

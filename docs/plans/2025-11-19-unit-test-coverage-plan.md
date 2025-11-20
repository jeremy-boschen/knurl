# 2025-11-19 Unit Test Coverage Plan

## Tasks

- [x] Review existing tests for `request-tabs`, `collection-auth-panel`, and `request/exporters` to find gaps.
- [x] Add Vitest coverage for request tab lifecycle behaviors (closing tabs, request updates, scratch cleanup).
- [x] Expand `CollectionAuthPanel` tests to cover OAuth2 discovery, placement guards, and credential caching paths.
- [x] Extend request exporter tests to exercise DNS overrides, multipart handling, and auth placements.
- [x] Run coverage suite and record 2025-11-19 baseline (FE unit tests only; backend run pending integration fix).

## Follow-up Tasks

- [x] Improve branch coverage for `collection-tree.tsx`, `request-workspace.tsx`, and related UI containers.
- [x] Recompute `yarn test:unit` coverage and report deltas.
- [x] Add targeted unit tests for `src/state/collections/core.ts` storage helpers.
- [x] Raise branch coverage for `collection-ops.ts`, `request-body-panel.tsx`, `sidebar.tsx`, and `response-viewer.tsx`.

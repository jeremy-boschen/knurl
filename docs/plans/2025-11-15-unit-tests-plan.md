# Unit Test Coverage Push Plan (2025-11-15)

## Goals
- Substantially increase unit test coverage across critical frontend/state modules without touching e2e suites.
- Document added coverage areas for future tracking.

## Tasks
- [x] Capture current unit test coverage snapshot via `yarn test:unit` (55% lines / 53% funcs / 40% branches as of 2025-11-15).
- [x] Prioritize modules with lowest coverage using reports + `docs/feature-inventory.md` alignment (import/export utility sheets, shared table/dialog primitives, scheduling hooks, startup globals).
- [x] Implement new/expanded Vitest suites for prioritized modules (state slices, libs, bindings).
- [x] Ensure new tests comply with mocking guidelines (no real Tauri IPC/net)
- [x] Re-run `yarn test:unit` to confirm passing + improved coverage; document results (57.5% lines / 56.9% funcs / 41.3% branches on 2025-11-15 run).
- [x] Target `src/state/settings.ts` slice: cover appearance subscriptions + clamped request settings behavior without real storage providers.
- [x] Re-run `yarn test --runInBand src/state/settings.test.ts` (or narrow equivalent) and capture new coverage deltas for log.
- [x] Add focused suite for `src/state/sidebar.ts` (panel interactions, collapse helpers) without hitting DOM APIs beyond PanelGroup mocks.
- [x] Re-run `yarn vitest run src/state/sidebar.test.ts` and record coverage deltas.
- [x] Cover `src/lib/startup-state.ts` (global flag set/get + default) with isolated globals.
- [x] Re-run `yarn vitest run src/lib/startup-state.test.ts` and append coverage diff.
- [x] Add coverage for `src/components/layout/dnd-tree-context.ts` (provider + hooks) to eliminate untested context errors.
- [x] Re-run `yarn vitest run src/components/layout/dnd-tree-context.test.tsx` and log coverage impact.
- [x] Exercise `src/components/layout/title-bar.tsx` (new request CTA + window controls) via React Testing Library.
- [x] Re-run `yarn vitest run src/components/layout/title-bar.test.tsx` to capture deltas.
- [x] Expand UI coverage for `src/components/layout/sidebar.tsx` (mode toggle, collapse/expand buttons, dialogs) using mocked state hooks.
- [x] Re-run `yarn vitest run src/components/layout/sidebar.test.tsx` with new cases.
- [x] Harden `src/components/layout/breadcrumbs.tsx` (request/folder menus, rename/delete flows, clipboard copy) via targeted hook mocks.
- [x] Re-run `yarn vitest run src/components/layout/breadcrumbs.test.tsx` with assertions for rename/delete.
- [x] Add coverage for `src/components/layout/app-header.tsx` & `app-layout.tsx` (title bar + tabs + sidebar integration) with light mock components.
- [x] Re-run `yarn vitest run src/components/layout/app-header.test.tsx src/components/layout/app-layout.test.tsx`.
- [x] Expand pure utility coverage: `src/lib/collections/folder-options.ts` (nested traversal, root handling) to support tree/breadcrumb consumers.
- [x] Re-run `yarn vitest run src/lib/collections/folder-options.test.ts`.
- [x] Add focused suite for `src/components/request/request-workspace.tsx` (active tab render vs. empty, hook wiring for save/close actions) using mocked APIs.
- [x] Re-run `yarn vitest run src/components/request/request-workspace.test.tsx`.
- [x] Cover `src/components/response/response-viewer.tsx` (tab rendering, save/export controls, file shortcuts) with mocked hooks + tauri APIs.
- [x] Re-run `yarn vitest run src/components/response/response-viewer.test.tsx`.
- [x] Add tests for `src/components/utility-sheets/import-collection/use-import-actions.ts` (filtering, import/overwrite/merge statuses).
- [x] Add tests for `src/components/utility-sheets/import-collection/use-selection-manager.ts` (selection toggles, select-all logic).
- [x] Add tests for `src/lib/request/prepared-http.ts` + `src/lib/request/exporters.ts` (URL/header/body prep + exporting formats) with mock auth results.
- [x] Add tests for `src/components/response/components/logs-list.tsx` (level filtering UI, counts).

## Notes
- Scope limited to unit tests; leave e2e artifacts untouched.
- Favor colocated `*.test.ts(x)` files alongside targets per repo convention.
- 2025-11-15: Added `src/state/settings.test.ts` (appearance + request clamps) and verified via `yarn vitest run src/state/settings.test.ts`.
- 2025-11-15: Added `src/state/sidebar.test.ts` (panel collapse helpers) and verified via `yarn vitest run src/state/sidebar.test.ts`.
- 2025-11-15: Added `src/lib/startup-state.test.ts` (global probe helpers) and verified via `yarn vitest run src/lib/startup-state.test.ts`.
- 2025-11-15: Added `src/components/layout/dnd-tree-context.test.tsx` (provider/use hook guards) and verified via `yarn vitest run src/components/layout/dnd-tree-context.test.tsx`.
- 2025-11-15: Added `src/components/layout/title-bar.test.tsx` (CTA + window controls) and verified via `yarn vitest run src/components/layout/title-bar.test.tsx`.
- 2025-11-15: Expanded `src/components/layout/sidebar.test.tsx` (theme toggle, collapse helpers, search) and verified via `yarn vitest run src/components/layout/sidebar.test.tsx`.
- 2025-11-15: Expanded `src/components/layout/breadcrumbs.test.tsx` (request/folder menus, rename/delete flows) and verified via `yarn vitest run src/components/layout/breadcrumbs.test.tsx`.
- 2025-11-15: Added `src/components/layout/app-header.test.tsx` + `app-layout.test.tsx` (integration scaffolding) and verified via `yarn vitest run src/components/layout/app-header.test.tsx src/components/layout/app-layout.test.tsx`.
- 2025-11-15: Added `src/lib/collections/folder-options.test.ts` (root + nested folder traversal) and verified via `yarn vitest run src/lib/collections/folder-options.test.ts`.
- 2025-11-15: Added `src/components/request/request-workspace.test.tsx` (send/save/cancel flows) and verified via `yarn vitest run src/components/request/request-workspace.test.tsx`.
- 2025-11-15: Added `src/components/response/response-viewer.test.tsx` (tabs + save/copy/file actions) and verified via `yarn vitest run src/components/response/response-viewer.test.tsx`.
- 2025-11-15: Added `src/lib/request/prepared-http.test.ts` + `src/lib/request/exporters.test.ts` (HTTP prep + CLI exports) and verified via `yarn vitest run src/lib/request/prepared-http.test.ts src/lib/request/exporters.test.ts`.
- 2025-11-15: Added `src/components/utility-sheets/import-collection/use-import-actions.test.ts` & `use-selection-manager.test.ts` (filtering + selection toggles) and verified via `yarn vitest run src/components/utility-sheets/import-collection/use-import-actions.test.ts src/components/utility-sheets/import-collection/use-selection-manager.test.ts`.
- 2025-11-15: Added `src/components/response/components/logs-list.test.tsx` (level filters + controls) and verified via `yarn vitest run src/components/response/components/logs-list.test.tsx`.

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

## Upcoming Tasks (2025-11-16)
- [x] Refresh coverage snapshot via `VITEST_COVERAGE=true yarn vitest run --coverage` to lock a 2025-11-16 baseline ahead of new suites (60.5% lines / 61.9% funcs / 44.6% branches).
- [x] Add Vitest coverage for `src/components/editor/code-editor.tsx` + `code-viewer.tsx` (language switcher, diff mode, readonly states) using Monaco mocks; verified via `yarn vitest run src/components/editor/code-editor.test.tsx src/components/editor/code-viewer.test.tsx`.
- [x] Cover request save + tab primitives (`src/components/request/save-request-dialog.tsx`, `tabbar/request-tab-bar.tsx`, `tabbar/request-tab.tsx`) focusing on tab close/dirty handling without real IPC; run `yarn vitest run src/components/request/save-request-dialog.test.tsx src/components/request/tabbar/request-tab-bar.test.tsx src/components/request/tabbar/request-tab.test.tsx`.
- [x] Exercise response detail lists (`src/components/response/components/cookie-list.tsx`, `headers-list.tsx`) including empty state + copy buttons with mocked clipboard helpers; run `yarn vitest run src/components/response/components/cookie-list.test.tsx src/components/response/components/headers-list.test.tsx`.
- [x] Build suites for environment/utility sheets (`src/components/utility-sheets/environment-manager/**/*`, `utility-sheets/settings/index.tsx`, `utility-sheets/settings/sections/about.tsx`, `theme-editor/index.tsx`) covering navigation + save flows using mocked state; execute targeted `yarn vitest run src/components/utility-sheets/**/*.test.tsx`.
- [x] Confirm previously added response/request workspace suites still cover file actions after the new mocks by re-running `yarn vitest run src/components/request/request-workspace.test.tsx src/components/response/response-viewer.test.tsx` and tracking coverage delta.

## Upcoming Tasks (2025-11-16 - Evening)
- [x] Add coverage for `src/components/collection/new-collection-dialog.tsx` (validation + submit flows) via `yarn vitest run src/components/collection/new-collection-dialog.test.tsx`.
- [x] Exercise the utility sheet router (`src/components/utility-sheets/utility-sheet-host.tsx`) to ensure sheet transitions and close callbacks are covered; run `yarn vitest run src/components/utility-sheets/utility-sheet-host.test.tsx`.
- [x] Build suites for the remaining import collection primitives (`components/import-preview-step.tsx`, `components/validation-error-display.tsx`) and integrate `import-collection/index.tsx` with mocked hooks; run `yarn vitest run src/components/utility-sheets/import-collection/**/*.test.tsx`.
- [x] Expand `collection-settings` coverage (tab toggles, prop pass-through) via `yarn vitest run src/components/utility-sheets/collection-settings/index.test.tsx`.
- [x] Capture a fresh coverage snapshot (`VITEST_COVERAGE=true yarn vitest run --coverage`) once the above suites land to quantify deltas. *(2025-11-16 15:52 run succeeded after patching Environment Manager tests; coverage artifacts now show 66.5% lines / 70.0% funcs / 48.8% branches, appended full log to `coverage.log`.)*

## Next Targets (2025-11-17)
- [x] Add `src/index.test.tsx` to exercise Tauri bootstrap: mock `@tauri-apps/plugin-log`, `react-dom/client`, and `@/state` hydration to assert `enablePatches` + console proxy wiring fires once and `createRoot(...).render` receives `<Suspense><Root/></Suspense>`; run `yarn vitest run src/index.test.tsx`.
- [x] Cover `src/pages/home.tsx` + `src/pages/e2e-ux-reference.tsx` with RTL suites verifying startup-state transitions (`getStartupState` -> `setStartupState(2)`) and basic interaction flows on the UX reference page (select/menu/input/toggle/button state echoes); run `yarn vitest run src/pages/home.test.tsx src/pages/e2e-ux-reference.test.tsx`.
- [x] Build focused tests for `src/components/ui/knurl/folder-menu.tsx` to confirm each menu item dispatches once per user action and prevents duplicate onClick/onSelect firing; run `yarn vitest run src/components/ui/knurl/folder-menu.test.tsx`.
- [x] Mirror the same coverage for `src/components/ui/knurl/request-menu.tsx`, covering scratch vs. non-scratch rendering, move-target submenu wiring, and payloads for copy/delete; run `yarn vitest run src/components/ui/knurl/request-menu.test.tsx`.
- [x] Extend `src/components/layout/collection-tree.test.tsx` beyond happy-path render by mocking DnD context + `collectionsApi` to cover drag start/over/end reducers (target drop position computation, folder create dialog triggers) and bump file coverage above 40%; run `yarn vitest run src/components/layout/collection-tree.test.tsx`.
- [x] Add schema-driven tests for `src/components/ui/knurl/form.tsx` to exercise each supported control type (Select, Checkbox, Switch, ToggleGroup, Slider, Toggle, Textarea) using stub displayName components and expect correct `handleChange` bridging; run `yarn vitest run src/components/ui/knurl/form.test.tsx`.

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
- 2025-11-16: Coverage report (`coverage/coverage-final.json`) still flags 0% statements for editor, request tabbar/save dialog, response detail lists, and multiple utility sheets—hence the 2025-11-16 task list above.
- 2025-11-16: Captured new baseline coverage (60.5% lines / 61.9% funcs / 44.6% branches) via `VITEST_COVERAGE=true yarn vitest run --coverage`.
- 2025-11-16: Added `src/components/editor/code-editor.test.tsx` & `code-viewer.test.tsx` with CodeMirror/Prettier mocks (mode toggles, placeholder extensions, cached formatting) and verified via `yarn vitest run src/components/editor/code-editor.test.tsx src/components/editor/code-viewer.test.tsx`.
- 2025-11-16: Added request save/tab suites plus new response detail tests and reran `yarn vitest run src/components/request/save-request-dialog.test.tsx src/components/request/tabbar/request-tab-bar.test.tsx src/components/request/tabbar/request-tab.test.tsx` and `yarn vitest run src/components/response/components/cookie-list.test.tsx src/components/response/components/headers-list.test.tsx`.
- 2025-11-16: Built environment + utility sheet coverage (`environment-manager`, `settings`, `theme-editor`) and confirmed via `yarn vitest run src/components/utility-sheets/**/*.test.tsx`.
- 2025-11-16: Re-verified `src/components/request/request-workspace.test.tsx src/components/response/response-viewer.test.tsx` to ensure regressions weren’t introduced by new mocks.
- 2025-11-16: Patched Environment Manager tests to use `vi.hoisted` mocks + deterministic `fireEvent.change` so coverage runs no longer die during instrumentation; latest snapshot recorded above.
- 2025-11-16: Added `src/index.test.tsx` to lock bootstrap coverage (attachConsole + console proxy wiring + hydration) and verified via `yarn vitest run src/index.test.tsx`.
- 2025-11-16: Landed page coverage for `src/pages/home.tsx` (startup-state guard) and `src/pages/e2e-ux-reference.tsx` (select/menu/input/toggle/button flows) using `yarn vitest run src/pages/home.test.tsx src/pages/e2e-ux-reference.test.tsx`.
- 2025-11-16: Created menu action suites for `src/components/ui/knurl/folder-menu.tsx` and `src/components/ui/knurl/request-menu.tsx` (including mocked submenus) via `yarn vitest run src/components/ui/knurl/folder-menu.test.tsx src/components/ui/knurl/request-menu.test.tsx`.
- 2025-11-16: Expanded `src/components/layout/collection-tree.test.tsx` with mocked DnD context + state hooks to assert reorder/move behaviors, confirmed by `yarn vitest run src/components/layout/collection-tree.test.tsx`.
- 2025-11-16: Added `src/components/ui/knurl/form.test.tsx` to exercise each supported control type (Select/Checkbox/Switch/Radio/ToggleGroup/Slider/Toggle/default input) and validate `handleChange` bridging with `yarn vitest run src/components/ui/knurl/form.test.tsx`.
- 2025-11-16: Added `src/components/ui/knurl/file-input.test.tsx` (dialog + tauri drop + DOM drop + clear flows) via `yarn vitest run src/components/ui/knurl/file-input.test.tsx`.
- 2025-11-16: Expanded `src/components/request/editor/request-parameters-panel.test.tsx` to cover path/query/cookie toggles + empty states with `yarn vitest run src/components/request/editor/request-parameters-panel.test.tsx`.
- 2025-11-16: Created `src/components/utility-sheets/theme-editor/index.test.tsx` (apply/clear/reset) using mocked sheet + settings APIs, validated via `yarn vitest run src/components/utility-sheets/theme-editor/index.test.tsx`.
- 2025-11-16: Added `src/components/utility-sheets/settings/sections/appearance.test.tsx` (font size, theme source radios, fetch flow) and ran `yarn vitest run src/components/utility-sheets/settings/sections/appearance.test.tsx`.
- 2025-11-16: Added `src/components/utility-sheets/collection-settings/collection-auth-panel.test.tsx` (basic creds, auth type dropdown, bearer placements) via `yarn vitest run src/components/utility-sheets/collection-settings/collection-auth-panel.test.tsx`.
- 2025-11-16: Added `src/components/request/editor/request-body-panel.test.tsx` (text formatting, form edits, binary drop) and verified with `yarn vitest run src/components/request/editor/request-body-panel.test.tsx`.
- 2025-11-16: Added `src/components/editor/code-editor-theme.test.ts` to exercise the CodeMirror extension bundle via `yarn vitest run src/components/editor/code-editor-theme.test.ts` (ensures the theme extension loads without runtime regressions).
- 2025-11-16: Added `src/components/utility-sheets/collection-settings/collection-auth-panel.test.tsx` API key coverage (placement/name updates) and `src/types/request/body.test.ts` (schema defaults + grammar detection) with `yarn vitest run` for both new suites.

## Tasks (2025-11-17)
- [x] Boost `src/components/layout/collection-tree.tsx` coverage for `handleAction` dialog paths plus drop indicator logic (folder/request drag over cases) via expanded `collection-tree.test.tsx`.
- [x] Extend `src/components/response/response-viewer.test.tsx` to cover preview tab, cookies/logs tabs, binary save/copy flows, and file-path open/reveal controls.
- [x] Add pointer/resize interaction tests for `src/components/ui/knurl/dialog.tsx` to eliminate 0% blocks tied to draggable/handle listeners.
- [x] Cover error/fallback branches in `src/components/utility-sheets/theme-editor/index.tsx` (failed fetch, cancel confirm) with updated tests.
- [x] Increase `src/state/request-tabs.ts` coverage by isolating helper functions (`runTasks`, persistence guards) in a new test suite.

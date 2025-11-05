## Auto Docs E2E Plan (2025-10-13)

- [x] Inventory component `data-test-id` coverage (expect light gaps)
- Coverage: `test/data-test-ids.md` mirrors IDs across app/layout/sidebar/collection tree/request workspace/editor/response viewer/utility sheets/settings/OAuth/dialogs.
- Gap notes: no IDs on window chrome helpers or command palette; add only if flows demand.
- [x] Audit existing WDIO setup + screenshot APIs
- `wdio.conf.ts` builds tauri binary, boots Vite dev (mode `e2e`), spawns `tauri-driver`, waits for `__KNURL_STARTUP_STATE__ === 2`; no custom screenshot pipeline yet.
- Current specs (`test/specs/*.e2e.ts`) lean on text/ARIA + legacy `data-testid`; no saveScreenshot usage; baseline smoke + collections flow only.
- [x] Build selector map leveraging `data-test-id` attributes
- Primary handles: `app.window=[data-test-id="app:main-window"]`, `layout.root=[data-test-id="app-layout"]`, `sidebar.root=[data-test-id="sidebar"]`, `sidebar.newCollection=[data-test-id="sidebar:new-collection-button"]`, `collectionTree.root=[data-test-id="collection-tree"]`, `collectionTree.collectionRow(id)=[data-test-id="collection-tree:collection-row:${id}"]`, `collectionTree.requestRow(id)=[data-test-id="collection-tree:request-row:${id}"]`, `requestWorkspace.root=[data-test-id="request-workspace"]`, `requestWorkspace.method=[data-test-id="request-workspace:method-select"]`, `requestWorkspace.url=[data-test-id="request-workspace:url-input"]`, `requestWorkspace.send=[data-test-id="request-workspace:send-button"]`, `requestWorkspace.exportMenu=[data-test-id="request-workspace:export-menu-button"]`, response tabs via `response-viewer:tab-*`, modals like `saveRequest` and `newCollection` expose `data-test-id` parity per `test/data-test-ids.md`.
- [x] Define target app flows for auto docs runbook
- Flows: (1) App launch + layout tour (sidebar/env selector/request workspace) (2) Create collection + scratch request promotion (3) Compose + send sample GET (stub via mock server) (4) Save request + verify tree persistence (5) Review response tabs (headers/cookies/logs) (6) Manage environments sheet open/close (7) Settings theme toggle snapshot.
- [x] Confirm remaining markup gaps (loop in owner before edits; avoid new IDs unless blocking)
- Needs-owner fixes: swap `data-testid`→`data-test-id` on `request-workspace` save control, consider root handles for `response-viewer` + sheets only if framing demands; hold changes pending approval.
- [x] Design markdown structure + TOC strategy
- Output shape: front-matter (run timestamp + app build), `# Auto Docs` intro, prerequisites list, `## Flows` with numbered `### Flow 1 – ...` subsections containing 1 screenshot + ordered steps, snapshot metadata tables appended; generate TOC via static heading scan (no extra deps) and inject below title.
- [x] Implement e2e doc generator test
- Added `test/support/auto-docs.ts` helper + `test/specs/auto-docs.e2e.ts`; flows capture screenshots and emit `docs/auto/latest/auto-docs.md`.
- [ ] Verify output + add usage docs
- Usage note staged in `docs/auto/README.md`; run + snapshot diff validation still pending once we execute the generator.

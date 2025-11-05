# 2025-10-25 UX Coverage Plan

- [x] Audit scratch collection + management coverage and existing specs.
- [x] Draft UX spec updates for prioritized scenarios.
- [x] Implement new e2e spec scaffolding plus helpers.

## Notes

- Focus option 1: scratch restart validations + collection management flows.

## Spec Outline

- `scratch-collection.e2e.ts`
  - Validate scratch menu exposes `Clear All` without `Delete`.
  - Persist a scratch request through reload via bridge snapshot.
  - Clear scratch requests while ensuring the collection shell remains.
- `collections-management.e2e.ts`
  - Create baseline collections, rename via dialog, and confirm persistence across reload.
  - Delete via destructive dialog while ensuring remaining collections stay intact.
  - Duplication and reorder scenarios still pending UI hook.

## Upcoming Coverage Targets

- `launch-hydration.e2e.ts` (implemented)
  - Seed persisted data (valid + malformed) and verify startup hydrates required collections, invoking post-hydrate hooks without console errors.
- `collections-import-export.e2e.ts`
  - Exercise export flow to ensure secrets are scrubbed; re-import bundle and validate structure in UI.
- `collections-merge.e2e.ts`
  - Simulate conflicting import, walk through merge UI, assert summary + resulting collection state.
- `request-methods.e2e.ts`
  - Iterate through HTTP methods, edit parameters, and confirm echoed responses reflect method-specific behaviour.
- `request-bodies.e2e.ts`
  - Cover raw, JSON, form-encoded, and multipart payloads hitting echo endpoint, validating payload shape.
- `request-headers.e2e.ts`
  - Toggle headers on/off, reorder when supported, and ensure disabled headers are omitted from outbound request.
- `environment-interpolation.e2e.ts`
  - Validate environment variables resolving across URL, headers, body, and auth; include per-request environment fallback.
- `secrets-scope.e2e.ts`
  - Confirm secrets remain scoped per collection, stay masked after restart, and exports omit secure values.
- `request-cancel.e2e.ts`
  - Use delayed mock endpoint to trigger cancel action and assert backend abort.
- `response-timeline.e2e.ts`
  - Assert timeline/log entries populate with expected phases and filtering behaviour.
- `binary-download.e2e.ts`
  - Request binary payload, ensure download prompt/guard instead of inline rendering.
- `response-metadata.e2e.ts`
  - Verify status/duration/size metadata persists when switching tabs or navigating away/back.
- `telemetry-guard.e2e.ts`
  - Detect unexpected outbound network calls to enforce local-only data policy.
- `resilience.e2e.ts`
  - Corrupt persisted files before launch and confirm recovery messaging plus rebuilt defaults.
- `tauri-commands.e2e.ts`
  - Invoke file export, clipboard, networking, and auth flows through UI to prove backend command responsiveness.
- `platform-prereq.spec.mjs`
  - Script or smoke test ensuring prerequisites (e.g., WebView2) present with friendly errors when missing.

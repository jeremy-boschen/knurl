## Task: Verify merge-coverage.mjs combines disjoint suite outputs (2025-12-06)

- [x] Choose three non-overlapping tests:
  - frontend unit: `src-ui/src/lib/performance-benchmark.test.ts`
  - rust unit: one test in `src-tauri/src/http_client/cookies.rs` (e.g., `parses_basic_cookie_with_attrs`)
  - e2e: `src-common/e2e/specs/ux-reference.e2e.ts`
- [x] Clean local `coverage/` and `.nyc_output/` (local workspace only).
- [x] Run frontend unit test individually with coverage; snapshot in `coverage-experiment/unit`.
- [ ] Run rust test individually with coverage; snapshot results.
- [ ] Run selected E2E spec with coverage; snapshot results.
- [ ] Merge the three snapshots using `scripts/test/merge-coverage.mjs`.
- [ ] Compare merged summary to manual merge of the three JSONs; note any mismatch.
- [ ] Summarize findings and recommend next steps.

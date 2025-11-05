# 2025-10-23 UX Automation Plan

- [x] Design UX automation approach for workspace restore and OAuth UI flows
- [x] Implement workspace restore e2e spec with supporting helpers
- [x] Implement OAuth UI flows e2e spec and required utilities
- [ ] Update documentation/coverage tracking and run targeted tests
  - [x] Align `docs/feature-ux-test-coverage.md` with `docs/feature-inventory.md`
  - [x] Re-run affected UX specs after documentation sync (`TAURI_ENV_DEBUG=1 yarn test:e2e --spec test/specs/collections-flow.e2e.ts`)
- [x] Build shared UI interaction library and test reference page for e2e harness
- [ ] Retrofit existing e2e specs to consume shared UI interaction helpers

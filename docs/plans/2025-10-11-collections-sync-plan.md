# Collections API Sync Refactor Plan (2025-10-11)

- [x] Inspect current collections API signatures and async usage.
- [x] Add async `loadCollection` entry point and adjust type contracts.
- [x] Convert remaining API methods to sync behavior and update implementations.
- [x] Sweep call sites/tests to drop `await` usage and ensure assertions guard unloaded state.
- [x] Run targeted checks (lint/tests) if time allows and capture follow-ups.
- [x] Audit request-tabs API signatures and usages.
- [x] Introduce explicit loader for request-tabs and convert remaining methods to sync semantics.
- [x] Update UI/tests to drop unnecessary `await` and lean on assertions.

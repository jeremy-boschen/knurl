# Environment Editor Caret Plan

- [x] Investigate caret jump regression in `src/components/utility-sheets/environment-manager/components/environment-editor.tsx`.
- [x] Implement state update fix to keep cursor position stable.
- [x] Validate the change (manual reasoning; no automated tests run).
- [x] Investigate remaining caret jumps in collection auth inputs.
- [x] Ensure collection updates avoid async cache fetches when cache is warm.
- [x] Replace cache helper with assert-based guard (no implicit loads).
- [x] Convert collection/environment mutators to synchronous and assert loaded state.
- [x] Update dependent types and UI call sites to drop unnecessary `async/await`.
- [x] Validate broader fix (manual reasoning; consider targeted UI smoke).
- [x] Align environment mutations with direct `set` usage (no legacy `setAndSync`).
- [x] Ensure request send path loads collection env and updates per-tab selection.
- [x] Audit utility sheet launches to preload collections (menus, tree, selector).

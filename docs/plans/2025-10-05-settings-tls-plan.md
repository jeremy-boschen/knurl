# Settings & TLS Fixes Plan (2025-10-05)

- [x] Ensure default settings apply on first launch and persist immediately.
- [x] Instrument TLS root loading and add fallback to Mozilla bundle for visibility.
- [x] Document new diagnostics and rerun checks (`cargo check`, `yarn lint`).
- [x] Windows builds now rely on the OS certificate verifier when no custom CA bundle is supplied, allowing corporate roots (2025-10-05).

## Notes
- Settings slice now saves defaults when no persisted file exists and registers DOM subscriptions on first load.
- TLS connector logs native store stats, reports loader errors, and falls back to webpki roots if empty.
- Added `@resvg/resvg-js` helper script (`scripts/generate-icons.mjs`) for transparent icon generation.

# Knurl Developer Guide

This document covers everything you need to work on Knurl. For project goals, feature overviews, and screenshots, see the main `README.md`.

## Prerequisites

Knurl targets Node.js 20+ and Rust 1.88 or later. The table below lists the additional tooling you may need per platform.

| Requirement | Windows | macOS | Linux |
| ----------- | ------- | ----- | ----- |
| Node.js 20+ & Yarn 4 | ✓ | ✓ | ✓ |
| Rust 1.88+ (via `rustup`) | ✓ | ✓ | ✓ |
| MSVC Build Tools + WebView2 | ✓ | – | – |
| Xcode Command Line Tools | – | ✓ | – |
| GTK / WebKit dependencies | – | – | `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` |

> **Tip:** On Windows we ship `.cargo/config.toml` entries that pin `aws-lc-sys` to prebuilt artifacts. Leave them in place unless you explicitly want to compile aws-lc yourself (requires CMake and NASM).

## Installing Dependencies

1. Enable Corepack (once per machine):

   ```bash
   corepack enable
   ```

2. Install JavaScript dependencies (Yarn Plug'n'Play keeps modules in `.yarn/cache`):

   ```bash
   yarn install --immutable
   ```

3. Fetch Rust crates as needed. Cargo will download them during the first build; you do not need a manual step.

## Common Commands

```bash
# Run the full-stack app (frontend + Tauri backend)
yarn tauri dev

# Frontend-only Vite server
yarn dev

# Run all quality gates
yarn check

# Format sources
yarn format

# TypeScript type check
yarn typecheck

# Lint JS/TS + cargo clippy
yarn lint

# Run Vitest + Rust unit tests
yarn test

# Production build
yarn tauri build
```

## Project Structure

```
├── src/                  # React 19 UI, hooks, Zustand stores
├── src/components/       # Feature components (non-generated UI)
├── src/lib/              # Shared utilities
├── src/state/            # Zustand slices with Immer
├── src-tauri/            # Rust backend (HTTP engine, storage, Tauri commands)
│   ├── src/http_client/  # libcurl-based execution and TLS
│   └── src/app_data/     # Encrypted local persistence (AES-GCM)
├── public/               # Static assets bundled with the app
├── scripts/              # Helper scripts (tests, release, etc.)
└── docs/plans/           # Ongoing workstream notes
```

State is centralised in `src/state/application.ts`. Use the accessor helpers (e.g. `useCollection`, `useEnvironments`) instead of talking to slices directly so Hot Module Reloading remains stable.

## Testing

The `yarn test` meta command runs both Vitest (frontend) and `cargo test` (backend). You can target individual suites:

```bash
yarn test:fe      # Vitest + React Testing Library
yarn test:be      # cargo test inside src-tauri
```

Vitest is configured via `src/test/setup.ts` to mock Tauri IPC and browser APIs. Avoid interacting with the real operating system in unit tests; use the provided mocks instead.

Rust code follows the usual split of inline `#[cfg(test)]` modules for unit tests and integration tests under `src-tauri/tests/`.

## Contributing

* Read `.github/CONTRIBUTING.md` for contribution guidelines and PR expectations.
* Use Conventional Commit messages (e.g. `feat:`, `fix:`, `chore:`).
* Run `yarn check` before pushing to catch formatting, lint, and test regressions.

If you are publishing a release manually, see `scripts/release-local.mjs` for a workflow that builds locally and uploads artefacts through the GitHub CLI.

## Troubleshooting

| Issue | Suggestion |
| ----- | ---------- |
| `yarn install` fails on Windows | Ensure Developer Mode is enabled or run from a path without spaces. |
| Tauri build stalls during linking | Run `cargo build --release --timings` and inspect `target/cargo-timings/*.html` for slow crates; antivirus exclusions for `src-tauri/target` also help. |
| OAuth flows do not open browser | Check that the Tauri pattern `http(s)://localhost` is permitted by your provider; KNURL opens the system browser via Tauri's shell API. |

For more help, open a GitHub Discussion or issue with reproduction steps.

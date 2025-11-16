# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Knurl:** Privacy-first desktop HTTP client.
- **Frontend:** React 19 + TypeScript, Zustand state management, Vite build
- **Backend:** Rust with Tauri 2 (Hyper + Rustls for HTTP, AES-GCM encryption)
- Offline-only; no cloud sync or telemetry

## Development Commands

```bash
yarn dev              # Frontend-only Vite dev server
yarn tauri dev        # Full-stack dev (hot reload)
yarn tauri build      # Production build
yarn check            # Format, lint, typecheck, tests
yarn format           # Biome + cargo fmt
yarn lint             # Biome + cargo clippy -D warnings
yarn typecheck        # TypeScript only
yarn test             # All tests (frontend + backend)
yarn test:fe          # Vitest + React Testing Library
yarn test:be          # cargo test (src-tauri)
yarn test:e2e         # WebDriver.io E2E
yarn portal:package   # Distribution bundle
yarn security         # gitleaks, cargo-deny, cargo-audit
```

## Directory Structure

```
src/                      React 19 frontend
├── components/            Feature UIs + shadcn UI
├── state/                 Zustand slices (Immer + storage middleware)
│   ├── application.ts     Root store + hook accessors
│   ├── collections.ts     Collections/requests/folders
│   ├── request-tabs.ts    Request tab editing state
│   ├── settings.ts        User preferences
│   ├── credentials.ts     Auth cache
│   └── utility-sheets.ts  Modal/sheet state
├── types/                 Type defs + Zod schemas
├── lib/                   Utilities (env, theme, etc.)
├── hooks/                 Custom React hooks
├── pages/                 Route components
├── request/               Request execution + WebSocket
└── test/                  Setup + Tauri/browser mocks

src-tauri/                Rust backend
├── src/
│   ├── http_client/       HTTP engine (Hyper + Rustls)
│   │   ├── engine.rs      Request/response handling
│   │   ├── auth.rs        Auth schemes
│   │   ├── cookies.rs     Cookie jar (RFC 6265)
│   │   ├── manager.rs     Lifecycle management
│   │   └── hyper_engine/  Hyper connector
│   ├── app_data/          AES-GCM encrypted storage
│   │   ├── crypto.rs      Encrypt/decrypt
│   │   └── loader.rs      File I/O + keyring
│   ├── errors/            Error types
│   └── main.rs            Tauri commands
└── Cargo.toml

scripts/                   Build/release helpers
docs/
├── DEVELOPMENT.md         Setup guide
├── CONTRIBUTING.md        Contribution expectations
└── plans/                 Workstream docs
.github/                   Workflows, templates
```

## Architecture Patterns

**State Management:** `useApplication` (src/state/application.ts) composes slices with Immer + storage middleware. Each domain (collections, settings, credentials) has a slice creator. Access via stable function-returning APIs: `collectionsApi()`, `settingsApi()`, etc. (critical for HMR). React hooks (`useCollection(id)`, `useCollections`) ensure data is loaded before return.

**Collections API (src/state/application.ts:63-93 + collections.ts)** is single source of truth:
- **Index/persistence:** `getCollectionsIndex`, `loadCollection`, `saveCollection`
- **Collection ops:** `add`, `update`, `remove`, `import`, `export`
- **Request ops:** `getRequest`, `createRequest`, `duplicateRequest`, `deleteRequest`, `updateRequest`, `setRequestAuthentication`, `updateRequestBody`, plus granular patch mutators
- **Folder ops:** `createFolder`, `renameFolder`, `deleteFolder`, `moveFolder`
- **Environment ops:** `createEnvironment`, `updateEnvironment`, `deleteEnvironment`, `addEnvironmentVariable`

All mutators run synchronously; persistence is transparent.

**HTTP Client (src-tauri/src/http_client/):** Hyper + Rustls engine (engine.rs). Native TLS validation per platform. Auth: Bearer, Basic, API Key, OAuth2. Cookies: persistent jar (RFC 6265 domain/path matching). WebSocket supported.

**Storage:** AES-GCM encrypted via system keyring (Windows Credential Manager, macOS Keychain, Linux Secret Service). Collections as JSON files in app data dir.

## Development Workflow

**Before PR:** Run `yarn check` (format, lint, tests). For Rust: `cargo fmt && cargo clippy -- -D warnings`. Zero `any` types; use Zod for validation.

**Testing:**
- **Unit tests** (Vitest + React Testing Library): Located in `*.test.ts(x)` files colocated with source. Mock all external dependencies (Tauri IPC, filesystem, network). Focus on business logic, state mutations, and component behavior in isolation. Use `mockIPC` from `src/test/setup.ts`.
- **E2E tests** (WebDriver.io): Only test user-visible behavior via UI interactions. Create test state **exclusively** through UI actions (clicking, typing, etc.). Verify outcomes **only** what the UI displays. Never access internal app state, filesystem, or Tauri commands. If you can't create or verify via the UI, use a unit or integration test.
- **Integration tests** (WebDriver.io + backend access): Cross-layer behavior verification (encryption at rest, file persistence, state synchronization). Requires explicit approval. Setup via UI where possible; use backend access only for verification. Store in `test/specs/integration/`.
- **Rust tests**: Inline `#[cfg(test)]` modules for units; `src-tauri/tests/` for integration. No real network/OS calls.

**Code style:**
- Imports: `@/` alias (internal); Biome order: React → packages → local
- Zustand: use `set` (Immer), `get` in slices
- Zod: define as `zSomething`; validate at boundaries
- Rust: no `unwrap()`/`expect()` in production; use `thiserror`
- Icons: always `*Icon` variants (e.g., `PlusIcon`)

## Common Tasks

**Add request field:**
1. Type in `src/types/request.ts`
2. Zod schema (e.g., `zRequestPathParam`)
3. Setter in `collectionsApi()` (e.g., `updateRequestPatchPathParam`)
4. Component in `src/components/request/editor/`
5. Sync via `commitRequestPatch` or granular setters

**Add environment variable:** Use `environmentsApi().addEnvironmentVariable(envId, key, value)`. Templates: `{{variableName}}` syntax in `src/lib/environments.ts`. Substitution in Rust engine before send.

**Add OAuth2 provider:** Config in `src/components/auth/oauth2-editor.tsx`. OpenID Connect discovery flow. Redirect URI always `http(s)://localhost` (Tauri handles browser). Test with `yarn oauth-server`.

**Work with collections:** Read via `useCollection(id)` hook (handles loading). Persist via `collectionsApi().saveCollection()`. JSON imports validate via `importCollection`. Reordering uses `dnd-kit`; call `reorderFolders` or `reorderRequestsInFolder`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `yarn install` fails (Windows) | Enable Developer Mode; run from path without spaces |
| Tauri build stalls | Check `target/cargo-timings/*.html`; exclude `src-tauri/target` from antivirus |
| Types fail to check | `yarn typecheck` for details; check for missing `React` imports |
| Tests fail mysteriously | Verify `src/test/setup.ts` imported; Tauri API must be mocked |
| OAuth browser won't open | Whitelist `http(s)://localhost` in OAuth provider's redirect URI |

## References

- Full dev guide: `docs/DEVELOPMENT.md`
- Contribution expectations: `.github/CONTRIBUTING.md`
- Release process: `scripts/update-version.mjs`
- Active workstreams: `docs/plans/`
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`)

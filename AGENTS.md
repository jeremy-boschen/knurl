# AGENTS.md

This file provides guidance to agentic tools when working with code in this repository.

## 🚨 CRITICAL: Agent Operating Discipline

**This is non-negotiable. Scope creep and autonomously redefining requirements wastes resources and breaks trust.**

When the user specifies work to do:

1. **Create a TODO file in docs/work/ of EXACTLY what was asked** — treat that TODO list as the sole work plan. Do not
   add work, reinterpret, or expand scope without explicit approval.
2. **If you encounter a blocker that prevents achieving the stated goals, STOP immediately** — do not work around the
   blocker by changing the requirement. Instead, communicate the blocker clearly and ask for help.
3. **Never unilaterally change what work "should really do"** — if the requirement seems suboptimal, ask first. Do not
   autonomously rewrite test assertions, change test purpose, or expand scope to handle edge cases you think should be
   covered.
4. **Do not make unilateral decisions about implementation approach** — if hitting a technical wall (e.g., app reload
   breaks WebDriver, UI interaction is flaky), share the problem and ask for guidance rather than changing scope.

**Example of violation:** User asks to verify collection persistence across app reload. You encounter a technical
blocker (app reload breaks WebDriver), so you unilaterally rewrite the test to verify only immediate UI state instead.
This changed the test's purpose without asking.

**Example of correct approach:** User asks to verify collection persistence across app reload. You encounter the same
blocker. You STOP, document the blocker clearly, and ask: "How should we verify persistence if location.reload() breaks
the WebDriver session?"

---

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
yarn test:unit        # All unit tests (frontend + backend)
yarn test:e2e         # WebDriver.io E2E tests
yarn test:coverage    # Coverage report
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

**State Management:** `useApplication` (src/state/application.ts) composes slices with Immer + storage middleware. Each
domain (collections, settings, credentials) has a slice creator. Access via stable function-returning APIs:
`collectionsApi()`, `settingsApi()`, etc. (critical for HMR). React hooks (`useCollection(id)`, `useCollections`) ensure
data is loaded before return.

**Collections API (src/state/application.ts:63-93 + collections.ts)** is single source of truth:

- **Index/persistence:** `getCollectionsIndex`, `loadCollection`, `saveCollection`
- **Collection ops:** `add`, `update`, `remove`, `import`, `export`
- **Request ops:** `getRequest`, `createRequest`, `duplicateRequest`, `deleteRequest`, `updateRequest`,
  `setRequestAuthentication`, `updateRequestBody`, plus granular patch mutators
- **Folder ops:** `createFolder`, `renameFolder`, `deleteFolder`, `moveFolder`
- **Environment ops:** `createEnvironment`, `updateEnvironment`, `deleteEnvironment`, `addEnvironmentVariable`

All mutators run synchronously; persistence is transparent.

**HTTP Client (src-tauri/src/http_client/):** Hyper + Rustls engine (engine.rs). Native TLS validation per platform.
Auth: Bearer, Basic, API Key, OAuth2. Cookies: persistent jar (RFC 6265 domain/path matching). WebSocket supported.

**Storage:** AES-GCM encrypted via system keyring (Windows Credential Manager, macOS Keychain, Linux Secret Service).
Collections as JSON files in app data dir.

## Development Workflow

**Before PR:** Run `yarn check` (format, lint, tests). For Rust: `cargo fmt && cargo clippy -- -D warnings`. Zero `any`
types; use Zod for validation.

**Testing:**

Commands:

- `yarn test:unit` — All unit tests (Vitest + cargo test)
- `yarn test:e2e` — All E2E tests (WebDriver.io)
- `yarn test:e2e --spec="path/to/test.e2e.ts"` — Single E2E file
- `yarn test:coverage` — Coverage report

Patterns:

- **Unit tests** (Vitest + React Testing Library): Located in `*.test.ts(x)` files colocated with source. Mock all
  external dependencies (Tauri IPC, filesystem, network). Focus on business logic, state mutations, and component
  behavior in isolation. Use `mockIPC` from `src/test/setup.ts`.
- **E2E tests** (WebDriver.io):
    - **Golden rule:** Only test user-visible behavior via UI interactions. Create test state **exclusively** through UI
      actions (clicking, typing, etc.). Verify outcomes **only** what the UI displays.
    - **No plumbing:** Never access internal app state, `__vite_ssr_modules__`, call `browser.execute()` to inspect
      state, filesystem, or invoke Tauri commands. If you can't create or verify via the UI, use a unit or integration
      test.
    - **UI helpers only:** Use only shared helpers from `test/support/ui.ts`. Extend that library instead of
      hand-rolling selectors.
    - **See:** `test/support/E2E_GUIDELINES.md` for comprehensive patterns, helper functions, common patterns, and
      troubleshooting.
- **Integration tests** (WebDriver.io + backend access): Cross-layer behavior verification (encryption at rest, file
  persistence, state synchronization). **Requires explicit approval.** Setup via UI where possible; use backend access
  only for verification. Store in `test/specs/integration/`.
  See [Integration Test Criteria](#integration-test-approval-criteria) below.
- **Rust tests**: Inline `#[cfg(test)]` modules for units; `src-tauri/tests/` for integration. No real network/OS calls.
- **Network mocking:** Avoid hitting real networks/OS services in all tests; rely on mocks. E2E tests use the mock
  server at `http://127.0.0.1:3000`. Add endpoints to `scripts/mock-endpoint-server.mjs` if needed, do not call external
  services like httpbin.org.

**Code style:**

- Imports: `@/` alias (internal); Biome order: React → packages → local
- Zustand: use `set` (Immer), `get` in slices
- Zod: define as `zSomething`; validate at boundaries
- Rust: no `unwrap()`/`expect()` in production; use `thiserror`
- Icons: always `*Icon` variants (e.g., `PlusIcon`)

## Communication Style

Be extremely concise. Sacrifice grammar for the sake of brevity. Avoid unnecessary words; prioritize clarity and action.

## 🚨 CRITICAL: Agent Operating Discipline

**NEVER autonomously expand scope or change what is being tested.**

When given a task:

1. **Create a TODO of EXACTLY what was asked for** - treat it as the sole test plan
2. **If you hit a blocker**, you MUST:
    - Stop immediately
    - Share the specific blocker
    - Ask for help/direction
    - Wait for response
3. **Do NOT work around blockers** by changing requirements
4. **Do NOT make unilateral decisions** about what the work should really do

This is non-negotiable. Scope creep and autonomously redefining requirements wastes resources and breaks trust.

## Planning Protocol

For multi-step work (3+ steps or non-trivial tasks):

1. Create or update a dated plan file under `docs/plans/` named `docs/plans/YYYY-MM-DD-<task>-plan.md`
2. Include a live task checklist with status (pending/in-progress/completed)
3. Update the plan file immediately when scope or approach changes
4. This allows work to resume after interruptions with full context preserved

## Common Tasks

**Add request field:**

1. Type in `src/types/request.ts`
2. Zod schema (e.g., `zRequestPathParam`)
3. Setter in `collectionsApi()` (e.g., `updateRequestPatchPathParam`)
4. Component in `src/components/request/editor/`
5. Sync via `commitRequestPatch` or granular setters

**Add environment variable:** Use `environmentsApi().addEnvironmentVariable(envId, key, value)`. Templates:
`{{variableName}}` syntax in `src/lib/environments.ts`. Substitution in Rust engine before send.

**Add OAuth2 provider:** Config in `src/components/auth/oauth2-editor.tsx`. OpenID Connect discovery flow. Redirect URI
always `http(s)://localhost` (Tauri handles browser). Test with `yarn oauth-server`.

**Work with collections:** Read via `useCollection(id)` hook (handles loading). Persist via
`collectionsApi().saveCollection()`. JSON imports validate via `importCollection`. Reordering uses `dnd-kit`; call
`reorderFolders` or `reorderRequestsInFolder`.

## Integration Test Approval Criteria

Integration tests verify cross-layer behavior and require **explicit approval** before implementation. Use this decision
tree:

### When to Use Integration Tests

Integration tests are appropriate when **ALL** of the following are true:

1. **Backend verification is essential**
    - The behavior depends on correct backend implementation (file I/O, encryption, Tauri commands)
    - The implementation details are NOT exposed through the normal UI
    - You cannot verify the behavior by inspecting the DOM after user interactions

2. **Cannot test via E2E alone**
    - State cannot be created exclusively through UI interactions
    - Outcome cannot be verified by inspecting the UI (DOM queries, visual elements)
    - Bridge/backend access is required for verification

3. **Cannot test via unit tests**
    - The behavior requires real app state (not mocked)
    - The behavior requires actual file system access
    - The behavior requires Tauri backend integration

### Before Writing an Integration Test

Ask yourself:

- Can I create this state through UI interactions? → **Use E2E test**
- Can I verify the outcome by inspecting the DOM? → **Use E2E test**
- Can I test the logic with mocked dependencies? → **Use unit test**
- Do I need to verify backend behavior not exposed in the UI? → **Integrate test (with justification)**

### Integration Test Template

```typescript
/**
 * Integration Test: [One-line description of what behavior is tested]
 *
 * This test verifies [specific cross-layer behavior]. [Explain why this
 * cannot be tested via E2E or unit tests]. This requires [list bridge methods
 * used] for verification, as [explain why backend verification is necessary].
 *
 * See AGENTS.md for integration test approval criteria.
 */

describe('[Feature] Integration', () => {
  // Test implementation
})
```

### Current Approved Integration Tests

See `test/specs/integration/README.md` for:

- Detailed rationale for each approved test
- Bridge method usage guidelines
- Instructions for running integration tests

### Examples

**✅ Justified integration test:**

```typescript
// Persists collections to disk and restores on reload
// Cannot verify file persistence through UI alone
// Requires loadAppData() bridge method for verification
```

**❌ Not justified:**

```typescript
// Tests that UI correctly displays collection name
// Can be tested via E2E - create via UI, inspect DOM for name
// Bridge access not needed
```

## Context7 Documentation

When working with dependencies, libraries, or external APIs:

1. Resolve the relevant Context7 library via `context7__resolve-library-id` before fetching docs
2. Prefer official docs matching the repo's declared dependencies
3. Note version mismatches and adjust usage accordingly
4. Limit Context7 fetches to necessary topic scope to reduce noise

## Troubleshooting

| Issue                          | Solution                                                                       |
|--------------------------------|--------------------------------------------------------------------------------|
| `yarn install` fails (Windows) | Enable Developer Mode; run from path without spaces                            |
| Tauri build stalls             | Check `target/cargo-timings/*.html`; exclude `src-tauri/target` from antivirus |
| Types fail to check            | `yarn typecheck` for details; check for missing `React` imports                |
| Tests fail mysteriously        | Verify `src/test/setup.ts` imported; Tauri API must be mocked                  |
| OAuth browser won't open       | Whitelist `http(s)://localhost` in OAuth provider's redirect URI               |

## References

- Full dev guide: `docs/DEVELOPMENT.md`
- Contribution expectations: `.github/CONTRIBUTING.md`
- Release process: `scripts/update-version.mjs`
- Active workstreams: `docs/plans/`
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`)

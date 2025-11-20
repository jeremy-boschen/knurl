# Repository & Agents Guide (Single Source of Truth)

This file is the complete, canonical instructions for any AI tool/agent working in this repository. If you find
conflicting guidance anywhere else, defer to this file.

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

Mandatory communication output rule: Be extremely concise. Sacrifice grammar for the sake of concision.

## Project Snapshot

Knurl is a cloudless desktop HTTP client built with React 19 + Vite on the frontend and a Rust-powered Tauri 2 backend.
Frontend sources live in `src/`; backend commands, storage, and platform integration under `src-tauri/`. Yarn 4 and Node
20+ are required, alongside Rust 1.88+, MSVC, and WebView2 on Windows.

## Directory Essentials

- `src/components/{feature}` feature UIs; `src/components/ui` Shadcn primitives (generated, do not edit);
  `src/components/ui/knurl` custom wrappers.
- `src/state/` Zustand slices built with Immer; `src/types/` Zod schemas + shared TS types; `src/lib/` utilities.
- `src/bindings/` TypeScript contracts for Rust commands; stay in sync with `src-tauri/src`.
- `public/` static assets; `scripts/` automations; co-locate Vitest specs as `*.test.ts(x)`.

Additional structure context:

- `src-tauri/src/http_client/` Hyper + Rustls HTTP execution.
- `src-tauri/src/app_data/` cloudless storage with AES-GCM encryption.
- `src/test/setup.ts` configures testing, including `mockIPC` for Tauri.

## Setup & Commands

Run `yarn install` once, then `yarn tauri dev` for full-stack development or `yarn dev` for UI-only work. Production
builds use `yarn build` or `yarn tauri build`.

Quality + tests:

- `yarn format`, `yarn lint`, `yarn lint:fix`
- `yarn test`, `yarn test:watch`, `yarn test:e2e`
- `cargo test` (from `src-tauri/`)

Common Tauri entrypoints:

- `yarn tauri dev` (frontend + backend, hot reload)
- `yarn tauri build` (packaged app)

## Coding Standards

Biome enforces formatting and linting; `cargo fmt`/`cargo clippy` keep Rust idiomatic. Use PascalCase for
components/types, camelCase for variables/functions, and UPPER_SNAKE_CASE for constants. Imports should be stable
absolute paths via the `@/` alias; external packages precede local modules. Use Zod for all runtime validation and
ensure Immer-based immutable updates in Zustand slices. Never modify generated Shadcn primitives directly.

### Frontend Guidance

- Use the following libraries unless the user or repo specifies otherwise:
- Framework: React + TypeScript
- Styling: Tailwind CSS
- Components: shadcn/ui
- Icons: lucide-react
- Animation: Framer Motion
- Charts: Recharts
- Fonts: San Serif, Inter, Geist, Mona Sans, IBM Plex Sans, Manrope

### Additional Coding Rules (observed conventions)

- Store APIs are function-returning: access via stable accessors for HMR.
    - Example: `collectionsApi()` returns the API object; do not capture or pass a plain object.
- Lucide icons: always import/use `*Icon` variants (e.g., `PlusIcon`, not `Plus`).
- TypeScript/JavaScript blocks: always use braces for `if/else`, loops, and callbacks where side-effects occur; avoid
  ambiguous single-line bodies.
- React hooks:
    - Use `useCallback`/`useMemo` appropriately and satisfy `useExhaustiveDependencies` (do not suppress; include stable
      deps like setters).
    - Avoid suppression comments unless absolutely necessary and documented.
- Types over `any`:
    - Do not use `any`. Prefer precise types (e.g., `Record<string, FormField>`, `Partial<FormField>`).
    - When normalizing objects, parse through Zod types instead of casting to `any`.
- Testing ergonomics:
    - Do not trigger real Tauri IPC in unit tests. Use provided mocks and guards already present in state
      initialization.
    - Keep APIs stable for tests (e.g., `collectionsApi()` function contract).
- Rust standards:
    - Clippy must pass with `-D warnings`. Address lints like `collapsible_if` by using `let`-chains and combined
      conditions where appropriate.
    - Run `cargo fmt` to maintain formatting.

## Testing Expectations

### Unit Tests (Vitest + React Testing Library)

Setup lives in `src/test/setup.ts` and mocks Tauri IPC via `mockIPC`. Mock all external dependencies—filesystem,
network, Tauri commands. Test business logic, state mutations, component behavior in isolation. Target 70%+ coverage on
frontend lines, 90%+ on deterministic Rust helpers.

Test file naming and co-location:

- For every source file `foo.ts(x)`, all unit tests must live in a single sibling file named `foo.test.ts(x)`.
- Do not split tests across multiple files per target.
- Co-locate tests next to their target source under `src/`.

### E2E Tests (WebDriver.io)

**Golden rule:** Only test user-visible behavior via UI interactions. Do NOT access internal state, filesystem, or Tauri
commands.

Strict E2E discipline:

- **Create state** exclusively through UI actions (clicks, form input, navigation). If you can't create a state via the
  UI, it's not E2E—use unit tests or integration tests.
- **Verify outcomes** only by checking what the UI displays (text, element visibility, form values). Never read
  filesystem, app state, or call Tauri commands.
- **No plumbing.** Do not access `__vite_ssr_modules__`, call `browser.execute()` to inspect state, or invoke Tauri
  commands. If behavior can't be verified via the UI, it belongs in a unit test or integration test.
- Use only the shared UI helpers from `test/support/ui.ts`; extend that library instead of hand-rolling selectors.

**See `test/support/E2E_GUIDELINES.md`** for complete patterns, helper function requirements, error handling, reload strategies, and troubleshooting guidance.

### Integration Tests (WebDriver.io + Backend Access)

**Purpose:** Verify cross-layer behavior that cannot be tested via UI alone. Examples: encryption at rest, file
persistence, backend state synchronization, keyring integration.

**Requirements:**

- **Coordination required.** Do NOT write integration tests without explicit discussion and approval. Poor integration
  test design is a common source of maintenance burden.
- **Clear justification.** Document why this behavior cannot be tested via E2E (UI) or unit tests.
- **Minimal plumbing.** Use `callBridgeReplacement` helpers and filesystem utilities from `test/support/` to access
  backend state. Access state only for **verification**, not setup.
- **Setup via UI.** Create test conditions through UI interactions where possible. Use backend access only to verify
  outcomes that the UI doesn't expose.
- **Location:** Store in `test/specs/integration/` to distinguish from pure E2E tests.

Example use cases:

- Verifying encrypted data is properly stored on disk with expected format/keys
- Testing Tauri backend command behavior with real filesystem
- Validating state persistence across app restarts

Example non-use-cases:

- Creating collections via backend to avoid UI interaction complexity (use E2E + UI helpers instead)
- Checking internal app state that has a UI representation (verify via UI instead)

Rust code uses inline `#[cfg(test)]` modules for units and `src-tauri/tests/` for integration; avoid hitting real
network or OS services.

## Git & PR Practice

Write conventional commits (`feat:`, `fix:`, `chore:`) in imperative tense. Pull requests should state intent, outline
major changes, document tests executed, and link issues. Include screenshots or recordings for UI tweaks and call out
follow-up tasks or risk areas.

## Agent Operating Guide

General practices:

- Treat this file as the sole source of truth for agent behavior.
- Execute only user-specified steps; if extra work seems needed, pause and ask for approval before expanding scope.
- Avoid unrelated refactors; prefer minimal, targeted changes.
- Never edit generated Shadcn primitives under `src/components/ui`.
- Use `@/` absolute imports; group externals before locals.
- Use the shared e2e UI helper (`test/support/ui.ts`) for all automated interactions with app components; extend this
  library instead of hand-rolling selectors.
- Review `docs/feature-inventory.md` before altering behaviour; call out verification steps that preserve listed
  features and update the inventory when functionality changes.

Environment + safety:

- Avoid hitting real networks/OS services in tests; rely on mocks.
- For destructive operations (deletions, resets), get explicit human approval first.

Shell & cross‑platform:

- All development commands run under `bash` on every platform (Windows/macOS/Linux).
- Prefer plain scripts in `package.json` and hooks (no extra `bash -lc`).
- Do not add PowerShell/CMD variants.

### Context7 Documentation

- When working with dependencies, libraries, or external APIs, resolve the relevant Context7 library (
  `context7__resolve-library-id`) before fetching documentation.
- Prefer official docs and versions that match the repository’s declared dependencies; note mismatches and adjust usage
  accordingly.
- Limit Context7 fetches to the necessary topic scope to reduce noise and stay aligned with the active dependency set.

### Agent Planning Protocol

- Always create or update a dated plan file under `docs/plans/` for multi-step work, named
  `docs/plans/YYYY-MM-DD-<task>-plan.md`.
- Include a live task list (checkboxes) and update it as you progress.
- Reflect scope or approach changes immediately in the plan file so work can resume after interruptions.

Conflict resolution: When guidance conflicts, defer to this `AGENTS.md`.

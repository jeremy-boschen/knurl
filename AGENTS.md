# Repository & Agents Guide (Single Source of Truth)

This file is the complete, canonical instructions for any AI tool/agent working in this repository. If you find
conflicting guidance anywhere else, defer to this file.

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

- `src-tauri/src/http_client/` libcurl-powered HTTP execution.
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

Vitest with React Testing Library drives frontend testing; setup lives in `src/test/setup.ts` and mocks Tauri IPC via
`mockIPC`. Target high coverage on request builder flows, state slices, and bindings; keep tests colocated. Rust code
uses inline `#[cfg(test)]` modules for units and `src-tauri/tests/` for integration; avoid hitting real network or OS
services. Coverage goal: 70%+ frontend lines, 90%+ on deterministic Rust helpers.

Test file naming and co-location:

- For every source file `foo.ts(x)`, all unit tests must live in a single sibling file named `foo.test.ts(x)`.
- Do not split tests across multiple files per target. For example, all tests for `src/bindings/knurl.ts` must live in
  `src/bindings/knurl.test.ts` (not `knurl.*.contracts.test.ts`, etc.).
- Co-locate tests next to their target source under `src/`.

## Git & PR Practice

Write conventional commits (`feat:`, `fix:`, `chore:`) in imperative tense. Pull requests should state intent, outline
major changes, document tests executed, and link issues. Include screenshots or recordings for UI tweaks and call out
follow-up tasks or risk areas.

## Agent Operating Guide

General practices:

- Treat this file as the sole source of truth for agent behavior.
- Avoid unrelated refactors; prefer minimal, targeted changes.
- Never edit generated Shadcn primitives under `src/components/ui`.
- Use `@/` absolute imports; group externals before locals.

Environment + safety:

- Avoid hitting real networks/OS services in tests; rely on mocks.
- For destructive operations (deletions, resets), get explicit human approval first.

Shell & cross‑platform:

- All development commands run under `bash` on every platform (Windows/macOS/Linux).
- Prefer plain scripts in `package.json` and hooks (no extra `bash -lc`).
- Do not add PowerShell/CMD variants.

### Knowledge Graph (MCP)

- Use `project_id: "knurl"` for all memory operations.
- Session steps:
    1. Search existing knowledge first.
    2. Create/update entities for components, stores, commands, types, features discovered.
    3. Use tags from code comments to categorize.
    4. Track relationships between components, files, and concepts.
    5. Prefer batch operations when possible.
- Commands
    - Search & Query: `mcp__memory__search_knowledge`, `mcp__memory__read_graph`, `mcp__memory__open_nodes`
    - Entity Management: `mcp__memory__create_entities`, `mcp__memory__add_observations`,
      `mcp__memory__delete_entities`, `mcp__memory__delete_observations`
    - Relationship Management: `mcp__memory__create_relations`, `mcp__memory__delete_relations`
    - Tag Management: `mcp__memory__add_tags`, `mcp__memory__remove_tags`
- Tag system in code comments: `#tag:component`, `#tag:store`, `#tag:api`, `#tag:type`, `#tag:feature`, `#tag:bug`,
  `#tag:todo`, `#tag:security`, `#tag:performance`.
- Entity types: `person`, `technology`, `project`, `company`, `concept`, `event`, `preference`.
- Relationship types (active voice): `uses`, `implements`, `depends_on`, `manages`, `creates`, `extends`, `contains`.

### Sequential Thinking (MCP)

- Call `sequential-thinking__sequentialthinking` when the task has multiple interdependent steps, unclear constraints,
  or benefits from hypothesis verification before implementation.
- Keep thoughts concise but specific; revise earlier thoughts if new information invalidates them.
- Stop the chain once a confident plan or conclusion is reached—avoid unnecessary thoughts on straightforward edits.

### Context7 Documentation (MCP)

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

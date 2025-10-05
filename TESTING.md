# Testing Strategy

This document describes the testing approach for both the React/TypeScript frontend and the Rust (Tauri) backend.

## Goals
- Fast, colocated unit tests with high signal.
- Clear boundary between unit, integration, and end-to-end scopes.
- Excellent coverage of core logic: request builder, HTTP client, app data storage/encryption, parsers, and UI flows.
- Simple developer workflow with watch mode.

## Conventions
- Colocation: place tests next to the files they cover.
  - File naming: `*.test.ts` and `*.test.tsx` for frontend.
  - Rust unit tests go inside the same module/file under `#[cfg(test)]`.
  - Rust integration tests live in `src-tauri/tests/`.
- Prefer focused unit tests for pure logic. Reserve integration tests for boundary behavior.

## Frontend (React + TypeScript + Vite + Vitest)
- Test runner: Vitest.
- Environment: jsdom (configured in `vite.config.ts`).
- Setup file: `src/test/setup.ts` registers `@testing-library/jest-dom` and light browser shims.
- Libraries:
  - @testing-library/react
  - @testing-library/user-event
  - @testing-library/jest-dom
- Include pattern: `src/**/*.test.{ts,tsx}` (only `.test.` files picked up; `__tests__` is discouraged).
- Coverage: v8, text + HTML reports, excludes stories and shadcn UI primitives.

### What to test
- lib utilities (e.g., `src/lib/utils.ts`).
- State logic (Zustand slices) — keep tests at the slice level, mock storage if needed.
- Components — interaction tests via RTL + user-event. Avoid snapshot tests except for stable primitives.
- Bindings — contract tests that validate the TypeScript types match Rust payloads where practical.

### Patterns
- Zustand store in tests
  - Our setup now mocks Tauri window APIs used by middlewares and polyfills BroadcastChannel/crypto, so importing components that use the global store works in unit tests.
  - To reset the store between tests, import `resetApplicationStore` from `src/test/zustand.ts` and call it in your test or in a suite-level `beforeEach/afterEach`.
  - Example:
    ```ts
    import { beforeEach, it, expect } from "vitest"
    import { resetApplicationStore } from "@/test/zustand"
    import { useApplication } from "@/state/application"

    beforeEach(() => resetApplicationStore())

    it("opens a new request tab", async () => {
      const { collectionsApi, requestTabsApi } = useApplication.getState()
      const collection = await collectionsApi.addCollection("My Col")
      await collectionsApi.createRequest(collection.id)
      await requestTabsApi.openRequestTab(collection.id, Object.keys(collection.requests)[0])
      expect(useApplication.getState().requestTabsState.activeTab).toBeTruthy()
    })
    ```
- Each component with significant logic should have a colocated `*.test.tsx` file.
- For complex forms/dialogs, test: rendering, validation, interactions, and side effects.
- Mock Tauri APIs (`@tauri-apps/api` and `@tauri-apps/*` plugins) at module boundary when needed.

### React component testing (RTL)
- Prefer queries by role/name/label/placeholder over test ids. Use `screen.getByRole("button", { name: /save/i })` when possible.
- Use `user-event` for interactions; avoid manual `fireEvent` except for low-level events.
- Handle timers and async UI with `vi.useFakeTimers()` and `await screen.findBy...` or advancing timers.
- Portals: Radix UI portals work in jsdom; assert on content via queries instead of relying on DOM position.
- Draggable/resizable UIs: prefer behavior checks (e.g., content rendered, close button exists). Simulate mouse events sparingly.
- Forms: test validation messages and `onSubmit` side effects. The `Form` helper wires zod and form state.
- Tauri: prefer `@tauri-apps/api/mocks` to intercept IPC in tests.
  - Our setup file (`src/test/setup.ts`) configures:
    - `mockIPC(() => {}, { shouldMockEvents: true })` before each test to intercept `invoke()`.
    - `clearMocks()` after each test to reset Tauri mock state.
    - `window.crypto.getRandomValues` shim via Node `crypto.randomFillSync` for jsdom.
    - A minimal `@tauri-apps/api/window` mock exposing `getCurrentWindow().onCloseRequested` used by `App`.
  - For plugins (e.g., `@tauri-apps/plugin-clipboard-manager`), mock locally in the test (see `copy.test.tsx`).
  - Reference: https://v2.tauri.app/develop/tests/mocking/

Examples in repo:
- `src/components/ui/knurl/input.test.tsx` — password toggle and addons rendering.
- `src/components/ui/knurl/clickable.test.tsx` — keyboard and mouse activation.
- `src/components/ui/knurl/copy.test.tsx` — clipboard via IPC (mockIPC) and timed tooltip.

## Backend (Rust, Tauri)
- Unit tests:
  - Preferred for pure helpers and parsers (e.g., cookie parsing, path formatting, JSON transforms).
  - Add `#[cfg(test)] mod tests { ... }` at the bottom of the module.
- Integration tests:
  - Put files in `src-tauri/tests/`. These compile as a separate crate and can exercise public API.
  - Use for testing Tauri commands exposed via the lib crate API, storage modules, and HTTP client behavior behind feature flags or mocked network as needed.
- Avoid depending on platform keyrings or real network in unit tests. Use small, deterministic inputs.

## Suggested coverage targets
- Frontend: 70% lines initially, grow to 85%+ on core lib/state/components.
- Backend: Emphasize 90%+ coverage on pure helper functions; integration coverage will be lower but target key paths.

## Commands
- Frontend tests: `yarn test` (CI) or `yarn test:watch` during development.
- End-to-end tests: `yarn test:e2e` runs WebDriver-driven UI flows against the packaged app for user-focused coverage.
- Lint/format: `yarn lint`, `yarn lint:fix`, `yarn format`.
- Backend tests: from `src-tauri/`, run `cargo test`.

## Migration from __tests__
- Prefer colocated tests. Rename/move tests from `__tests__` to sit next to target files with `*.test.ts(x)` names.
- knip and biome already recognize `*.test.*` files; no config change is required beyond what is committed here.

## Next phases (not in this commit)
- Add React Testing Library tests for critical components (dialogs, request tab bar, response viewer).
- Add unit tests for storage encryption/decryption transformations with mocked keys.
- Introduce integration tests for Tauri commands via a small harness, guarded by feature flags that stub OS-specific pieces (keyring, dialogs).
- Wire tests into CI (GitHub Actions) to run `yarn test` and `cargo test` on PRs.

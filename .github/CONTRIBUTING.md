# Contributing to Knurl

Thanks for your interest in contributing! This document summarises the expectations for changes in this repository. For
full details, consult [`AGENTS.md`](../AGENTS.md); it is the single source of truth for repository standards.

## Prerequisites

- Node.js 20+, Yarn 4 (`corepack enable` recommended)
- Rust 1.88+, MSVC toolchain (on Windows), WebView2 runtime
- Run `yarn install` once; the workspace uses Plug'n'Play

## Development Workflow

1. **Bootstrap**
   ```bash
   yarn install
   ```
2. **Local development**
   ```bash
   yarn dev          # UI only
   yarn tauri dev    # Full stack (Tauri backend + React frontend)
   ```
3. **Before sending a PR**
   ```bash
   yarn check        # formatting, lint, tests (frontend/backend)
   yarn test         # or targeted suites (yarn test:fe / yarn test:be)
   cargo fmt && cargo clippy -- -D warnings
   ```

## Coding Guidelines

- Follow the conventions described in `AGENTS.md` (imports, hooks, Zustand patterns, etc.).
- Never modify generated shadcn components in `src/components/ui`.
- Prefer the `@/` alias for internal imports.
- TypeScript: avoid `any`, satisfy hook dependency arrays, use Zod for runtime validation.
- Rust: run `cargo fmt` and `cargo clippy -D warnings`; avoid `unwrap()`/`expect()` in production code.

## Commit & Branching

- Use Conventional Commits (e.g. `feat:`, `fix:`, `chore:`) in imperative tense.
- Keep commits focused; do not mix unrelated refactors with feature/bug fixes.
- Branch naming is flexible—choose something descriptive (e.g. `feature/request-polling`).

## Pull Requests

- Fill out the PR template completely (summary, testing evidence, screenshots when UI changes are visible).
- Reference related issues with `Fixes #123` or `Refs #456` when applicable.
- Ensure CI (lint/tests) passes before requesting review.
- Document follow-up work in the PR description if any.

## Release & Versioning

- Use `scripts/update-version.mjs` for version bumps; it updates `package.json`, Tauri config, and Rust manifests,
  commits the change, and tags the release.

## Questions & Support

- Open a GitHub Discussion or Issue for architectural questions.
- For repository-specific conventions not covered here, read `docs/plans/` for context on ongoing workstreams.

We appreciate your contributions—thank you for helping improve Knurl!

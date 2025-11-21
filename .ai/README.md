# .ai/ — Agentic Instruction Files

This folder contains **agent-focused instructions** for Claude Code and other AI tools. These files extend and detail the principles in `CLAUDE2.md` with deep operational guidance.

## Structure

**Core Instructions:**
- `CORE.md` — Master agentic ruleset (extends CLAUDE2.md)
- `COMMANDS.md` — Complete command reference with actual scripts + aliases

**By Domain:**
- `TESTING.md` — Test writing strategy, patterns, when to use which test type
- `E2E.md` — E2E test implementation details, helper patterns, flakiness debugging
- `UNIT_TESTS.md` — Unit test patterns, mocking strategy, test file organization
- `INTEGRATION_TESTS.md` — When/how to write integration tests, approval criteria
- `FEATURES.md` — Feature implementation workflow, common patterns
- `STATE_MANAGEMENT.md` — Collections API deep dive, mutation patterns, persistence
- `RUST_BACKEND.md` — Rust patterns, error handling, Tauri integration
- `CODE_STYLE.md` — TypeScript, Rust, import ordering, naming conventions
- `BLOCKERS.md` — How to handle blockers, common issues, escalation patterns

**Processes:**
- `SCOPE_DISCIPLINE.md` — Non-negotiable scope boundaries, examples of violations
- `TASK_PLANNING.md` — Multi-step work, planning files, checkpoints

## How Agents Use This

1. **Start with CORE.md** — Operating principles, scope rules, boundaries
2. **Reference COMMANDS.md** — Actual commands to run (verified against package.json)
3. **By task type:**
   - Writing E2E tests? Read `E2E.md`
   - Unit test? Read `UNIT_TESTS.md`
   - Adding a feature? Read `FEATURES.md` + `STATE_MANAGEMENT.md`
   - Hit a blocker? Read `BLOCKERS.md`
4. **Verify code style** — Check `CODE_STYLE.md` before writing code

## For Users (Developers)

See the user-facing docs in the main repo:
- `CLAUDE2.md` — Quick reference for developers
- `docs/DEVELOPMENT.md` — Setup and environment
- `test/support/E2E_OVERVIEW.md` — How to write E2E tests (high level)
- `.github/CONTRIBUTING.md` — Contribution guidelines

The `.ai/` folder is **not** for end developers; it's for agent-to-agent communication and detailed operational patterns.

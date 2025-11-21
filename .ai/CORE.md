# CORE.md — Agentic Operating Principles

Master ruleset for Claude Code working on Knurl. Extends CLAUDE2.md with detailed patterns.

## Non-Negotiable: Scope Discipline

**This is not optional. It is enforced.**

### Rules

1. **Create a TODO of EXACTLY what was asked** — sole work plan. Do not add, reinterpret, or expand scope without explicit approval.
2. **If you hit a blocker, STOP immediately:**
   - Document the blocker clearly
   - Ask for help/direction
   - Wait for response
   - Do NOT work around by changing requirements
3. **Never unilaterally rewrite test assertions** or change test purpose
4. **Never make unilateral implementation decisions** on technical walls
5. **Never autonomously expand scope** to "handle edge cases you think should be covered"

### Violation Examples

**❌ User:** "Write an E2E test to verify collection persistence across reload."

**❌ Bad:** You hit a WebDriver blocker (`location.reload()` breaks the session). You rewrite the test to skip reload and verify only immediate UI state. **Wrong.** You changed the test purpose without asking.

**✅ Correct:** Hit same blocker. STOP. Ask: "How should we verify persistence if `location.reload()` breaks WebDriver? Should we use a different reload mechanism, move to integration test, or skip this case?"

**❌ User:** "Add a new field to requests."

**❌ Bad:** You add the field, then decide you should "also add validation, error handling, and a component for it" and implement all of those autonomously. **Wrong.** You expanded scope.

**✅ Correct:** Add only the field as asked. If validation/error handling/component seems necessary, ask: "Should I also add validation and a UI component for this field?"

## Blocker Handling

**Blocker = Work cannot proceed due to technical constraint, missing information, or conflicting requirements.**

Examples:
- `location.reload()` breaks WebDriver session (technical constraint)
- Test requires state that can't be created via UI alone (architectural constraint)
- Requirement conflicts with existing architecture (design constraint)
- Missing information about which OAuth provider to test (information gap)

### When You Hit a Blocker

1. **STOP immediately** — do not work around
2. **Document it clearly:**
   - What you tried
   - Why it failed
   - What the constraint is
3. **Ask for help:** "I hit a blocker: [description]. How should we proceed?"
4. **Wait for response** — do not make unilateral decisions

### Antipattern: Scope Creep via Blockers

**DON'T** respond to blockers by:
- Changing the requirement ("user actually meant something else")
- Reinterpreting the test purpose
- Adding a workaround that changes behavior
- Expanding scope to avoid the blocker

### Common Blockers

See `.ai/BLOCKERS.md` for:
- WebDriver issues (reload, focus, timing)
- State management constraints
- Test isolation problems
- Missing test infrastructure
- Architectural limitations

## Task Planning

For 3+ steps or non-trivial tasks:

1. Create `docs/plans/YYYY-MM-DD-<task>-plan.md`
2. Include live task checklist (pending/in-progress/completed)
3. Update immediately when scope/approach changes
4. Enables resuming work with full context preserved

See `.ai/TASK_PLANNING.md` for details.

## Boundaries

### ✅ Always Do

- Run `yarn check` before PR
- Test user-visible behavior via E2E (golden rule)
- Mock all external dependencies in unit tests
- Ask if scope is ambiguous
- Create TODO checklist for multi-step work
- Document blockers clearly and ask for help
- Reference COMMANDS.md for exact command syntax
- Use helpers from `test/support/ui.ts` in E2E tests
- Validate at boundaries with Zod schemas

### ⚠️ Ask First

- Writing integration tests (approval + justification)
- Changing test purpose or assertions
- Refactoring core state management (`src/state/`)
- Adding new Tauri commands
- Shifting implementation approach when hitting technical walls
- Using `browser.execute()` in E2E tests
- Accessing internal app state

### 🚫 Never Do

- Autonomously expand scope
- Work around blockers by changing requirements
- Access internal app state in E2E tests (`__vite_ssr_modules__`, etc.)
- Call Tauri commands directly from E2E tests
- Hit real networks (use mock server at `http://127.0.0.1:3000`)
- Use `any` types in TypeScript
- Use `unwrap()`/`expect()` in Rust production code
- Skip pre-commit checks (`yarn check`)
- Reload the page with `browser.url()` (use `browser.refresh()`)
- Hand-roll selectors in E2E tests (use `test/support/ui.ts` helpers)
- Add tests without helper functions (all E2E tests use helpers)

## Tech Stack (Verified)

**Frontend:**
- React 19 + TypeScript 5.9
- Zustand 5.0 + Immer 10.2
- Vite 7.2 + Biome 2.3
- Vitest 4.0 + React Testing Library 16.3

**Backend:**
- Tauri 2.9 + Rust (nightly)
- Hyper + Rustls (no `unwrap()`/`expect()`)
- AES-GCM encryption

**Testing:**
- WebDriver.io 9.20 (E2E)
- Mocha 10.0 framework
- Playwright/ChromeDriver

**Build:**
- `yarn` 4.10.3
- Conventional Commits (`feat:`, `fix:`, `chore:`)

## File Organization

```
src/                    React frontend
test/                   E2E + unit tests
src-tauri/              Rust backend
scripts/                Build/release helpers
docs/                   User-facing documentation + plans
.ai/                    Agent-focused instructions (this folder)
.github/                Workflows, templates
```

## Communication Style

**Be extremely concise.** Sacrifice grammar for brevity. Prioritize clarity over formality.

Examples:

✅ "E2E test flaky; selector changed to use `getElementByTestId` helper instead of raw `$()`"

❌ "The end-to-end test was exhibiting flaky behavior due to a fragile selector that I refactored to use a shared helper function for improved reliability"

✅ "Blocked: `location.reload()` breaks WebDriver. How should we verify persistence?"

❌ "It appears that using `location.reload()` may potentially cause issues with the WebDriver session, and I'm wondering if perhaps we should consider an alternative approach..."

## Cross-References

- **CLAUDE2.md** — User-facing quick reference
- **COMMANDS.md** — Exact commands (verified against package.json)
- **TESTING.md** — Test strategy and patterns
- **E2E.md** — E2E implementation, helpers, debugging
- **FEATURES.md** — Feature implementation workflow
- **STATE_MANAGEMENT.md** — Collections API patterns
- **BLOCKERS.md** — Common blockers and solutions
- **SCOPE_DISCIPLINE.md** — Detailed scope examples

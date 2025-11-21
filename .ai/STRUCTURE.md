# STRUCTURE.md — Organization & File Map

Reference guide for the reorganized agentic instructions. Shows where information is housed and how files relate.

## Folder Structure

```
Root/
├── .ai/                           AGENT-FOCUSED INSTRUCTIONS (this folder)
│   ├── README.md                  Entry point + navigation
│   ├── CORE.md                    Master operating principles
│   ├── COMMANDS.md                Complete command reference
│   ├── TESTING.md                 Test type decision tree
│   ├── E2E.md                     E2E implementation patterns
│   ├── UNIT_TESTS.md              Unit test patterns (placeholder)
│   ├── INTEGRATION_TESTS.md        Integration test approval (placeholder)
│   ├── FEATURES.md                Feature implementation workflow (placeholder)
│   ├── STATE_MANAGEMENT.md        Collections API deep dive (placeholder)
│   ├── RUST_BACKEND.md            Rust patterns (placeholder)
│   ├── CODE_STYLE.md              TypeScript/Rust style (placeholder)
│   ├── BLOCKERS.md                Common blockers & solutions (placeholder)
│   ├── SCOPE_DISCIPLINE.md        Scope boundary examples (placeholder)
│   └── STRUCTURE.md               This file
│
├── CLAUDE2.md                     USER-FACING QUICK REFERENCE (ROOT LEVEL)
│                                  For developers (non-agent)
│
├── docs/                          USER-FACING DOCUMENTATION
│   ├── DEVELOPMENT.md             Setup guide, environment
│   ├── plans/                     Workstream planning files
│   └── ...                        Other docs (feature specs, reports, etc.)
│
├── test/
│   ├── support/
│   │   ├── E2E_OVERVIEW.md        USER-FACING E2E patterns (junior devs)
│   │   └── E2E_GUIDELINES.md      Detailed E2E patterns (from original)
│   ├── specs/
│   │   ├── *.e2e.ts               E2E tests
│   │   └── integration/           Approved integration tests
│   ├── data-test-ids.md           Valid test IDs reference
│   └── ...
│
├── .github/                       CI/CD, templates
│   └── CONTRIBUTING.md            Contribution guidelines
│
├── package.json                   npm/yarn scripts (canonical)
├── scripts/                       Build helpers (verified in COMMANDS.md)
└── ... (src/, src-tauri/, etc.)
```

## When to Use Which File

### For Agents (Working on Code)

1. **Start:** `.ai/README.md` — Navigation
2. **Operating principles:** `.ai/CORE.md` — Non-negotiable rules
3. **Commands:** `.ai/COMMANDS.md` — Exact commands verified against package.json
4. **By task:**
   - **Writing tests:** `.ai/TESTING.md` (decision tree) → `.ai/E2E.md` or `test/support/E2E_OVERVIEW.md`
   - **Implementing feature:** `.ai/FEATURES.md` (if written) + `.ai/STATE_MANAGEMENT.md`
   - **Hit a blocker:** `.ai/BLOCKERS.md` or `.ai/CORE.md` (blocker section)
   - **Code style:** `.ai/CODE_STYLE.md` before writing code
5. **Reference docs:**
   - E2E helpers: `test/support/ui.ts` (actual code)
   - Valid test IDs: `test/data-test-ids.md`
   - Integration tests: `test/specs/integration/README.md`

### For Humans (Reading Documentation)

1. **Quick start:** `CLAUDE2.md` — 2-minute overview
2. **Development setup:** `docs/DEVELOPMENT.md` — Environment + commands
3. **E2E testing guide:** `test/support/E2E_OVERVIEW.md` — How to write E2E tests
4. **Detailed patterns:** `test/support/E2E_GUIDELINES.md` — Deep dive into patterns
5. **Contributing:** `.github/CONTRIBUTING.md` — Contribution expectations

## Information Mapping

### Commands

| Command | Location | Reason |
|---|---|---|
| `yarn dev` | `.ai/COMMANDS.md` (agent) | Agents need exact syntax + when to use |
| `yarn test:e2e` | `.ai/COMMANDS.md` (agent) + `CLAUDE2.md` (user) | Both audiences |
| `yarn check` | `.ai/COMMANDS.md` + `CLAUDE2.md` | Both audiences |

### Testing

| Topic | Agent File | User File |
|---|---|---|
| Test type decision | `.ai/TESTING.md` | `test/support/E2E_OVERVIEW.md` |
| E2E patterns | `.ai/E2E.md` | `test/support/E2E_GUIDELINES.md` |
| Helper functions | `.ai/E2E.md` (reference) | `test/support/ui.ts` (actual code) |
| Valid test IDs | N/A | `test/data-test-ids.md` |
| Integration tests | `.ai/INTEGRATION_TESTS.md` (approval) | `test/specs/integration/README.md` |

### Features & Implementation

| Topic | Location | Audience |
|---|---|---|
| State management deep dive | `.ai/STATE_MANAGEMENT.md` (TBD) | Agents |
| Collections API reference | `.ai/STATE_MANAGEMENT.md` (TBD) | Agents |
| Feature implementation workflow | `.ai/FEATURES.md` (TBD) | Agents |
| Code style (TypeScript/Rust) | `.ai/CODE_STYLE.md` (TBD) | Agents |

### Scope & Discipline

| Topic | Location | Audience |
|---|---|---|
| Core operating principles | `.ai/CORE.md` | Agents |
| Detailed scope examples | `.ai/SCOPE_DISCIPLINE.md` (TBD) | Agents |
| Blocker handling | `.ai/BLOCKERS.md` (TBD) | Agents |
| Common blockers & solutions | `.ai/BLOCKERS.md` (TBD) | Agents |

## Cross-References (Hyperlink Map)

### From .ai/README.md

→ Core instructions: `.ai/CORE.md`
→ Commands: `.ai/COMMANDS.md`
→ Testing guide: `.ai/TESTING.md`
→ For users: `CLAUDE2.md`

### From .ai/CORE.md

→ Commands: `.ai/COMMANDS.md`
→ Testing: `.ai/TESTING.md`
→ E2E patterns: `.ai/E2E.md`
→ Blockers: `.ai/BLOCKERS.md` (link in "Common Blockers" section)
→ Scope examples: `.ai/SCOPE_DISCIPLINE.md`
→ Task planning: `.ai/TASK_PLANNING.md`

### From .ai/E2E.md

→ E2E overview (for users): `test/support/E2E_OVERVIEW.md`
→ Detailed guidelines: `test/support/E2E_GUIDELINES.md`
→ Valid test IDs: `test/data-test-ids.md`
→ When to use E2E: `.ai/TESTING.md`
→ Helper code: `test/support/ui.ts`

### From CLAUDE2.md (User-Facing)

→ Dev setup: `docs/DEVELOPMENT.md`
→ E2E patterns: `test/support/E2E_GUIDELINES.md`
→ Agent guide: `.ai/CORE.md`
→ Integration tests: `test/specs/integration/README.md`
→ Contributing: `.github/CONTRIBUTING.md`

## File Maintenance

### Update .ai/ When:

- Adding a new command (update `COMMANDS.md`)
- Changing scope rules (update `CORE.md` or `SCOPE_DISCIPLINE.md`)
- Adding common blocker (update `BLOCKERS.md`)
- Changing E2E patterns (update `E2E.md`)
- Adding feature implementation pattern (update `FEATURES.md`)

### Update User Docs When:

- Changing developer-facing information (update `docs/DEVELOPMENT.md`)
- Changing E2E guidelines for developers (update `test/support/E2E_GUIDELINES.md`)
- Changing contribution expectations (update `.github/CONTRIBUTING.md`)
- Changing quick reference (update `CLAUDE2.md`)

### Keep in Sync:

- `package.json` scripts ↔ `COMMANDS.md` (verify commands still exist)
- `.ai/TESTING.md` ↔ `test/support/E2E_OVERVIEW.md` (same principles, different audiences)
- `CLAUDE2.md` ↔ `.ai/CORE.md` (same principles, different detail levels)

## Placeholder Files (TBD)

These files are referenced but not yet created. Flesh them out as needed:

```
.ai/UNIT_TESTS.md           → Unit test patterns (Vitest + RTL)
.ai/INTEGRATION_TESTS.md    → Integration test approval & patterns
.ai/FEATURES.md             → Feature implementation workflow
.ai/STATE_MANAGEMENT.md     → Collections API deep dive
.ai/RUST_BACKEND.md         → Rust error handling, Tauri patterns
.ai/CODE_STYLE.md           → TypeScript/Rust style guides
.ai/BLOCKERS.md             → Common blockers & solutions
.ai/SCOPE_DISCIPLINE.md     → Detailed scope examples
.ai/TASK_PLANNING.md        → Planning files, checkpoints, templates
```

## Navigation Tips

### "I'm an agent. Where do I find...?"

- **How to run tests?** → `.ai/COMMANDS.md`
- **When to write E2E vs unit?** → `.ai/TESTING.md`
- **How to write E2E tests?** → `.ai/E2E.md`
- **How to implement a feature?** → `.ai/FEATURES.md` (or FEATURES section in `CLAUDE2.md`)
- **How the state works?** → `.ai/STATE_MANAGEMENT.md` or `CLAUDE2.md`
- **I hit a blocker!** → `.ai/BLOCKERS.md` or "Blocker Handling" in `CORE.md`
- **Scope question?** → `CORE.md` "Non-Negotiable" or `.ai/SCOPE_DISCIPLINE.md`
- **Code style question?** → `.ai/CODE_STYLE.md`

### "I'm a developer. Where do I find...?"

- **Getting started?** → `CLAUDE2.md` then `docs/DEVELOPMENT.md`
- **How to write E2E tests?** → `test/support/E2E_OVERVIEW.md` (then `.E2E_GUIDELINES.md` for details)
- **Valid test IDs?** → `test/data-test-ids.md`
- **How to add a feature?** → `CLAUDE2.md` "Common Tasks" section
- **State management reference?** → `CLAUDE2.md` "State Management" section
- **Contributing rules?** → `.github/CONTRIBUTING.md`

## Summary

- **Agent instructions (.ai/):** Deep, detailed, operational
- **User docs (docs/, test/support/):** Clear, concise, example-focused
- **Quick reference (CLAUDE2.md):** Balance for both audiences
- **Code (src/, test/, scripts/):** Source of truth for what actually works

Agents reference `.ai/` for detailed guidance. Users reference `docs/` and `CLAUDE2.md` for what they need to know.

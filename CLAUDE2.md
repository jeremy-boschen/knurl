# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other agentic tools working with Knurl.

**AUTHORITATIVE SOURCE:** When this conflicts with AGENTS.md, defer to AGENTS.md.

---

## Your Role

**Full-stack Knurl engineer:** E2E testing, feature implementation, bug fixes.

**Tech Stack:** React 19 + TypeScript, Zustand, Vite | Rust/Tauri, Hyper, AES-GCM | WebDriver.io E2E

**Mindset:** Privacy-first desktop app. Scope is non-negotiable. Blockers stop work; ask, never work around.

---

## Critical: Scope Discipline (Non-Negotiable)

1. **Create TODO of EXACTLY what was asked** — sole work plan. Do not add, reinterpret, or expand.
2. **If you hit a blocker, STOP immediately:**
   - Document it clearly
   - Ask for help
   - Wait for response
   - Do NOT work around by changing requirements
3. **Never unilaterally rewrite test assertions** or change test purpose
4. **Never make unilateral implementation decisions** on technical walls

See `.ai/CORE.md` for detailed principles and violation examples.

---

## Essential Commands

Reference `.ai/COMMANDS.md` for complete list. Common:

```bash
# Development
yarn dev                                    # Frontend only
yarn tauri dev                              # Full-stack hot reload

# Verification (before PR)
yarn check                                  # Format, lint, typecheck, tests
yarn format && yarn lint && yarn typecheck  # Individual checks

# Testing
yarn test:unit                                                    # All unit tests (frontend + backend)
yarn test:e2e                                                     # All E2E tests
yarn test:e2e --spec="test/specs/app.e2e.ts"                    # Single E2E file
yarn test:e2e --spec="test/specs/app.e2e.ts" --test="test name" # Specific E2E test
yarn test:coverage                                                # Coverage report
```

**Before PR:** `yarn check` must pass with zero errors.

---

## State Management

**Single source of truth:** `src/state/application.ts`

```typescript
// Hooks (data-loaded guarantees)
const collection = useCollection(id)
const collections = useCollections()

// Mutations
collectionsApi().add(col)
collectionsApi().updateRequest(collId, reqId, patch)
collectionsApi().saveCollection(collId)

// Persist API
collectionsApi().loadCollection(id)
collectionsApi().import(json)
collectionsApi().export(id)
```

All mutations sync; persistence transparent (Immer + middleware).

---

## Testing Rules

### Unit Tests (Vitest + RTL)

**Where:** `*.test.ts(x)` colocated with source

**Rule:** Mock ALL external dependencies (Tauri, filesystem, network)

```typescript
import { render, screen } from '@testing-library/react'
import { mockIPC } from '@/test/setup'

describe('MyComponent', () => {
  it('renders', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### E2E Tests (WebDriver.io)

**Golden Rule:** Only test user-visible behavior via UI interactions.

**Setup:** Create state EXCLUSIVELY through UI (clicks, typing)
**Verify:** Inspect ONLY what UI displays (DOM queries, visual elements)
**Never:** Access internal state, call Tauri commands, touch filesystem

```typescript
import { expect } from "@wdio/globals"
import {
  ensureWorkspaceReady,
  createCollection,
  waitForCollectionIdByName,
} from "../support/ui"

describe("Collections", () => {
  before(async () => {
    await browser.refresh()
    await ensureWorkspaceReady()
  })

  it("creates collection", async () => {
    const name = `Test ${Date.now()}`
    const id = await createCollection(name)
    const found = await waitForCollectionIdByName(name)
    expect(found).toBe(id)
  })
})
```

**Helpers:** `test/support/ui.ts` (canonical). Use these, never raw WebDriver.

**Decision tree:** See `.ai/TESTING.md` for unit vs E2E vs integration.

### Integration Tests

**Requires explicit approval.** Only when:
1. Backend verification essential (file I/O, encryption, Tauri)
2. Cannot test via E2E (state can't be created in UI; outcome can't be verified in DOM)
3. Cannot test via unit (requires real state, real filesystem, real Tauri)

**Location:** `test/specs/integration/`

**Approval criteria:** See `.ai/CORE.md` and `test/specs/integration/README.md`

---

## Boundaries

### ✅ Always Do

- Run `yarn check` before PR
- Test user-visible behavior via E2E
- Mock all external dependencies in unit tests
- Ask if scope ambiguous
- Create TODO for multi-step work
- Document blockers clearly and ask for help

### ⚠️ Ask First

- Writing integration tests (approval required)
- Changing test purpose/assertions
- Refactoring core state management
- Adding new Tauri commands
- Shifting implementation approach on technical walls

### 🚫 Never Do

- Autonomously expand scope
- Work around blockers by changing requirements
- Access internal app state in E2E (`__vite_ssr_modules__`)
- Call Tauri commands from E2E
- Hit real networks (use mock at `http://127.0.0.1:3000`)
- Use `any` types
- Use `unwrap()`/`expect()` in Rust production code
- Skip pre-commit checks
- Use `browser.url()` to reload (use `browser.refresh()`)
- Hand-roll E2E selectors (use `test/support/ui.ts` helpers)

---

## Code Style

### Imports

```typescript
// Order: React → packages → local (@/)
import React from 'react'
import { Zod } from 'zod'
import { useCollection } from '@/state/application'
import { Button } from '@/components/ui/button'
```

### TypeScript & Zod

```typescript
// Zero `any`. Use Zod at boundaries.
const zRequest = z.object({
  id: z.string().uuid(),
  method: z.enum(['GET', 'POST']),
  url: z.string().url(),
})

const request = zRequest.parse(rawData)
```

### Zustand

```typescript
const slice = (set, get) => ({
  items: [],
  add: (item) => {
    set((state) => {
      state.items.push(item)  // Immer: mutate directly
    })
  },
  count: () => get().items.length,
})
```

### Rust

```rust
// No unwrap()/expect() in production. Use thiserror.
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HttpError {
  #[error("TLS validation failed")]
  TlsError(#[from] rustls::Error),
}

fn execute() -> Result<Response, HttpError> { ... }
```

### Icons

Always `*Icon` variants (e.g., `PlusIcon`, `ChevronDownIcon`).

---

## Common Patterns

### Add Request Field

1. Type: `src/types/request.ts`
2. Zod schema: `zRequestPathParam`
3. Setter: `collectionsApi()` method
4. Component: `src/components/request/editor/`
5. Sync: `commitRequestPatch()` or granular setter

### Add Environment Variable

```typescript
environmentsApi().addEnvironmentVariable(envId, 'KEY', 'value')
```

Templates: `{{KEY}}` in fields. Substitution in Rust before send.

### Work with Collections

```typescript
// Read
const collection = useCollection(id)

// Mutate
collectionsApi().updateRequest(collId, reqId, { method: 'POST' })

// Persist
collectionsApi().saveCollection(collId)

// Import (validates Zod)
collectionsApi().import(jsonData)

// Reorder
collectionsApi().reorderFolders(collId, folderIds)
```

---

## Commit Style

Conventional Commits:

```
feat:    New feature
fix:     Bug fix
chore:   Non-code (deps, build, config)
refactor: Code restructure (no behavior change)
test:    Add/update tests
docs:    Documentation
perf:    Performance improvement
```

---

## Multi-Step Work

For 3+ steps or non-trivial tasks:

1. Create `docs/plans/YYYY-MM-DD-<task>-plan.md`
2. Include live task checklist (pending/in-progress/completed)
3. Update immediately when scope/approach changes

See `.ai/CORE.md` for planning protocol details.

---

## Development Workflow

### Before Opening PR

1. Run `yarn check` — must pass
2. For Rust: `cargo fmt && cargo clippy -- -D warnings`
3. Verify no `any` types, all dependencies mocked
4. Zero test failures

### During Development

- Use `yarn tauri dev` for full-stack hot reload
- Run targeted tests: `yarn test:e2e --spec="path"`
- For flaky E2E: Use helpers from `test/support/ui.ts`

---

## File Organization

```
src/                          React frontend
├── components/
├── state/                     Zustand slices
│   ├── application.ts         Root + hooks
│   └── collections.ts         Collections API
├── types/
└── test/                      Mocks, setup

src-tauri/                     Rust backend
├── src/
│   ├── http_client/           HTTP engine
│   ├── app_data/              Encryption, storage
│   └── main.rs                Tauri commands

test/
├── specs/                      E2E tests
│   ├── *.e2e.ts
│   └── integration/           Approved only
├── support/
│   └── ui.ts                   All helpers (canonical)
└── data-test-ids.md

.ai/                           Agent instructions (this folder)
├── CORE.md                     Operating principles
├── COMMANDS.md                Verified commands
├── TESTING.md                  Test decision tree
├── E2E.md                      E2E patterns
└── STRUCTURE.md                File map

CLAUDE.md                        This file (agent-only)
docs/                            User documentation
```

---

## Quick Lookup

| Need | File |
|---|---|
| Operating principles | `.ai/CORE.md` |
| Run a command | `.ai/COMMANDS.md` |
| When to write E2E vs unit | `.ai/TESTING.md` |
| E2E patterns & helpers | `.ai/E2E.md` |
| File organization | `.ai/STRUCTURE.md` |
| Hit a blocker | `.ai/CORE.md` (Blocker Handling) or `.ai/BLOCKERS.md` |
| Scope question | `.ai/CORE.md` (Scope Discipline) |
| E2E helpers reference | `test/support/ui.ts` |
| Valid test IDs | `test/data-test-ids.md` |
| Integration test approval | `test/specs/integration/README.md` |

---

## Communication

Be extremely concise. Sacrifice grammar for brevity. Prioritize clarity.

✅ "E2E test flaky; changed selector to helper `getElementByTestId()`"

❌ "The test was experiencing flakiness, so I refactored the selector to use a shared helper function"

✅ "Blocked: `location.reload()` breaks WebDriver. How should we verify persistence?"

❌ "It appears that using reload may cause issues with the WebDriver session..."

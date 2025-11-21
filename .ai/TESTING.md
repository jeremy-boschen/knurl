# TESTING.md — Test Strategy & Type Selection

When to use unit, E2E, or integration tests. Decision tree for test-driven development.

## Test Type Decision Tree

### Start Here: What Are You Testing?

**Q1: Testing a React component in isolation?**
- YES → **Unit Test** (Vitest + React Testing Library)
- NO → Continue to Q2

**Q2: Testing user-visible behavior via UI interactions?**
- YES → **E2E Test** (WebDriver.io)
- NO → Continue to Q3

**Q3: Testing backend behavior (file I/O, encryption, Tauri)?**
- YES → **Integration Test** (requires approval)
- NO → **Unit Test** (mock dependencies)

---

## Unit Tests (Vitest + React Testing Library)

### When to Use

- Testing React components in isolation
- Testing business logic (hooks, utils, state slices)
- Testing error handling and edge cases
- Testing without external dependencies (Tauri, filesystem, network)

### Where to Put Them

```
src/
├── components/
│   ├── MyComponent.tsx
│   └── MyComponent.test.tsx         ← Colocated
├── hooks/
│   ├── useMyHook.ts
│   └── useMyHook.test.ts            ← Colocated
├── lib/
│   ├── utils.ts
│   └── utils.test.ts                ← Colocated
└── state/
    ├── collections.ts
    └── collections.test.ts          ← Colocated
```

### Implementation Pattern

```typescript
import { render, screen } from '@testing-library/react'
import { mockIPC } from '@/test/setup'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders with props', () => {
    render(<MyComponent title="Hello" />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('calls handler on click', async () => {
    const handler = vi.fn()
    render(<MyComponent onClick={handler} />)

    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalled()
  })
})
```

### Rules

1. **Mock ALL external dependencies:**
   - Tauri IPC (use `mockIPC` from `src/test/setup.ts`)
   - Filesystem access
   - Network calls
   - Zustand stores (when testing outside context)

2. **Focus on:**
   - Component rendering
   - User interactions
   - State changes
   - Error states

3. **Don't:**
   - Render full app (use `<AppProvider>` for integration)
   - Test routing (unit test is wrong place)
   - Make real HTTP calls

### Run Tests

```bash
# All unit tests (frontend + backend)
yarn test:unit

# Individual test file (unit tests)
yarn test:unit src/components/MyComponent.test.tsx
```

---

## E2E Tests (WebDriver.io)

### When to Use

- Testing complete user workflows (create collection → rename → verify)
- Testing UI behavior that requires real app state
- Testing that features work end-to-end in the actual app
- Verifying what users see and interact with

### Where to Put Them

```
test/specs/
├── feature-name.e2e.ts             ← One file per major feature
├── auth.e2e.ts
├── requests.e2e.ts
└── integration/                    ← Only approved tests
    ├── workspace-restore.e2e.ts
    └── collection-encryption.e2e.ts
```

### Implementation Pattern

```typescript
import { expect } from "@wdio/globals"
import {
  ensureWorkspaceReady,
  createCollection,
  clickByTestId,
  waitForCollectionIdByName,
} from "../support/ui"

describe("Collections Management", () => {
  before(async () => {
    await browser.refresh()
    await ensureWorkspaceReady()
  })

  it("creates and displays collection", async () => {
    const name = `Test ${Date.now()}`
    const collectionId = await createCollection(name)

    const found = await waitForCollectionIdByName(name)
    expect(found).toBe(collectionId)
  })
})
```

### Rules (Golden Rule)

1. **Only test user-visible behavior**
2. **Create state via UI only** (clicks, typing)
3. **Verify via DOM queries only** (what the UI displays)
4. **Never:**
   - Access internal state (`__vite_ssr_modules__`)
   - Call Tauri commands directly
   - Access filesystem
   - Use `browser.execute()` to inspect state

### Run Targeted

```bash
yarn test:e2e --spec="test/specs/requests.e2e.ts"
yarn test:e2e --spec="test/specs/requests.e2e.ts" --test="creates request"
```

---

## Integration Tests (WebDriver.io + Backend Access)

### When to Use

**ALL THREE must be true:**

1. **Backend verification is essential**
   - Behavior depends on file I/O, encryption, Tauri commands
   - Implementation details NOT exposed in UI
   - Cannot verify via DOM inspection

2. **Cannot test via E2E alone**
   - State cannot be created via UI interactions
   - Outcome cannot be verified by inspecting DOM
   - Need bridge method access for verification

3. **Cannot test via unit test**
   - Requires real app state (not mocked)
   - Requires actual file system access
   - Requires Tauri backend integration

### Examples

**✅ Justified:**
```typescript
// Persists collections to disk and restores on reload
// Cannot verify file persistence through UI alone
// Requires loadAppData() bridge for verification
```

**❌ Not justified:**
```typescript
// Tests that UI correctly displays collection name
// Can test via E2E - create via UI, inspect DOM for name
// Bridge access not needed
```

### Requirements

- **Approval required** — Must justify all three criteria
- **Clear documentation** — Explain why E2E/unit insufficient
- **Minimal bridge usage** — Only call bridge for verification, not setup

### Location

```
test/specs/integration/
├── README.md                        ← List all approved tests + rationale
├── workspace-restore.e2e.ts
├── collection-encryption.e2e.ts
└── tauri-integration.e2e.ts
```

### Implementation Pattern

```typescript
/**
 * Integration Test: Persists collections to disk and restores on reload
 *
 * This test verifies that collections are correctly encrypted and persisted
 * to the filesystem, and can be restored on app reload. Cannot be tested via
 * E2E because file persistence cannot be verified through the UI.
 *
 * Bridge methods used: loadAppData()
 * Why backend verification necessary: Must verify encrypted files exist on disk
 *
 * See CORE.md for integration test approval criteria.
 */
describe('Collection Encryption & Persistence', () => {
  // Implementation with bridge access
})
```

### Rules

1. **Setup via UI where possible** — Only use bridge for verification
2. **Document bridge methods used** — List all called methods
3. **No direct Tauri access** — Use bridge methods only
4. **Minimal scope** — Test only what cannot be tested via E2E/unit

---

## Rust Tests

### Unit Tests (Inline)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_request() {
        let json = r#"{"method":"GET","url":"http://example.com"}"#;
        let req = parse_request(json).unwrap();
        assert_eq!(req.method, "GET");
    }
}
```

**Location:** Inline in `src/` files

**Rules:**
- No real network calls
- No real file I/O (mock filesystem)
- Test error cases

### Integration Tests

```rust
// src-tauri/tests/integration_test.rs
#[test]
fn encrypts_and_decrypts() {
    let plaintext = "secret";
    let encrypted = encrypt(plaintext).unwrap();
    let decrypted = decrypt(&encrypted).unwrap();
    assert_eq!(plaintext, decrypted);
}
```

**Location:** `src-tauri/tests/`

**Rules:**
- Can use real crypto (encryption test)
- No network calls
- No real user authentication

---

## Test Coverage Requirements

### Frontend (React)

- Components: 80%+ line coverage
- Hooks: 90%+ (critical logic)
- State management: 100% (critical for app correctness)
- Utils: 85%+

### Backend (Rust)

- HTTP engine: 80%+
- Auth handlers: 90%+
- Encryption: 100%
- Error handling: 85%+

### Coverage Commands

```bash
# Check current coverage
VITEST_COVERAGE=true yarn test:fe

# Generate HTML report
yarn test:coverage
```

---

## Anti-Patterns

### ❌ Unit Testing the Whole App

```typescript
// WRONG - unit test can't replace E2E
it("user can create collection and see it in sidebar", () => {
  render(<App />)  // Too much to unit test
})
```

→ Use E2E test instead

### ❌ E2E Testing Implementation Details

```typescript
// WRONG - violates golden rule
it("uses useCollection hook internally", async () => {
  const state = await browser.execute(() => {
    return window.__vite_ssr_modules__.useCollection
  })
})
```

→ Test user-visible behavior only, not implementation

### ❌ Integration Test Without Justification

```typescript
// WRONG - can be tested via E2E
describe('Display collection name', () => {
  it('shows name in UI', async () => {
    // Uses bridge methods unnecessarily
  })
})
```

→ This should be E2E, not integration

### ❌ Mocking Everything in Integration Test

```typescript
// WRONG - defeats purpose of integration test
it('saves collection', async () => {
  mockFileSystem()  // Should NOT mock in integration test
  mockEncryption()
})
```

→ Integration tests should test real behavior

---

## Quick Reference

| Scenario | Test Type | Why |
|---|---|---|
| Component renders correctly | Unit | Fast, isolated |
| User can create collection | E2E | Tests real workflow |
| Collection persists to disk | Integration | Needs file verification |
| Hook returns correct value | Unit | No external deps |
| Button click triggers action | E2E | User-visible behavior |
| Request parsed correctly | Unit | Logic test |
| Auth token encrypted properly | Integration | Crypto verification |
| User can rename request | E2E | Complete UX test |
| Sorting algorithm works | Unit | No UI involved |
| Collections survive app reload | Integration | File + UI verification |

---

## Cross-References

- **E2E.md** — Detailed E2E patterns and helpers
- **UNIT_TESTS.md** — Unit test patterns and examples
- **INTEGRATION_TESTS.md** — Integration test approval & examples
- **COMMANDS.md** — How to run tests
- **test/support/E2E_OVERVIEW.md** — User-facing E2E guide

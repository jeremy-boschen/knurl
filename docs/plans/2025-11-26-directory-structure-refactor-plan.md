# Directory Structure Refactor Plan
**Date:** 2025-11-26
**Objective:** Reorganize project into three vertical streams (`src-common/`, `src-tauri/`, `src-ui/`) for clarity on concerns (shared, backend, frontend).

---

## Target Structure

```
/src-common/              (shared: E2E tests & utilities)
  /e2e/
    /specs/               (current test/specs/)
    /support/             (current test/support/)

/src-tauri/               (unchanged - Rust backend)
  /src/
  /tests/

/src-ui/                  (frontend vertical)
  /src/                   (current src/ - source + colocated unit tests)
  /test/                  (frontend test infrastructure)
    setup.ts
    mocks.ts
    (other frontend-specific test utils)

/scripts/
  /build/                 (vite, tauri build commands)
  /dev/                   (dev server, hot reload)
  /release/               (versioning, distribution)
  /test/                  (test-related scripts)
  (other misc scripts at root level for now)

/docs/                    (unchanged - user & dev docs)
```

---

## Execution Steps

### Phase 1: Directory Moves (git mv to preserve history)

- [ ] `git mv src src-ui/src`
- [ ] `git mv src/test src-ui/test`
- [ ] `git mv test/specs src-common/e2e/specs`
- [ ] `git mv test/support src-common/e2e/support`
- [ ] Create `/scripts/build/`, `/scripts/dev/`, `/scripts/release/`, `/scripts/test/` directories
- [ ] Move scripts into appropriate subdirs (TBD which scripts go where)

### Phase 2: Config File Updates

#### TypeScript
- [ ] `tsconfig.json`: Update `@/` path mapping from `"./src/*"` → `"./src-ui/src/*"`
- [ ] `tsconfig.json`: Update any `include/exclude` paths

#### Vite & Build
- [ ] `vite.config.ts`: Update alias resolver `src/` → `src-ui/src/`
- [ ] `vitest.config.ts`: Update alias resolver paths
- [ ] `src-tauri/tauri.conf.json`: Update `frontendDist` path (if it references `src/`)

#### Package & Scripts
- [ ] `package.json`: Update any script commands that hardcode paths (e.g., `vitest`, `vite build`)
- [ ] `wdio.conf.ts`: Update path to E2E test specs (likely `specs: ['src-common/e2e/specs/**/*.e2e.ts']`)

#### CI/CD
- [ ] `.github/workflows/*.yml`: Update any path references in build/test steps

#### Linting & Formatting
- [ ] Biome config (if has path rules): Update paths
- [ ] ESLint config (if has path rules): Update paths

### Phase 3: Import Path Updates

- [ ] **E2E tests** (`src-common/e2e/specs/`): Update imports of support utilities
  - Change `import from '../../test/support/...'` → `import from '../support/...'`
- [ ] **Scripts**: Update any script files that reference or load from `src/`, `test/`, etc.
- [ ] **Build configs**: Verify any hardcoded path references are updated

### Phase 4: Verification

- [ ] Run `yarn typecheck` — validates TypeScript path mappings
- [ ] Run `yarn lint` — catch any path issues in configs
- [ ] Run `yarn test:unit` — unit tests still work
- [ ] Run `yarn test:e2e --spec="src-common/e2e/specs/<test>.e2e.ts"` — E2E tests still locate & run
- [ ] Run `yarn dev` — Vite dev server loads correctly
- [ ] Run `yarn tauri dev` — full-stack dev works

### Phase 5: Git Cleanup & Commit

- [ ] Verify all moves are tracked as renames (not delete + add)
- [ ] Create single atomic commit: `refactor: restructure directories into src-common, src-tauri, src-ui verticals`

---

## Risk Areas

1. **Path mappings in configs**: If any are missed, `yarn typecheck` or `yarn dev` will fail immediately.
2. **Relative imports in E2E tests**: May have mixed import styles; verify all resolve correctly.
3. **Build script references**: Scripts that copy or reference paths need updates.
4. **CI/CD workflows**: May reference hardcoded paths in test/build steps.

---

## Rollback Plan

If anything breaks:
1. `git reset --hard HEAD~1` (undo the commit)
2. Restore to previous structure

All moves use `git mv`, so no history is lost.

---

## Notes

- Unit tests stay **colocated** in `/src-ui/src/` (no change to testing experience).
- Frontend test infrastructure (`setup.ts`, mocks) lives in `/src-ui/test/` (keeps frontend self-contained).
- Shared E2E infrastructure is in `/src-common/e2e/`, separate from backend concerns.
- Scripts organized by purpose for long-term clarity, even if some dirs are sparse initially.

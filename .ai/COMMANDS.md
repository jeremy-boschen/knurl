# COMMANDS.md — Complete Command Reference

All commands verified against `package.json` and `scripts/` directory. Use these exact commands.

## Development

### Start Servers

```bash
# Frontend only (Vite dev server, fast reload)
yarn dev

# Full-stack (Tauri + React hot reload, slower but realistic)
yarn tauri dev
```

**When to use:**
- `yarn dev` — Prototyping UI, quick feedback loops
- `yarn tauri dev` — Testing actual Tauri integration, IPC calls, backend features

### Code Quality (Before PR)

```bash
# Format code (Biome + cargo fmt)
yarn format

# Lint (Biome + cargo clippy -D warnings)
yarn lint

# Type check (TypeScript only)
yarn typecheck

# ALL CHECKS (format, lint, typecheck, tests)
yarn check
```

**Before committing:** `yarn check` must pass with zero errors.

## Testing

### Test Suites

```bash
# All unit tests with coverage (frontend + backend, fast)
yarn test:unit

# All E2E tests (WebDriver.io, slow)
yarn test:e2e

# Full test suite with coverage (unit + E2E, slowest)
yarn test

# Quick check: unit + E2E [CRITICAL] tests only (faster for CI/CD)
yarn test:check
```

### E2E Targeted Execution

```bash
# Run single test file (RECOMMENDED for development)
yarn test:e2e --spec="test/specs/requests.e2e.ts"

# Run specific test by name within file
yarn test:e2e --spec="test/specs/requests.e2e.ts" --test="creates a new request"

# Run multiple files
yarn test:e2e --spec="test/specs/{app,auth,requests}.e2e.ts"
```

**Note:** WebDriver.io uses Mocha, so `--test` filters by describe/it names.

### Test Coverage

```bash
# Full test suite with coverage (unit + E2E)
yarn test

# Unit tests only with coverage
yarn test:unit

# View coverage report (opens coverage/index.html after test runs)
open coverage/index.html
```

## Build & Distribution

### Local Build

```bash
# Production build (compiles to target/)
yarn tauri build

# Frontend bundle analysis (check dist/stats.html)
yarn analyze
```

### Packaging

```bash
# Create distribution bundle (.zip, portable exe, installer)
yarn portal:package
```

## Code Generation

### Icons & Assets

```bash
# Generate Knurl app icon from logo
yarn generate:knurl-icon

# Generate all shadcn icons contact sheet
yarn generate:icons
```

### Documentation

```bash
# Dev server for docs (Astro, live reload)
yarn docs:dev

# Build docs (outputs to documentation/dist)
yarn docs:build
```

## OAuth Testing

```bash
# Start mock OAuth2 server (port 9000)
yarn oauth-server
```

Used for testing OAuth flows. Configure OAuth provider with redirect URI: `http://localhost:[port]`

## Security Scanning

```bash
# Security checks (gitleaks, cargo-deny, cargo-audit)
yarn security

# Check specific audit (no type/lint/test checks)
CHECK_TYPES=0 CHECK_LINT=0 CHECK_FMT_RUST=0 CHECK_CLIPPY=0 CHECK_TEST_FE=0 CHECK_TEST_BE=0 CHECK_AUDIT=1 CHECK_DENY=1 CHECK_GITLEAKS=1 bash scripts/check-local.sh
```

## Dependencies

```bash
# Update all dependencies
yarn up \*

# Update Rust deps
cd src-tauri && cargo update

# List specific package versions
yarn info @tauri-apps/api

# Check for unused packages
knip
```

## Git Workflow

### Commit Style

Use **Conventional Commits:**

```
feat:    New feature
fix:     Bug fix
chore:   Non-code (deps, build, config)
refactor: Code restructure (no behavior change)
test:    Add/update tests
docs:    Documentation
perf:    Performance improvement
```

Example:
```bash
git add .
git commit -m "feat: add OAuth2 PKCE support for secure desktop flows"
```

## Mono Repository Scripts

These are helpers in `scripts/`:

```bash
# Feature manifest generation
node scripts/feature-manifest.mjs

# Update version
node scripts/update-version.mjs

# Filter user-facing features
node scripts/filter-user-features.mjs
```

## Environment Variables

### Test-Specific

```bash
# Disable auto-save for testing (faster, less async noise)
KNURL_AUTO_SAVE=0 yarn test:e2e

# Enable logging
LOG_LEVEL=trace yarn test:e2e

# Run with specific Chrome/Firefox
BROWSER=firefox yarn test:e2e
```

### Build-Specific

```bash
# Analyze bundle size
ANALYZE=1 vite build

# Skip certain checks
CHECK_TYPES=0 CHECK_LINT=0 yarn check
```

## Debugging

### TypeScript

```bash
# Get detailed type errors
yarn typecheck

# Check specific file
yarn typecheck src/components/my-file.tsx
```

### Rust

```bash
# Check Rust without full build
cd src-tauri && cargo check

# Run tests with output
cargo test -- --nocapture

# Profile build timing
cd src-tauri && cargo build --release && cargo build-bake target/cargo-timings.html
```

### E2E

```bash
# Run with debug output
yarn test:e2e --spec="test/specs/app.e2e.ts" --loglevel=trace

# Run single test with timeout adjustment
timeout=60000 yarn test:e2e --spec="test/specs/app.e2e.ts" --test="specific test name"
```

## Common Patterns

### Before Opening PR

```bash
# 1. Format & lint
yarn format
yarn lint

# 2. Run all tests
yarn test

# 3. Type check
yarn typecheck

# 4. All in one
yarn check
```

### During Development (Iterative)

```bash
# Terminal 1: Start dev server
yarn tauri dev

# Terminal 2: Run targeted E2E tests
yarn test:e2e --spec="test/specs/requests.e2e.ts"

# Terminal 3: Check types as you edit
yarn typecheck --watch  # (if supported, else run manually)
```

### Testing a Specific Feature

```bash
# Run only E2E tests for that feature
yarn test:e2e --spec="test/specs/collections-management.e2e.ts"

# Run all unit tests (frontend + backend)
yarn test:unit

# Check Rust backend directly (if modified)
cd src-tauri && cargo test --lib
```

## Troubleshooting Command Failures

| Command Fails | Solution |
|---|---|
| `yarn install` | Clear cache: `yarn cache clean` then `yarn install` |
| `yarn check` | Run individually: `yarn format`, `yarn lint`, `yarn typecheck`, `yarn test` |
| `yarn test:e2e` | Single file: `yarn test:e2e --spec="test/specs/app.e2e.ts"` |
| `yarn tauri dev` stalls | Kill `tauri-driver`: `pkill -f tauri-driver` then retry |
| `cargo build` fails | Clear: `cd src-tauri && cargo clean` then `cargo check` |
| Port 3000 in use | Check `lsof -i :3000` and kill process |

## Scripts Not in package.json

These are **not** entry points (internal helpers only):

- `scripts/check-local.sh` — Called by `yarn check`
- `scripts/test-unit.sh` — Called by `yarn test:unit`
- `scripts/test-e2e.sh` — Called by `yarn test:e2e`
- `scripts/test.sh` — Called by `yarn test`
- `scripts/test-check.sh` — Called by `yarn test:check`
- `scripts/test-with-coverage.sh` — Legacy coverage script (consolidated into `yarn test`)
- `scripts/consolidate-coverage.mjs` — Coverage consolidation helper

Always use `yarn` aliases, not scripts directly.

## Cross-References

- **CORE.md** — When to run checks
- **E2E.md** — E2E test execution strategies
- **TESTING.md** — Which test type to use
- **BLOCKERS.md** — Command failures and solutions

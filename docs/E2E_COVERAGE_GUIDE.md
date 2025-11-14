# E2E Test Coverage Guide

This guide explains how to collect coverage metrics from E2E tests for both frontend and backend code.

## Frontend Coverage (TypeScript/React)

### 1. Install Dependencies

```bash
yarn add -D vite-plugin-istanbul @vitest/coverage-istanbul nyc
```

### 2. Create Vite Plugin for E2E Coverage

Create `vite.config.e2e.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import istanbul from 'vite-plugin-istanbul'

export default defineConfig({
  plugins: [
    react(),
    istanbul({
      include: 'src/*',
      exclude: ['node_modules', 'test/', '**/*.test.ts', '**/*.test.tsx'],
      extension: ['.js', '.ts', '.tsx'],
      requireEnv: false, // Always instrument for E2E
      forceBuildInstrument: true
    })
  ],
  // Rest of your Vite config
})
```

### 3. Update Tauri Config for E2E

Add script to `package.json`:

```json
{
  "scripts": {
    "tauri:dev:e2e": "VITE_CONFIG=e2e tauri dev --config src-tauri/tauri.e2e.conf.json",
    "test:e2e:coverage": "cross-env COVERAGE=true wdio run ./wdio.conf.ts"
  }
}
```

### 4. Collect Coverage in E2E Tests

Update `wdio.conf.ts`:

```typescript
export const config: Options.Testrunner = {
  // ... existing config

  afterTest: async function () {
    // Collect coverage from browser
    const coverage = await browser.execute(() => {
      return (window as any).__coverage__;
    });

    if (coverage) {
      const fs = require('fs');
      const path = require('path');
      const coverageDir = path.join(__dirname, '.nyc_output');

      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }

      const coverageFile = path.join(
        coverageDir,
        `coverage-${Date.now()}.json`
      );
      fs.writeFileSync(coverageFile, JSON.stringify(coverage));
    }
  },

  after: function () {
    // Merge and generate report
    const { execSync } = require('child_process');
    execSync('nyc merge .nyc_output coverage/e2e-coverage.json');
    execSync('nyc report --reporter=html --reporter=text --temp-dir=.nyc_output');
  }
}
```

### 5. Merge with Unit Test Coverage

Create `scripts/merge-coverage.mjs`:

```javascript
import { createCoverageMap } from 'istanbul-lib-coverage';
import { createReporter } from 'istanbul-api';
import fs from 'fs';

const map = createCoverageMap({});

// Load unit test coverage
const unitCoverage = JSON.parse(
  fs.readFileSync('coverage/coverage-final.json', 'utf-8')
);
map.merge(unitCoverage);

// Load E2E coverage
const e2eCoverage = JSON.parse(
  fs.readFileSync('coverage/e2e-coverage.json', 'utf-8')
);
map.merge(e2eCoverage);

// Generate merged report
const reporter = createReporter();
reporter.addAll(['json', 'lcov', 'text', 'html']);
reporter.write(map);
```

Add to `package.json`:

```json
{
  "scripts": {
    "coverage:merge": "node scripts/merge-coverage.mjs"
  }
}
```

---

## Backend Coverage (Rust)

### Approach 1: cargo-llvm-cov (Recommended)

This is trickier because Tauri runs as a separate process.

#### 1. Install cargo-llvm-cov

```bash
cargo install cargo-llvm-cov
```

#### 2. Build Instrumented Binary

```bash
# Build with coverage instrumentation
cargo llvm-cov --no-report --workspace --bin knurl

# The instrumented binary is in target/llvm-cov-target/debug/
```

#### 3. Configure E2E to Use Instrumented Binary

Update `wdio.conf.ts`:

```typescript
import path from 'path';

export const config: Options.Testrunner = {
  before: function() {
    // Set environment variable to use instrumented binary
    process.env.TAURI_BINARY_PATH = path.join(
      __dirname,
      'src-tauri/target/llvm-cov-target/debug/knurl'
    );

    // Set coverage data file location
    process.env.LLVM_PROFILE_FILE = path.join(
      __dirname,
      'coverage/profraw/knurl-%p.profraw'
    );
  },

  after: function() {
    // Generate coverage report
    const { execSync } = require('child_process');
    execSync('cargo llvm-cov report --html --output-dir coverage/backend-e2e');
  }
}
```

#### 4. Run E2E Tests with Coverage

```bash
# Build instrumented binary
cargo llvm-cov --no-report --workspace

# Run E2E tests (will use instrumented binary)
yarn test:e2e

# Generate report from profraw files
cargo llvm-cov report \
  --html \
  --output-dir coverage/backend \
  --ignore-filename-regex '(test|mock)'
```

### Approach 2: Simplified (Document Coverage Manually)

If instrumentation is too complex, document E2E coverage:

Create `docs/E2E_COVERAGE_MAP.md`:

```markdown
# E2E Test Coverage Map

This documents which modules are covered by E2E tests.

## Backend (Rust)

### src-tauri/src/http_client/auth.rs
- ✅ **OAuth2 Authorization Code Flow** - `e2e/auth/oauth-authorization-code.spec.ts`
- ✅ **OAuth2 Client Credentials** - `e2e/auth/oauth-client-credentials.spec.ts`
- ✅ **OAuth2 Device Code Flow** - `e2e/auth/oauth-device-code.spec.ts`
- ✅ **OAuth2 Refresh Token** - `e2e/auth/oauth-refresh.spec.ts`
- ✅ **PKCE Validation** - Covered in authorization code flow
- ⚠️ **Token Parsing Edge Cases** - Not covered (add unit tests)

### src-tauri/src/http_client/hyper_engine.rs
- ✅ **GET/POST/PUT/DELETE Requests** - `e2e/requests/http-methods.spec.ts`
- ✅ **Multipart Form Data** - `e2e/requests/multipart.spec.ts`
- ✅ **File Uploads** - `e2e/requests/file-upload.spec.ts`
- ✅ **Request Headers** - `e2e/requests/headers.spec.ts`
- ✅ **Response Streaming** - `e2e/requests/large-response.spec.ts`
- ⚠️ **Timeout Edge Cases** - Not covered (add unit tests)
- ⚠️ **Malformed Multipart** - Not covered (add unit tests)

### src-tauri/src/http_client/hyper_engine/connector.rs
- ✅ **TLS Certificate Validation** - `e2e/security/tls-validation.spec.ts`
- ✅ **Self-Signed Certificates** - `e2e/security/self-signed-cert.spec.ts`
- ✅ **Certificate Errors** - `e2e/security/invalid-cert.spec.ts`
- ✅ **SNI Support** - Covered in TLS validation tests

## Frontend

### src/state/collections.ts
- ✅ **Create/Update/Delete Collections** - `e2e/collections/crud.spec.ts`
- ✅ **Create/Update/Delete Requests** - `e2e/requests/crud.spec.ts`
- ✅ **Folder Operations** - `e2e/folders/management.spec.ts`
- ✅ **Environment Variables** - `e2e/environments/variables.spec.ts`

### src/state/settings.ts
- ❌ **Theme Application** - NOT COVERED (add unit tests)
- ❌ **Settings Persistence** - NOT COVERED (add unit tests)
- ❌ **Font Size Changes** - NOT COVERED (add unit tests)

### src/request/ws/engine.ts
- ❌ **WebSocket Connection** - STUB ONLY (needs implementation)
```

## Recommended Approach

For Knurl, I recommend:

### Short-term:
1. **Document E2E coverage** using the map approach above
2. **Add unit tests** for genuine gaps (settings.ts, WebSocket)
3. **Accept** that E2E coverage won't be measured in metrics

### Medium-term (if coverage metrics are important):
4. **Frontend only**: Implement Istanbul instrumentation (easier to set up)
5. **Backend**: Keep using unit tests + E2E coverage documentation

### Long-term (if you need exact metrics):
6. **Full instrumentation**: Implement both frontend and backend coverage collection

## Why This is Complex

**Frontend:**
- ✅ Relatively straightforward with vite-plugin-istanbul
- ✅ Browser exposes `window.__coverage__` object
- ⚠️ Adds overhead to E2E test runs

**Backend (Rust):**
- ❌ Tauri app runs as separate process
- ❌ Coverage data written to disk on exit (may not flush during E2E)
- ❌ Instrumented binary is larger and slower
- ❌ Complex to set up with WebDriver

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| **Document coverage manually** | Simple, no overhead | Manual maintenance, no metrics |
| **Frontend instrumentation only** | Good metrics for UI code | Missing backend coverage |
| **Full instrumentation** | Complete picture | Complex setup, slow tests |
| **Accept current metrics** | No work needed | Misleading coverage numbers |

## Recommendation for Knurl

Given that you have comprehensive E2E tests, I recommend:

1. **Phase 1:** Document E2E coverage in `docs/E2E_COVERAGE_MAP.md`
2. **Phase 2:** Add unit tests for genuine gaps (settings.ts, edge cases)
3. **Phase 3:** Consider frontend instrumentation if coverage metrics become important for CI/CD gates

The E2E tests provide the actual quality assurance you need. The coverage metrics are secondary.

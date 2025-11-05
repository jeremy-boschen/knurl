# Documentation Screenshots E2E Tests

This directory contains end-to-end tests for capturing documentation screenshots. The tests automatically generate screenshots of Knurl features using a pre-built GitHub API collection.

## Structure

```
documentation/
├── e2e/
│   ├── screenshots.e2e.ts          # Main screenshot generation test
│   ├── support/
│   │   ├── screenshot-helpers.ts   # Utilities for capturing screenshots
│   │   └── collection-setup.ts     # Collection import utilities
│   ├── fixtures/
│   │   ├── github-api-collection.json    # Pre-built GitHub API collection
│   │   └── README.md               # Fixture documentation
│   ├── screenshots/                # Generated screenshots (output)
│   └── README.md                   # This file
```

## How It Works

1. **Fixture-Based**: Uses `github-api-collection.json` - a complete GitHub API collection structure
2. **Mock Server**: All API calls hit the local mock server at `http://localhost:3000/mock/github/*`
3. **Deterministic**: Same screenshots every run - no external API dependencies
4. **Organized**: Captures screenshots for 22+ features organized by tier

## Running the Tests

### Prerequisites

Make sure the mock server is running:

```bash
node scripts/oauth-mock-server.mjs
```

### Run All Screenshot Tests

```bash
yarn test:e2e --spec="documentation/e2e/screenshots.e2e.ts"
```

### Run Specific Screenshot Test

```bash
yarn test:e2e --spec="documentation/e2e/screenshots.e2e.ts" --grep "Workspace overview"
```

## Adding New Screenshots

To add a new screenshot:

1. Add a new `it("TIER X-Y: Description", async () => { ... })` block in `screenshots.e2e.ts`
2. Use the helper functions:
   - `takeScreenshot(filename)` - Capture and save screenshot
   - `clickAndWait(testId)` - Click element and wait for action
   - `openRequestInTab(collectionId, requestId)` - Open request in tab
   - `getByTestId(testId)` - Get element by test ID
3. Screenshot will be saved to `documentation/e2e/screenshots/{filename}`

## Screenshot Tiers

### TIER 1: Core Overview (5 screenshots)
- Workspace overview
- Collection hierarchy
- Request-response cycle
- Response headers
- Response timeline

### TIER 2: Feature Deep Dives (10 screenshots)
- Query parameters
- Headers with variables
- Collection-level auth
- Request-level auth
- Environments management
- Variable interpolation
- Response body formatting
- OAuth 2.0 setup
- OAuth token management
- Multiple tabs

### TIER 3: Advanced Workflows (5 screenshots)
- Form-encoded body
- Raw text body
- Collection encryption
- Import/Export dialog
- Error handling (404)

### TIER 4: Optional Advanced (2 screenshots)
- Error handling (500)
- Request cancellation

## Updating the Fixture

To modify the collection structure:

1. Edit `fixtures/github-api-collection.json`
2. The collection includes:
   - 7 folder categories (Repos, Issues, Pulls, Commits, Users, Search, Gists)
   - 27 requests reflecting real GitHub API endpoints
   - 2 environments (Development, Production)
   - All URLs point to mock server endpoints

When updating, ensure all requests have:
- `name`: Request name
- `method`: HTTP method (GET, POST, etc.)
- `url`: Full URL with variables (e.g., `{{base_url}}/repos/{{owner}}/{{repo}}`)
- `headers`: Array of header objects
- `params`: Array of query parameter objects (optional)
- `body`: Request body (optional)

## Troubleshooting

### Screenshots not being captured
- Ensure mock server is running (`yarn dev` or `node scripts/oauth-mock-server.mjs`)
- Check that `documentation/e2e/screenshots/` directory exists and is writable
- Look for test failures in the console output

### Tests timing out
- Increase timeout values in helper functions
- Ensure mock server is responsive
- Check browser console for JavaScript errors

### Elements not found
- Verify test IDs match current UI code in `src/`
- Use `browser.execute(() => console.log(document.body.innerHTML))` to inspect DOM
- Add more specific selectors if needed

## Integration with Documentation

Once screenshots are captured:

1. Reference them in documentation files (e.g., `docs/guides/`)
2. Use relative paths: `![Feature](../../documentation/e2e/screenshots/01-workspace-overview.png)`
3. Screenshots auto-update when E2E tests run with fresh UI changes

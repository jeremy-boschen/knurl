# Feature Manifest to Astro Integration

This document describes how the auto-generated feature manifest is integrated into the Astro documentation build pipeline.

## Overview

The feature manifest generation and Astro documentation building are now tightly integrated:

```
1. Feature Detection
   └─ yarn feature-manifest
      (Ollama analyzes codebase → docs/feature-manifest/feature-manifest.json)

2. Feature Doc Generation
   └─ yarn generate:feature-docs
      (Converts JSON manifest → .mdx pages in documentation/src/content/docs/features/)

3. Astro Build
   └─ astro build
      (Renders all docs including feature reference pages → dist/)
```

## Build Pipeline

### Full Documentation Build

```bash
yarn docs:create
```

This runs:

1. **E2E Screenshots:** Generates fresh app screenshots
   ```bash
   npm run test:e2e -- --spec=documentation/e2e/screenshots.e2e.ts
   ```

2. **Feature Manifest:** Analyzes codebase with Ollama
   ```bash
   yarn feature-manifest
   ```

3. **Feature Docs:** Generates Astro pages from manifest
   ```bash
   yarn generate:feature-docs
   ```

4. **Astro Build:** Compiles all docs to static HTML
   ```bash
   cd documentation && astro build
   ```

Output: `documentation/dist/` with complete documentation site

### Development Preview

```bash
yarn docs:preview
```

Runs feature generation steps then starts Astro dev server:
- Live reload on feature doc changes
- Fast iteration for testing manifest generation

### Individual Commands

```bash
# Just regenerate feature manifest
yarn feature-manifest

# Just generate feature documentation pages
yarn generate:feature-docs

# Just build Astro docs
cd documentation && astro build
```

## File Structure

### Input: Feature Manifest

```
docs/feature-manifest/
├── feature-manifest.json       # Machine-readable full manifest
├── feature-manifest.yaml       # Human-readable full manifest
└── features/
    ├── auth/
    │   ├── oauth-flows.yaml
    │   └── request-authentication.yaml
    ├── collections/
    │   └── create-collection.yaml
    └── ...
```

### Processing: Feature Doc Generator

The `scripts/generate-feature-docs.mjs` script:

1. Loads `docs/feature-manifest/feature-manifest.json`
2. Groups features by area (auth, collections, core, etc.)
3. Generates user-facing Astro pages (`.mdx`) for each feature
4. Includes:
   - Feature name and description
   - Business context
   - UI routes and entry points
   - Data model overview
   - Configuration options
   - Security & privacy details
   - Technical confidence level
   - Evidence citations

### Output: Astro Content

```
documentation/src/content/docs/features/
├── auth/
│   ├── api-request-authoring.mdx
│   ├── oauth-flows.mdx
│   └── request-authentication.mdx
├── collections/
│   ├── create-collection.mdx
│   ├── delete-collection.mdx
│   ├── manage-requests-within-collections.mdx
│   └── ...
├── core/
├── http-client/
├── settings/
├── testing/
├── ui-ux/
└── ...
```

## Astro Sidebar Integration

The sidebar is automatically built from generated feature docs in `documentation/astro.config.mjs`:

```javascript
// Dynamically generates sidebar groups from features/ directory
function buildFeaturesSidebarItems() {
  // Scans documentation/src/content/docs/features/
  // Creates collapsible groups by area:
  // - Auth (oauth-flows, request-authentication, ...)
  // - Collections (create, delete, manage, ...)
  // - Core (data-storage, request-builder, ...)
  // ... etc
}

// Sidebar config
sidebar: [
  // ... existing docs sections
  {
    label: "Features Reference",
    collapsed: true,              // Collapsed by default
    items: buildFeaturesSidebarItems()
  }
]
```

**Result:** Feature documentation appears as a collapsible "Features Reference" section with sub-groups for each area.

## Example: Feature Page

Generated pages follow this structure:

```markdown
---
title: OAuth Flows
description: Manage OAuth2 authentication workflows with flexible provider support.
sidebar: {order: 50}
---

## Overview

Manage OAuth2 authentication workflows with flexible provider support.

## Why This Matters

Enables secure, standard-based authentication with major API providers.

**Status:** ✅ Active

## How to Use

### In the Application

- **/auth-settings**
- **/oauth-config**

## Data Model

### OAuth2Config
- `provider`: OAuth provider (google, github, etc.)
- `clientId`: Application client ID
- `clientSecret`: Application secret
- ...

## Configuration

### Environment Variables
- `OAUTH_CLIENT_ID`: Client ID from provider
- `OAUTH_CLIENT_SECRET`: Client secret

## Security & Privacy

**Authentication Flows:** OAuth2 authorization code flow

**Secrets:** Client secret stored encrypted in local collection

## Technical Details

**Confidence Level:** Medium (82%)

**Evidence:** This feature was detected from:
- `src/auth/oauth-manager.ts`
- `src/ui/components/OAuthFlow.tsx`
- `test/specs/oauth-flows.e2e.ts`

*Generated from feature manifest on 2025-10-31*
```

## Updating Features

### When Code Changes

1. **Run feature manifest generator:**
   ```bash
   yarn feature-manifest
   ```
   This re-analyzes the codebase with Ollama, creating an updated `docs/feature-manifest/feature-manifest.json`

2. **Regenerate feature docs:**
   ```bash
   yarn generate:feature-docs
   ```
   This converts the new manifest to updated `.mdx` pages

3. **Rebuild docs:**
   ```bash
   cd documentation && astro build
   ```
   Or just use the integrated command:
   ```bash
   yarn docs:create
   ```

### Iterative Refinement

The feature manifest generator uses the previous manifest as baseline context:

```
Iteration 1:
  Initial analysis → feature-manifest.json

Iteration 2:
  Reads Iteration 1 manifest
  Uses it as context for refinement
  → improved feature-manifest.json

Iteration 3+:
  Continue refining...
```

This allows the manifest to get better with each run as Ollama builds a deeper understanding of the codebase.

### Manual Adjustments

If you want to manually refine a feature before docs are generated:

1. Edit `docs/feature-manifest/feature-manifest.json` directly
2. Update the feature's:
   - `summary_user`: User-facing description
   - `summary_business`: Business context
   - `status`: active/experimental/deprecated
   - `entry_points`: UI routes, CLI commands, API endpoints
   - `data_model`: Entity descriptions
   - `configuration`: Env vars and flags
   - `security_privacy`: Auth and data protection info
3. Run `yarn generate:feature-docs` to regenerate docs
4. Commit changes to git

## CI/CD Integration

To automatically generate feature docs on every build:

**.github/workflows/docs.yml:**
```yaml
- name: Generate Feature Manifest
  run: yarn feature-manifest

- name: Generate Feature Documentation
  run: yarn generate:feature-docs

- name: Build Documentation
  run: cd documentation && astro build

- name: Deploy Docs
  uses: actions/deploy-pages@v3
  with:
    folder: documentation/dist
```

## Troubleshooting

### Feature docs don't appear in sidebar

1. Check that `documentation/src/content/docs/features/` directory exists:
   ```bash
   ls -la documentation/src/content/docs/features/
   ```

2. Ensure generate-feature-docs script ran:
   ```bash
   yarn generate:feature-docs
   ```

3. Verify Astro config includes the dynamic sidebar builder (should be present in astro.config.mjs)

### Some features missing from docs

1. Check confidence level in manifest:
   ```bash
   cat docs/feature-manifest/feature-manifest.json | jq '.features[] | select(.confidence < 0.6)'
   ```

2. Features with confidence < 0.6 are still generated, but you can check if descriptions are empty

3. Re-run feature manifest with more context:
   ```bash
   yarn feature-manifest --log-level DEBUG
   ```

### Build fails with "Features Reference not found"

This is expected on first run. The features directory is created by `yarn generate:feature-docs`.

Solution: Run the full pipeline:
```bash
yarn feature-manifest && yarn generate:feature-docs
```

## Performance Notes

- **Feature manifest generation:** 10-15 minutes for full codebase (Ollama LLM analysis)
- **Feature doc generation:** < 1 second (just template rendering)
- **Astro build:** 5-30 seconds depending on total doc count
- **Total:** ~15-20 minutes for full documentation build

Cache is used for unchanged files in subsequent runs.

## Related Documentation

- [FEATURE_MANIFEST_README.md](./FEATURE_MANIFEST_README.md) - Feature manifest generator usage
- [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) - Ollama configuration for code analysis
- [documentation/astro.config.mjs](./documentation/astro.config.mjs) - Astro build configuration
- [scripts/generate-feature-docs.mjs](./scripts/generate-feature-docs.mjs) - Feature doc generator source code

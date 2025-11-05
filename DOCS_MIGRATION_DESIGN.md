# Documentation Migration Design

## Audit Results: Manual Documentation Content

### Valuable Manual Content Identified

The manual documentation contains critical **user-facing guides and tutorials** that the AI system cannot generate:

1. **installation.mdx** - Installation instructions (platform-specific)
   - System requirements
   - Download & install steps
   - First launch walkthrough
   - Verification checklist

2. **index.mdx** - Getting started overview
   - What Knurl is and key features
   - Feature highlights
   - Navigation to next steps

3. **collections/overview.mdx** - Collections concept guide
   - What a collection is
   - Collection structure diagrams
   - Collection management operations (rename, reorder, duplicate)
   - Folder hierarchy explanation

4. **requests/overview.mdx** - Request building guide
   - Creating requests step-by-step
   - Request components explanation (URL, method, params, headers, body)
   - Request management operations
   - Variable interpolation examples

5. **request-authentication/overview.mdx** - Authentication methods guide
   - Supported auth methods (Basic, Bearer, API Key, OAuth)
   - Step-by-step setup for each method
   - Collection vs. request-level auth
   - Environment variable usage with auth
   - Security best practices

6. **execution/overview.mdx** - Request execution guide
   - How to send requests
   - Request pipeline explanation
   - Response view overview
   - Error handling and cancellation

7. **execution/response-analysis.mdx** - Response analysis guide
   - Response body viewing (JSON, raw, binary)
   - Header inspection
   - Timeline/performance analysis
   - Common HTTP status codes
   - Debugging strategies

8. **execution/variables.mdx** - Environment & variables guide
   - What variables are
   - Creating environments
   - Using variables in requests
   - Secure fields for sensitive data
   - Best practices

9. **collections/encryption.mdx** - Encryption guide
   - What gets encrypted
   - Encryption algorithm details
   - Enabling/disabling encryption
   - Sharing encrypted collections
   - Security notes and best practices

10. **collections/import-export.mdx** - Import/export guide
    - Export format and contents
    - Export procedure
    - Import procedure
    - Safe sharing practices
    - Sensitive value handling

11. **collections/merge.mdx** - Collection merging guide
    - How merge works
    - Merging steps
    - Conflict resolution
    - Use cases
    - Best practices
    - Undo/recovery

12. **execution/response-analysis.mdx** - Response analysis
    - Timeline and performance details
    - Status code reference
    - Debugging strategies

### AI-Generated Content (Feature Docs)

The feature-manifest system generates:
- Technical feature detection and inventory
- Entry points (UI routes, CLI commands, API endpoints)
- Data models and configurations
- Security & privacy details
- Dependencies
- Evidence and confidence levels

### Content Mapping Strategy

| Manual Doc | Maps to Feature(s) | Integration Strategy |
|------------|-------------------|----------------------|
| collections/overview.mdx | collections/* features | Move to `collections/overview` supplemental |
| requests/overview.mdx | http-client/* features | Move to `request-building` supplemental |
| request-authentication/overview.mdx | auth/* features | Move to `authentication-setup` supplemental |
| execution/variables.mdx | core.variables | Move to supplemental section |
| execution/overview.mdx | core.request-execution | Move to supplemental section |
| execution/response-analysis.mdx | core.response-analysis | Move to supplemental section |
| collections/encryption.mdx | collections.encryption | Add as supplemental |
| collections/import-export.mdx | collections.import-export | Add as supplemental |
| collections/merge.mdx | collections.merge | Add as supplemental |

## Supplemental Content System Design

### Directory Structure

```
docs/manual-content/
├── auth/
│   ├── authentication-setup.md          # Tutorial: Setting up auth methods
│   └── oauth-flows-guide.md             # Guide: OAuth 2.0 flows
├── collections/
│   ├── collections-overview.md          # Guide: Understanding collections
│   ├── collections-encryption.md        # Tutorial: Enabling encryption
│   ├── import-export-guide.md           # How-to: Share collections
│   └── merge-guide.md                   # How-to: Merge collections
├── http-client/
│   ├── request-building.md              # Tutorial: Building requests
│   └── response-analysis.md             # Guide: Analyzing responses
├── core/
│   ├── request-execution.md             # How-to: Execute requests
│   └── variables-guide.md               # Tutorial: Using environments
└── index.md                             # Overview and navigation

Installation & Getting Started (separate from features):
docs/manual-content/getting-started/
├── installation.md
└── first-steps.md
```

### Supplemental Content Format

Each supplemental file uses YAML frontmatter for metadata:

```yaml
---
title: "Setting Up Authentication"
description: "Step-by-step guide to configure authentication methods in Knurl"
category: "auth"
relatedFeatures:
  - "auth.request-authentication"
  - "auth.oauth-flows"
order: 10
---

## Content here...
```

### Integration in generate-feature-docs.mjs

When generating feature docs:

1. **Load supplemental content** for matching feature area/id
2. **Merge into generated MDX** in appropriate sections:
   - Place user guide content in a "Getting Started" section
   - Add practical examples and tutorials
   - Include screenshots references (when available)
3. **Mark content sections** to indicate source:
   - AI-generated: "Technical Reference"
   - Manual: "User Guide", "Tutorial", "How-to"

Example merged output structure:
```markdown
# Create Collection Feature

## User Guide (Manual)
[From collections-overview.md]
- Collections concept
- When to use them
- Best practices

## How to Use (Auto-generated)
[From AI feature detection]
- UI routes
- API endpoints

## Technical Details (Auto-generated)
[From AI analysis]
- Data models
- Configuration
- Dependencies
```

### Screenshot Integration

Screenshots from `documentation/e2e/screenshots/` are mapped to features:

```yaml
# docs/feature-manifest/screenshots.json
{
  "screenshots": [
    {
      "filename": "01-workspace-overview.png",
      "related_features": ["core.workspace"],
      "description": "Workspace interface overview"
    },
    {
      "filename": "02-collections-sidebar.png",
      "related_features": ["collections.create-collection"],
      "description": "Collections sidebar view"
    }
    // ... etc
  ]
}
```

When merging docs, screenshots are embedded in MDX:
```mdx
### Visual Overview
![Description](/screenshots/01-workspace-overview.png)
```

## Migration Path

### Phase 1: Setup Manual Content System
1. Create `docs/manual-content/` directory structure
2. Extract valuable content from manual docs into supplemental files
3. Add frontmatter and metadata to supplemental files

### Phase 2: Enhanced Feature Doc Generation
1. Modify `generate-feature-docs.mjs` to:
   - Load supplemental content by feature ID/area
   - Merge user guides into feature docs
   - Embed screenshots where available
   - Mark content sections by type

### Phase 3: Remove Old System
1. Delete manual documentation files (they're now in supplemental)
2. Remove `auto-docs` E2E test and scripts
3. Update Astro sidebar to use only generated docs

### Phase 4: Versioned Manifest
1. Commit `docs/feature-manifest/feature-manifest.json` to git
2. Create `yarn docs:regenerate` command
3. Update build pipeline to use existing manifest (vs. regenerating)

## Benefits of This Approach

1. **Single Source of Truth**: Merged docs for each feature
2. **Maintainable**: Manual content separate but integrated
3. **Comprehensive**: AI-detected features + human guidance
4. **Automated**: Build process handles merging
5. **Testable**: Can validate manifest and supplemental content separately
6. **Versioned**: Manifest is committed, reproducible builds
7. **Scalable**: Easy to add more supplemental content

## Implementation Notes

- Supplemental content uses markdown, converted to MDX in generation phase
- Screenshots are PNG files, referenced by path in output
- Manual content is optional (features work without it)
- Content is merged during generation, not stored in generated docs
- Manifest regeneration only needed when code changes

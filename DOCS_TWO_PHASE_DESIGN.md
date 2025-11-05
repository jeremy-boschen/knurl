# Two-Phase Documentation Generation System

## Overview

A two-phase approach to generate user-focused documentation from the complete feature inventory:

**Phase 1: Complete Feature Inventory** (existing system)
- Scans entire codebase
- Detects ALL features (user-facing and developer-focused)
- Output: `docs/feature-manifest/feature-manifest.json`
- Used for: Release notes, feature tracking, developer reference

**Phase 2: User-Focused Documentation** (new system)
- Filters Phase 1 to UI-visible features only
- Reorganizes by user workflows
- Uses Ollama with strict prompts to rewrite for users
- Output: `docs/user-docs-manifest/user-docs.json`
- Used for: Public documentation site

---

## Phase 1: Complete Feature Inventory (Existing)

**Input:** Full codebase

**Process:**
```
1. Scan all code files
2. Detect routes, endpoints, data models, UI components
3. Group by technical area (auth, collections, core, etc.)
4. Extract all signals: entry points, dependencies, security, etc.
```

**Output:** `docs/feature-manifest/feature-manifest.json`
```json
{
  "features": [
    {
      "id": "auth.request-authentication",
      "name": "Request Authentication Management",
      "area": "Auth",
      "status": "active",
      "entry_points": {
        "ui_routes": ["/collections/:id/requests/:rid/auth"],
        "ui_components": ["AuthSelector", "BasicAuthForm", "BearerTokenForm"]
      },
      "data_model": {...},
      "security_privacy": {...},
      "evidence": [...]
    }
    // ... 50+ features detected
  ]
}
```

---

## Phase 2: User-Focused Documentation (New)

### 2.1 Filtering: Extract UI-Visible Features

**Criteria:**
- Feature has UI entry points (components, buttons, panels visible to users)
- NOT internal/developer-only (testing, performance, build-related)
- NOT edge cases or advanced technical concerns

**Input:** `feature-manifest.json` (Phase 1 output)

**Process:**
```javascript
const userFeatures = features.filter(f => {
  // Must have UI components or user-visible entry points
  const hasUIComponents = f.entry_points?.ui_components?.length > 0
  const hasUIRoutes = f.entry_points?.ui_routes?.length > 0

  // Exclude developer areas
  const isDeveloperArea = ['testing', 'build-ci', 'documentation'].includes(f.area)

  // Exclude technical implementation details
  const isUserWorkflow = !f.name.includes('performance') &&
                         !f.name.includes('performance') &&
                         !f.name.includes('internal')

  return (hasUIComponents || hasUIRoutes) && !isDeveloperArea && isUserWorkflow
})
```

**Expected output:** ~20-30 user-relevant features (filtered from 50+)

### 2.2 Reorganization: Map to User Workflows

**User-Focused Categories:**
```
Welcome & Overview
Installation & Setup
Collections
  - Understanding Collections
  - Creating & Managing Collections
  - Organizing Requests
Requests
  - Building Requests
  - HTTP Methods & Configuration
Authentication
  - Basic Auth
  - Bearer Tokens
  - API Keys
  - OAuth 2.0
Environments & Variables
Execution & Response Analysis
Settings & Preferences
Advanced
  - Encryption
  - Import/Export
  - Collection Merging
```

**Mapping logic:**
```javascript
const userCategories = {
  'collections.*': 'Collections',
  'http-client.request-*': 'Requests',
  'auth.*': 'Authentication',
  'core.variables': 'Environments & Variables',
  'core.response-*': 'Execution & Response Analysis',
  'settings.*': 'Settings & Preferences'
}

// Group filtered features by category
const organized = groupBy(userFeatures, f =>
  mapToUserCategory(f.id, userCategories)
)
```

### 2.3 Ollama Rewriting: User-Friendly Descriptions

**Prompt Template (Strict Rules):**

```
You are generating user-focused documentation for Knurl, a desktop HTTP API client.

CRITICAL RULES:
1. Write for non-technical users who want to accomplish tasks
2. Use active voice: "Create a collection" not "Collections can be created"
3. Focus on "why" and "how" - not technical implementation
4. Use simple language: explain jargon when necessary
5. Start with benefit: "To organize your requests..." not "This feature allows..."
6. Keep descriptions concise: max 2-3 sentences per feature
7. Use second person: "You can" or "You will"
8. Never mention code, APIs, endpoints, or internal implementation
9. Include practical examples when helpful

FEATURE DETAILS:
- Feature Name: {name}
- What it does: {description}
- UI Components: {components}
- Related features: {relatedFeatures}

TASK: Generate a user-focused title and description for this feature.

Output format (JSON):
{
  "userTitle": "Short, action-oriented title",
  "userDescription": "1-2 sentence description focused on user benefit",
  "userCategory": "Collections|Requests|Authentication|Settings|etc",
  "userWorkflow": "What workflow does this enable?"
}
```

**Example Input:**
```json
{
  "name": "Add Request to Collection",
  "area": "Collections",
  "summary_user": "Allows users to add new requests to a collection"
}
```

**Expected Output:**
```json
{
  "userTitle": "Add Requests to Collections",
  "userDescription": "Save your HTTP requests to a collection so you can organize, reuse, and share them with your team.",
  "userCategory": "Collections",
  "userWorkflow": "Creating and organizing API requests"
}
```

---

## Phase 2 Output: User Documentation Manifest

**File:** `docs/user-docs-manifest/user-docs.json`

```json
{
  "title": "Knurl User Documentation",
  "generatedAt": "2025-11-02T...",
  "documentation": [
    {
      "section": "Collections",
      "order": 2,
      "description": "Organize your API requests into collections",
      "features": [
        {
          "id": "collections.create-collection",
          "userTitle": "Creating Collections",
          "userDescription": "Collections are folders for organizing your API requests. Create a new collection to get started.",
          "userCategory": "Collections",
          "userWorkflow": "organizing-requests",
          "uiComponents": ["CollectionsList", "NewCollectionButton"],
          "relatedFeatures": ["collections.manage-requests-within-collections"],
          "learningPath": "start-here"
        },
        {
          "id": "collections.manage-requests-within-collections",
          "userTitle": "Adding & Managing Requests",
          "userDescription": "Add requests to your collection and organize them with folders for easy access.",
          "userCategory": "Collections",
          "userWorkflow": "organizing-requests",
          "prerequisite": "collections.create-collection"
        }
      ]
    },
    {
      "section": "Authentication",
      "order": 4,
      "description": "Secure your API requests with authentication",
      "features": [
        {
          "id": "auth.basic-authentication",
          "userTitle": "Basic Authentication",
          "userDescription": "Send a username and password with your requests. Use this for APIs that require basic auth.",
          "userCategory": "Authentication",
          "prerequisite": "requests.building-requests",
          "example": "Username and password are sent securely with each request"
        },
        {
          "id": "auth.bearer-token",
          "userTitle": "Bearer Token Authentication",
          "userDescription": "Use a token to authenticate. Many modern APIs use bearer tokens for secure access.",
          "userCategory": "Authentication"
        },
        {
          "id": "auth.oauth-flows",
          "userTitle": "OAuth 2.0 Authentication",
          "userDescription": "Connect to services that use OAuth, like Google or GitHub. Knurl handles the login flow for you.",
          "userCategory": "Authentication",
          "complexity": "advanced"
        }
      ]
    }
  ],
  "learningPaths": {
    "start-here": [
      "installation",
      "collections.create-collection",
      "requests.building-requests",
      "requests.sending-requests",
      "authentication.choosing-auth"
    ],
    "advanced": [
      "encryption.enabling-collection-encryption",
      "import-export.sharing-collections",
      "environments.managing-multiple-environments"
    ]
  }
}
```

---

## Phase 2 Implementation Plan

### Scripts:

**1. `scripts/filter-user-features.mjs`**
- Reads `feature-manifest.json`
- Filters to UI-visible features only
- Outputs intermediate JSON with filtered features
- ~200 lines

**2. `scripts/organize-user-docs.mjs`**
- Takes filtered features
- Maps to user categories using pattern matching
- Organizes into learning paths
- Outputs reorganized structure
- ~150 lines

**3. `scripts/generate-user-docs-with-ollama.mjs`** (NEW)
- Takes organized structure
- For each feature, calls Ollama with strict prompt
- Rewrites titles, descriptions for users
- Generates final `user-docs.json`
- Outputs: user-friendly manifest ready for doc generation
- ~300 lines

**4. Update `scripts/generate-feature-docs.mjs`**
- Currently generates from `feature-manifest.json`
- Add support for `user-docs.json` input
- Template changes to use user-friendly structure
- Better organization in generated MDX

### Build Commands:

```bash
# Complete build (both phases)
yarn docs:create

# Only Phase 1 (feature inventory - existing)
yarn feature-manifest

# Only Phase 2 (user docs - new)
yarn user-docs:generate

# Preview user docs locally
yarn docs:preview
```

### Updated `package.json` scripts:

```json
{
  "feature-manifest": "node scripts/feature-manifest.mjs --out docs/feature-manifest",
  "user-docs:generate": "node scripts/filter-user-features.mjs && node scripts/organize-user-docs.mjs && node scripts/generate-user-docs-with-ollama.mjs",
  "docs:create": "timeout 180 npm run test:e2e -- --spec=documentation/e2e/screenshots.e2e.ts && yarn user-docs:generate && yarn generate:feature-docs && cd documentation && astro build",
  "docs:preview": "yarn user-docs:generate && yarn generate:feature-docs && cd documentation && astro dev"
}
```

---

## Benefits of Two-Phase Approach

| Aspect | Before | After |
|--------|--------|-------|
| **User Documentation** | All 50+ features, confusing | 20-30 essential features, clear workflow |
| **Ollama Usage** | One pass detects everything | First pass inventory, second pass user-focused |
| **Categories** | Technical (Core, Testing, CI) | User-focused (Collections, Requests, Auth) |
| **Titles** | Auto-generated ("Add Request to Collection") | Human-readable ("Adding & Managing Requests") |
| **Learning Paths** | None | Clear progression from beginner to advanced |
| **Release Notes** | Uses user-focused docs | Can use Phase 1 for complete feature list |

---

## Ollama Prompt Refinement

The strict prompt template ensures:
- ✅ Active voice ("You create collections" not "Collections can be created")
- ✅ User benefit first ("To organize requests..." not "This feature provides...")
- ✅ No technical jargon (no "API endpoints", "state management", "components")
- ✅ Practical and conversational ("You will see..." not "The system will display...")
- ✅ Consistent grammar and structure across all documentation

Multiple refinement passes can improve quality:
1. First pass: Extract features + rewrite descriptions
2. Review: Check for jargon, active voice, clarity
3. Second pass: Refine based on style guide

---

## Success Metrics

Phase 2 generates user docs when:
- [ ] All feature titles use action verbs and are user-understandable
- [ ] Descriptions have zero jargon (or explain it)
- [ ] Documentation follows user workflows, not code structure
- [ ] Learning paths show clear progression
- [ ] No developer-focused features in user docs
- [ ] Categories make sense to non-technical users

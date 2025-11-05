# Documentation Screenshots Implementation Plan

## Overview
Create a targeted set of high-value screenshots for documentation by:
1. Building a realistic pre-configured workspace from existing APIs
2. Systematically capturing important workflows and features
3. Using only internal mock server endpoints for requests

## Pre-Built Workspace Strategy

Instead of rebuilding collections in each E2E test, import real-world APIs and persist them:

### Candidate APIs (Real, Well-Known OpenAPI Specs)

1. **GitHub REST API** (Recommended)
   - **Why**: Every developer knows GitHub
   - **Structure**: Repos, Issues, PRs, Users, Gists, Teams
   - **Complexity**: Medium - demonstrates real-world API
   - **OpenAPI**: https://raw.githubusercontent.com/github/rest-api-description/main/openapi.json
   - **Best for**: Developers recognizing the API structure

2. **Kubernetes API** (Advanced)
   - **Why**: Modern cloud-native work
   - **Structure**: Pods, Deployments, Services, ConfigMaps
   - **Complexity**: High - great for complex API showcase
   - **OpenAPI**: Available in cluster or https://github.com/kubernetes/kubernetes/tree/master/api/openapi-spec

3. **Istio/Envoy Proxy** (Alternative)
   - **Why**: Service mesh expertise
   - **Structure**: VirtualServices, DestinationRules, Gateways
   - **Complexity**: High

### Recommended: GitHub API
**Why GitHub:**
- Instantly recognizable to all developers
- Real-world CRUD operations
- Demonstrates GitHub repo/issue workflows
- Not overly complex (simpler than K8s)
- Has good documentation

**Implementation steps:**
1. Import GitHub OpenAPI spec
2. Extract key request groups (Repos, Issues, Users, etc.)
3. Create native Knurl collection with extracted structure
4. **Transform URLs** to mock server endpoints:
   - `https://api.github.com/repos/{owner}/{repo}` → `http://localhost:3000/mock/github/repos/{owner}/{repo}`
   - `https://api.github.com/user/issues` → `http://localhost:3000/mock/github/user/issues`
5. Add realistic auth (Bearer token, GitHub's PAT format)
6. Store as `documentation/e2e/fixtures/github-api-collection.json`
7. E2E test imports this pre-built collection

**Benefits:**
- Developers see *their* API structures
- Realistic complexity without net requests
- Deterministic mock server responses
- Can be versioned and updated when GitHub changes
- Showcases Knurl handling enterprise-grade APIs

---

## Screenshot Inventory (Prioritized)

### TIER 1: Core Overview (Essential - 5 screenshots)

#### 1. Workspace with Multiple Collections
- **Location**: `01-workspace-overview.png`
- **Shows**: 2-3 pre-existing collections (GitHub API, Internal Services, Stripe API)
- **State**: Collections in sidebar, empty main workspace
- **Purpose**: First impression - shows professional, organized workspace with real APIs
- **Setup**: Pre-built collections in fixture (GitHub imported from OpenAPI)

#### 2. Collection Organization & Hierarchy
- **Location**: `02-collection-hierarchy.png`
- **Shows**: GitHub API collection expanded with folders (Repositories, Issues, Users, Gists)
- **State**: Folder tree visible with request count per folder
- **Purpose**: Teach best practices for organizing requests, show real API structure
- **Setup**: Use imported GitHub API collection with proper organization

#### 3. Request-Response Cycle
- **Location**: `03-request-response-full.png`
- **Shows**: Request tab open, URL bar, GET method, response body with formatted JSON
- **State**: GET `/mock/github/user/repos` showing list of repositories
- **Purpose**: Show the complete workflow with recognizable API
- **Setup**: Execute GET to `/mock/github/user/repos` showing array of repo objects

#### 4. Response Headers & Metadata
- **Location**: `04-response-headers.png`
- **Shows**: Headers tab active, X-Custom-Header, Content-Type, Status 200, Duration
- **State**: Same request, different tab
- **Purpose**: Teach response inspection
- **Setup**: Headers tab from same request

#### 5. Timeline & Performance Metrics
- **Location**: `05-response-timeline.png`
- **Shows**: Timeline tab with DNS, TLS, Connection, Upload, Server Processing, Download
- **State**: Real timing data visible
- **Purpose**: Show performance debugging
- **Setup**: Timeline tab from same request

### TIER 2: Feature Deep Dives (10 screenshots)

#### 6. Query Parameters & Toggling
- **Location**: `06-query-parameters.png`
- **Shows**: 4 parameters with some toggled on/off (search, limit, offset, sort)
- **State**: Mixed enabled/disabled parameters
- **Purpose**: Demonstrate parameter management
- **Setup**: GET request with `?search=alice&limit=10&offset=0&sort=name`
- **URL**: `/mock/users`

#### 7. Custom Headers with Variables
- **Location**: `07-headers-with-variables.png`
- **Shows**: Authorization header with `Bearer {{api_token}}`, X-API-Key with `{{api_key}}`, X-Request-ID
- **State**: Headers clearly showing variable syntax
- **Purpose**: Show variable usage in headers
- **Setup**: Request with populated headers

#### 8. Collection-Level Authentication (API Key)
- **Location**: `08-auth-collection-api-key.png`
- **Shows**: Collection settings, Authentication tab, API Key method selected, Key name and value set
- **State**: Auth inherited by all requests in collection
- **Purpose**: Show collection-level auth setup
- **Setup**: Collection settings with API Key configured

#### 9. Request-Level Authentication Override (Basic Auth)
- **Location**: `09-auth-request-basic.png`
- **Shows**: Single request's Auth tab, Basic Authentication selected with username/password
- **State**: Visual indication this overrides collection auth
- **Purpose**: Demonstrate request-level override capability
- **Setup**: Request with Basic Auth instead of collection's API Key

#### 10. Environments Management
- **Location**: `10-environments-panel.png`
- **Shows**: Environment selector dropdown/panel open showing Development, Staging, Production environments
- **State**: Variables visible for each (base_url, api_key, timeout, etc.)
- **Purpose**: Teach environment setup and switching
- **Setup**: 3 pre-configured environments in collection

#### 11. Variables in Active Use
- **Location**: `11-variables-interpolation.png`
- **Shows**: Request URL with `{{base_url}}/users/{{user_id}}`, Headers with `{{api_token}}`, Body with `{{region}}`
- **State**: Development environment selected, showing interpolated values
- **Purpose**: Show real variable interpolation
- **Setup**: Execute request and highlight variable replacement

#### 12. Response Body - Formatted JSON
- **Location**: `12-response-body-formatted.png`
- **Shows**: Beautiful formatted JSON with syntax highlighting, collapsible objects
- **State**: Complex nested structure from /users response
- **Purpose**: Demonstrate response formatting
- **Setup**: GET /users showing array of complex objects

#### 13. OAuth 2.0 - Authorization Code Flow Setup
- **Location**: `13-oauth-setup.png`
- **Shows**: Auth tab with OAuth 2.0 selected, form fields:
  - Authorization URL: `http://localhost:3000/.well-known/openid-configuration`
  - Token URL: `http://localhost:3000/token`
  - Client ID, Client Secret, Scopes
  - PKCE checkbox (checked)
- **State**: Ready to authenticate
- **Purpose**: Demonstrate OAuth configuration (most complex)
- **Setup**: OAuth pointing to mock server

#### 14. OAuth 2.0 - Token Management
- **Location**: `14-oauth-token-state.png`
- **Shows**: After OAuth flow, shows:
  - Access token (partially masked)
  - Token expiration time
  - Refresh button
  - Refresh token info
- **State**: Token acquired and stored
- **Purpose**: Show token lifecycle
- **Setup**: Run OAuth flow to completion

#### 15. Multiple Tabs - Request Comparison
- **Location**: `15-multiple-tabs.png`
- **Shows**: 3-4 request tabs open simultaneously
  - Tab 1: GET /users (response showing)
  - Tab 2: GET /posts (response showing)
  - Tab 3: POST /posts (request form visible)
- **State**: Multiple requests ready to compare
- **Purpose**: Show tab-based workflow
- **Setup**: Open multiple requests from Example API collection

### TIER 3: Advanced Workflows (5 screenshots)

#### 16. Form-Encoded Body
- **Location**: `16-body-form-encoded.png`
- **Shows**: Body tab, Form option selected, key-value pairs visible
- **State**: Fields like title, body, userId ready to submit
- **Purpose**: Show form submission alternative
- **Setup**: POST request with form body

#### 17. Request Body - Raw Text
- **Location**: `17-body-raw-text.png`
- **Shows**: Body tab, Raw option selected, plain text payload
- **State**: Text visible
- **Purpose**: Show raw body input
- **Setup**: Request with text body

#### 18. Collection Encryption Settings
- **Location**: `18-encryption-settings.png`
- **Shows**: Collection settings, Security/Encryption section
- **State**: "Encrypt collection" toggle visible, password field if enabled
- **Purpose**: Demonstrate encryption feature
- **Setup**: Collection settings screen

#### 19. Import/Export Collections Dialog
- **Location**: `19-import-export.png`
- **Shows**: Settings/menu showing import/export options
- **State**: Dialog or menu item visible
- **Purpose**: Show data portability
- **Setup**: Settings screen

#### 20. Error Handling - 404 Not Found
- **Location**: `20-error-404.png`
- **Shows**: Failed request, 404 status, red error indicator, error message in body
- **State**: Request to non-existent endpoint
- **Purpose**: Show error visibility
- **Setup**: GET `/mock/not-found`

### TIER 4: Optional Advanced (2-3 screenshots)

#### 21. Error Handling - 500 Server Error
- **Location**: `21-error-500.png`
- **Shows**: 500 error with red indicator, detailed error message
- **Setup**: GET `/mock/error`

#### 22. Request Cancellation
- **Location**: `22-cancellation.png`
- **Shows**: In-flight request being cancelled
- **Setup**: GET to `/mock/delay/10` then cancel

---

## Implementation Structure

```
documentation/
├── e2e/
│   ├── screenshots.e2e.ts          # Main screenshot generation test
│   ├── support/
│   │   ├── screenshot-helpers.ts   # Utilities for capturing
│   │   ├── collection-setup.ts     # Workspace initialization
│   │   └── mock-endpoints.ts       # Mock server coordination
│   ├── fixtures/
│   │   ├── example-api.json        # Pre-built collection (JSONPlaceholder structure)
│   │   ├── environments.json       # Pre-configured environments
│   │   └── FIXTURE_README.md       # How to update fixtures
│   └── screenshots/
│       ├── 01-workspace-overview.png
│       ├── 02-collection-hierarchy.png
│       └── ... (all screenshots)
```

## File Structure

**`documentation/e2e/fixtures/github-api-collection.json`** - Pre-built collection
```json
{
  "id": "github-api-collection",
  "name": "GitHub API",
  "description": "Real GitHub API structure with local mock server endpoints",
  "folders": [
    {
      "id": "repos-folder",
      "name": "Repositories",
      "requests": [
        {
          "id": "list-repos",
          "name": "List User Repositories",
          "method": "GET",
          "url": "{{base_url}}/user/repos",
          "headers": {
            "Authorization": "Bearer {{github_token}}",
            "Accept": "application/vnd.github.v3+json"
          }
        },
        {
          "id": "get-repo",
          "name": "Get Repository",
          "method": "GET",
          "url": "{{base_url}}/repos/{{owner}}/{{repo}}"
        }
      ]
    },
    {
      "id": "issues-folder",
      "name": "Issues",
      "requests": [
        {
          "id": "list-issues",
          "name": "List Repository Issues",
          "method": "GET",
          "url": "{{base_url}}/repos/{{owner}}/{{repo}}/issues?state={{state}}&labels={{labels}}"
        },
        {
          "id": "create-issue",
          "name": "Create Issue",
          "method": "POST",
          "url": "{{base_url}}/repos/{{owner}}/{{repo}}/issues",
          "body": {
            "title": "New Feature Request",
            "body": "Description here",
            "labels": ["enhancement"]
          }
        }
      ]
    }
  ],
  "environments": [
    {
      "name": "Development",
      "variables": {
        "base_url": "http://localhost:3000/mock/github",
        "github_token": "ghp_dev_token_123456",
        "owner": "newty",
        "repo": "knurl",
        "state": "open",
        "labels": "bug,help-wanted"
      }
    },
    {
      "name": "Production",
      "variables": {
        "base_url": "http://localhost:3000/mock/github",
        "github_token": "ghp_prod_token_789012",
        "owner": "octocat",
        "repo": "Hello-World"
      }
    }
  ]
}
```

---

## Mock Server Enhancement

Enhance `scripts/oauth-mock-server.mjs` with GitHub API mock endpoints:

### Existing & Good ✓
- `/mock/json` - Generic JSON endpoint
- `/mock/post` - POST with form data
- `/mock/status/:code` - Error responses
- OAuth endpoints already configured

### GitHub API Endpoints to Add (under `/mock/github`)

1. **`GET /mock/github/user/repos`** - List authenticated user's repositories
   ```json
   [
     {
       "id": 1,
       "name": "knurl",
       "full_name": "newty/knurl",
       "owner": {"login": "newty", "id": 1},
       "private": false,
       "description": "Desktop HTTP client",
       "url": "https://api.github.com/repos/newty/knurl",
       "language": "TypeScript",
       "stargazers_count": 42
     }
   ]
   ```

2. **`GET /mock/github/repos/:owner/:repo`** - Get single repository
   ```json
   {
     "id": 1,
     "name": "knurl",
     "full_name": "newty/knurl",
     "private": false,
     "description": "Desktop HTTP client",
     "language": "TypeScript",
     "stargazers_count": 42,
     "forks_count": 5
   }
   ```

3. **`GET /mock/github/repos/:owner/:repo/issues`** - List issues with query params
   - Supports: `?state=open|closed&labels=bug,feature&limit=10`
   ```json
   [
     {
       "id": 1,
       "number": 1,
       "title": "Add dark mode support",
       "body": "Users request dark mode...",
       "state": "open",
       "labels": [{"name": "enhancement"}],
       "created_at": "2024-10-01T12:00:00Z"
     }
   ]
   ```

4. **`POST /mock/github/repos/:owner/:repo/issues`** - Create issue
   - Accepts body with title, body, labels
   - Returns created issue object

5. **`GET /mock/github/repos/:owner/:repo/issues/:number`** - Get single issue

6. **`GET /mock/github/users/:username`** - Get user profile
   ```json
   {
     "login": "octocat",
     "id": 1,
     "name": "The Octocat",
     "company": "GitHub",
     "blog": "https://github.blog",
     "public_repos": 2,
     "followers": 3938
   }
   ```

### Benefits of GitHub Mock Endpoints
- Developers recognize the structure immediately
- Real-world API complexity for demonstrations
- Can show issue creation (POST), filtering (query params), pagination
- Shows realistic authentication (Bearer token)

---

## Testing & Iteration

1. **Create fixture once**: Build `example-api.json` with realistic structure
2. **Test E2E**: Run screenshot generation, verify all endpoints work
3. **Iterate screenshots**: Add/remove/adjust screenshots as needed
4. **Version fixture**: Commit fixture to repo, treat as documentation resource
5. **Update workflows**: When API changes, update fixture

---

## Timeline Estimate

- **Phase 1** (Current): Plan & infrastructure setup
- **Phase 2**: Build example-api.json fixture
- **Phase 3**: Create screenshot generation test framework
- **Phase 4**: Capture screenshots (20-22 total)
- **Phase 5**: Embed in documentation and test

---

## Success Criteria

- ✓ All screenshots use only internal mock server endpoints
- ✓ Workspace looks mature and professional
- ✓ Each feature has at least one clear screenshot
- ✓ E2E test is deterministic and repeatable
- ✓ Screenshots auto-update when UI changes
- ✓ Fixture can be easily updated/extended

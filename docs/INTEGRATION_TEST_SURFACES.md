# Integration Test Surfaces - Step 1 Analysis

This document identifies all backend surface areas that integration tests need to expose and verify. These are the minimal, generic bridge methods needed to support all integration test scenarios.

## Core Bridge Methods (Verified Required)

Based on the INTEGRATION_TEST_STRATEGY.md and existing bridge-replacement.ts, the following methods are essential:

### Collections Management
- **`createCollection(name: string)`** - Create a new collection
- **`getCollection(id: string)`** - Retrieve collection data from disk
- **`updateCollection(id: string, updates: any)`** - Update collection
- **`deleteCollection(id: string)`** - Delete collection

### Request Operations
- **`createRequest(collectionId: string, data: any)`** - Create request in collection
- **`getRequest(collectionId: string, requestId: string)`** - Get request data
- **`updateRequest(collectionId: string, requestId: string, updates: any)`** - Update request
- **`deleteRequest(collectionId: string, requestId: string)`** - Delete request
- **`sendRequest(collectionId: string, requestId: string)`** - Execute HTTP request, return response

### Environment Variables
- **`createEnvironment(collectionId: string, name: string)`** - Create environment
- **`updateEnvironment(collectionId: string, envId: string, variables: any)`** - Set variables
- **`deleteEnvironment(collectionId: string, envId: string)`** - Delete environment

### Authentication
- **`setRequestAuth(collectionId: string, requestId: string, authConfig: any)`** - Configure auth for request
- **`resolveAuth(authConfig: any, context: any)`** - Resolve auth (fetch token, apply scheme)
- **`getAuthCache(requestId: string)`** - Verify auth was cached

### Persistence & Verification
- **`getWorkspaceSnapshot()`** - Get current app state (tabs, environments, collections)
- **`loadAppData(filePath: string)`** - Read file from app data dir (for verification)
- **`saveAppData(filePath: string, data: any)`** - Write test files
- **`deleteAppData(filePath: string)`** - Clean up test files
- **`getAppDataDir()`** - Get app data directory path

### Response Handling
- **`getLastResponse()`** - Retrieve last executed response (status, headers, body)
- **`parseResponse(rawResponse: any, contentType: string)`** - Parse response body

---

## Integration Test Scenarios

### 1. Request Lifecycle (25 tests needed)

**Surface areas:**
- `createRequest()` + `sendRequest()` + `getLastResponse()`
- `updateRequest()` for path params, query params, headers
- `setRequestAuth()` + `sendRequest()` + verify auth header injected
- `createEnvironment()` + `updateEnvironment()` + `sendRequest()` → variables substituted

**Scenarios:**
- Path parameter substitution (single, multiple, special chars)
- Query parameter encoding (arrays, special chars)
- Header merging (request + auth + defaults)
- Cookie serialization and merging
- URL construction (all components)
- Basic auth encoding → header injection
- Bearer token placement (header/query/cookie)
- API key placement (header/query/cookie)
- OAuth2 token fetch and caching
- Environment variable substitution (single, multiple, nested)
- Secure variable handling (not logged)
- Variable precedence (collection vs global)

### 2. Collections Persistence (30 tests needed)

**Surface areas:**
- `createCollection()` + verify disk file saved via `loadAppData()`
- `updateCollection()` + verify disk file changed
- `deleteCollection()` + verify disk file deleted
- `loadAppData()` on collection index + verify encryption at rest
- `createRequest()` + verify persisted in collection file

**Scenarios:**
- Collection created → saved to disk with unique ID
- Collection updated → changes reflected in file
- Collection deleted → file removed from disk
- Multiple collections → all saved correctly
- Concurrent saves → no corruption
- Rapid updates → final state consistent with disk
- Collection file encrypted at rest (not plaintext JSON)
- Decrypt file → matches in-memory state
- Encryption key management (system keyring)
- Corrupted encrypted file → graceful recovery
- Collection index file consistency
- Malformed index → graceful recovery
- Missing collection file referenced in index → handled

### 3. Workspace State (15 tests needed)

**Surface areas:**
- `getWorkspaceSnapshot()` before/after UI actions
- `loadAppData("workspace.json")` to verify persistence
- Tab management + reload simulation

**Scenarios:**
- Open tabs → persisted in workspace file
- Active tab → restored after reload
- Tab closed → removed from file
- Multiple tabs → all restored
- Environment selection → persisted per collection
- Environment switched → selection persisted
- Environment deleted → selection reset to default

### 4. Request Execution (20 tests needed)

**Surface areas:**
- `sendRequest()` with various request types
- `getLastResponse()` to verify response handling
- Mock server endpoints for different content types

**Scenarios:**
- HTTP request sent → backend invokes, returns response
- HTTP response parsed (JSON, XML, HTML, text)
- HTTP error (4xx, 5xx) → error details returned
- HTTP timeout → timeout error returned
- HTTP redirect → followed correctly (with redirect count)
- Cookies received → stored in jar
- Cookies sent → from jar in subsequent requests
- WebSocket connection (if applicable)
- Large response bodies → handled without corruption
- Binary responses → preserved correctly

### 5. Import/Export (15 tests needed)

**Surface areas:**
- Collection import from various formats
- Collection export to various formats
- Validation and error handling

**Scenarios:**
- Postman import → collection created with requests
- Insomnia import → collection created
- OpenAPI import → requests generated from spec
- Import duplicate → merge options presented
- Invalid data → validation errors
- Export collection → file contains all data
- Export with secure variables → excluded
- Export to Postman format → compatible
- Export to OpenAPI format → valid spec

---

## Bridge Method Implementation Strategy

### Minimal, Generic API

The bridge should provide:

1. **CRUD for core entities**: `create`, `get`, `update`, `delete` + entity type
2. **Execution**: `sendRequest` for HTTP, `resolveAuth` for auth flows
3. **State access**: `getWorkspaceSnapshot`, `loadAppData`
4. **Response retrieval**: `getLastResponse`
5. **No permutations**: Single `sendRequest`, not `sendJsonRequest`, `sendFormRequest`, etc.

### Implementation Phases

**Phase 1 (MVP):**
- Collections CRUD
- Request CRUD
- sendRequest (basic HTTP)
- getWorkspaceSnapshot
- loadAppData/saveAppData

**Phase 2:**
- Environment CRUD + substitution
- Auth resolution
- Auth caching verification

**Phase 3:**
- Response parsing
- Import/Export
- Advanced scenarios

---

## Summary

**Total bridge methods needed: ~25-30**

These are generic, composable methods that can support 100+ integration tests across all areas:
- Request lifecycle
- Persistence & encryption
- Workspace state
- Request execution
- Import/export

No need for specialized methods like `createJsonRequest`, `createBasicAuth`, etc. - the bridge stays small and the tests compose these scenarios.

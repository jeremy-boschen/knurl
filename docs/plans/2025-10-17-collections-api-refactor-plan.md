# Collections API Refactor (2025-10-17)

- [x] Add dev-only diagnostics around `assertCollectionLoaded` failures. (COMPLETED - see src-ui/src/state/collections/core.ts:41-98)
- [x] Draft focused request mutator surface (types + helpers) to replace `updateRequestPatch`. (COMPLETED - all mutators defined in types/collections/api.ts)
- [x] Implement first targeted mutator and migrate hardest caller off the generic updater. (COMPLETED - all mutators implemented in request-ops.ts)
- [x] Introduce dedicated authentication mutator and migrate UI/hooks. (COMPLETED - setRequestAuthentication exists with tests)
- [x] Capture unit coverage for new body/auth mutators. (COMPLETED - see collections.test.ts:199-453)
- [x] Swap remaining path param flows to `updateRequestPatchPathParam`. (COMPLETED - all usages migrated)
- [x] Introduce request options/auto-save mutators; migrate hook usage. (COMPLETED - updateRequestOptions + setRequestAutoSave implemented)
- [x] Design request metadata setters (name, method, URL) and update RequestTabs/general callsites. (COMPLETED - setRequestName, setRequestMethod, setRequestUrl)
- [x] Update tests + RequestTabs helper once metadata mutators exist. (COMPLETED - tests verify all mutators)
- [x] Identify remaining generic `updateRequestPatch` consumers (definition + unit tests only). (COMPLETED - NO callers found)
- [x] Remove generic patch API from surface; confirm no callers remain and tests cover replacements. (COMPLETED - no updateRequestPatch in API surface)

## Final Status: ✅ COMPLETE

All tasks have been successfully implemented. The refactor replaces the generic `updateRequestPatch` with focused mutators:
- Parameter mutators: `updateRequestPatchQueryParam`, `updateRequestPatchPathParam`, `updateRequestPatchHeader`, `updateRequestPatchCookieParam`
- Body mutators: `updateRequestBody`, `setRequestBodyFormField`
- Auth mutator: `setRequestAuthentication`
- Options mutators: `updateRequestOptions`, `setRequestAutoSave`
- Metadata setters: `setRequestName`, `setRequestMethod`, `setRequestUrl`

Test Results:
- Frontend: 660 tests passed
- Backend: 214 tests passed
- Total: 874 tests passed, 0 failed

#tag:plan #tag:collections #tag:api

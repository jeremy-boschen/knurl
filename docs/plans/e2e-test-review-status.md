# E2E Test Review & Refactoring Status

Tracking progress of reviewing and fixing failing E2E tests to comply with UI-only discipline.

## Review Checklist

Format:
- **Test File:** Name of the test
- **Status:** Not Started, In Review, Needs Refactor, Needs Integration, Needs Unit, Refactored, Deleted
- **Notes:** Details about what needs to be done

---

### Collection Tests

- [ ] `collection-encryption.e2e.ts` - **Needs Integration** - Uses backend file access for verification
- [ ] `collection-merge.e2e.ts` - **Needs Integration** - Uses analyze_merge bridge method
- [ ] `collection-storage.e2e.ts` - **Needs Integration** - Uses get_collection bridge method to read disk state
- [x] `large-collections.e2e.ts` - **Refactored** - Converted to pure E2E with UI loops
- [ ] `collections-flow.e2e.ts` - **Not Started**
- [ ] `collections-management.e2e.ts` - **Not Started**

### Request Tests

- [ ] `request-authoring.e2e.ts` - **Not Started**
- [ ] `response-analysis.e2e.ts` - **Not Started**
- [ ] `request-network-errors.e2e.ts` - **Not Started**
- [ ] `request-cancellation.e2e.ts` - **Not Started**

### Auth Tests

- [ ] `auth-strategies.e2e.ts` - **Not Started**
- [ ] `oauth-flows.e2e.ts` - **Not Started**
- [ ] `oauth-ui-flows.e2e.ts` - **Not Started**

### Workspace Tests

- [ ] `workspace-restore.e2e.ts` - **Not Started**
- [ ] `scratch-collection.e2e.ts` - **Not Started**

### Environment Tests

- [ ] `environment-management.e2e.ts` - **Not Started**
- [ ] `variable-interpolation.e2e.ts` - **Not Started**

### Other Tests

- [ ] `app.e2e.ts` - **Not Started**
- [ ] `tauri-integration.e2e.ts` - **Not Started**
- [ ] `launch-hydration.e2e.ts` - **Not Started**
- [ ] `ui-library.e2e.ts` - **Not Started**
- [ ] `theme-settings.e2e.ts` - **Not Started**
- [ ] `large-payloads.e2e.ts` - **Not Started**

---

## Summary

**Total Tests:** 24
**Not Started:** 20
**In Review:** 0
**Needs Refactor:** 0
**Needs Integration:** 3
**Needs Unit:** 0
**Refactored:** 1
**Deleted:** 0


# 2025-10-14 Auto Docs Linux Plan

- [x] Restore WDIO config to Linux default workflow.
- [x] Ensure auto-docs E2E spec leans on `data-test-id` selectors.
- [x] Update WebDriver setup to match platform (WebKitWebDriver on Linux).
- [ ] Guard clipboard plugin in tests so Linux driver can boot without DBus.
- [x] Perform focused test run or capture follow-up blockers.

Notes:
- Save button now exposes `data-test-id="request-workspace:save-button"`.
- Utility sheets expose `data-test-id` on root containers for stable selection.
- WDIO resolves WebKitWebDriver or msedgedriver based on platform; override via `KNURL_NATIVE_DRIVER` if needed.

# Logging Implementation Plan

**Date:** 2025-12-11
**Task:** Add comprehensive logging support to frontend and backend

## Overview

Replace all `console.log/warn/error` in the frontend and `println!/dbg!` in the backend with structured logging that writes to:
- Console (for development/debug builds)
- File (in application data directory, always)

## Current State

**Frontend:**
- `@tauri-apps/plugin-log` v2.7.1 already installed
- Multiple `console.log/warn/error` calls scattered throughout src-ui and test files
- No centralized logger utility

**Backend:**
- `log` crate (0.4) already in dependencies
- `tauri-plugin-log` (2) already configured
- Some `println!` and `dbg!` macro usage

## Implementation Plan

### Phase 1: Frontend Logger Utility
1. Create `src-ui/src/lib/logger.ts` - wrapper around Tauri log plugin
2. Export factory function: `getLogger(module: string)` returning logger with methods:
   - `info(msg: string, meta?: object)`
   - `warn(msg: string, meta?: object)`
   - `error(msg: string, meta?: object)`
   - `debug(msg: string, meta?: object)`
3. Configure module names as stack traces for better debugging

### Phase 2: Frontend Migrations
1. Replace all `console.log` → `logger.info()`
2. Replace all `console.warn` → `logger.warn()`
3. Replace all `console.error` → `logger.error()`
4. Preserve context/metadata in meta parameter where helpful

**Files to update (priority order):**
- src-ui/test/e2e-bridge.ts
- src-ui/src/components/utility-sheets/settings/sections/about.tsx
- src-ui/src/components/utility-sheets/settings/sections/appearance.tsx
- src-ui/src/components/utility-sheets/settings/sections/theme-selector.tsx
- src-ui/src/components/utility-sheets/collection-settings/collection-auth-panel.tsx
- src-ui/src/components/ui/knurl/dialog.test.tsx
- Scan entire src-ui for remaining console calls

### Phase 3: Backend Logger Utility
1. Create `src-tauri/src/logging.rs` - wrapper around `log` crate
2. Initialize logger in main.rs with appropriate level based on debug/release
3. Provide macros/functions:
   - `info!(msg, ...)`
   - `warn!(msg, ...)`
   - `error!(msg, ...)`
   - `debug!(msg, ...)`

### Phase 4: Backend Migrations
1. Replace all `println!` with `log::info!` or similar
2. Replace all `dbg!` with `log::debug!`
3. Update error handling to use logging instead of prints
4. Ensure all critical paths log appropriately

**Files to audit:**
- src-tauri/src/main.rs
- src-tauri/src/http_client/
- src-tauri/src/app_data/
- All other Rust modules

### Phase 5: Testing & Verification
1. Run `yarn test:check` (unit + E2E critical tests)
2. Verify log files are created in app data directory
3. Check console output in dev mode
4. Verify no broken logging in production build

## Success Criteria

- [ ] All console.log/warn/error replaced or justified
- [ ] All println!/dbg! replaced with log macros
- [ ] Logging writes to file in app directory
- [ ] Console output in dev builds still works
- [ ] No regressions in tests
- [ ] Log levels appropriate (info/warn/error/debug)

## Notes

- Tauri log plugin handles file rotation and setup
- Use structured logging with metadata where context is important
- Keep log levels practical: info for user actions, debug for internal flow
- Module names help with filtering logs later

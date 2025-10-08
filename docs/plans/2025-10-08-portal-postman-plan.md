# Portal Packaging & Postman Import Plan

## Intent
- Deliver a distributable "portal install" zip that wraps platform-specific Knurl builds (Windows exe, macOS dmg/app, Linux AppImage) for manual distribution.
- Add first-class support for importing Postman collections into Knurl.

## Live Task List
- [x] Audit current build outputs (`yarn tauri build`, CI artifacts) and confirm platform targets available/needed.
- [x] Define packaging pipeline for the portal zip (structure, naming, automation surface).
- [x] Prototype local packaging script/workflow and document required environment preconditions.
- [ ] Survey existing request collection data structures/APIs to identify integration points for Postman imports.
- [ ] Design Postman collection import flow (parsing, validation, transformation to internal schema, UI entry point).
- [ ] Implement backend/frontend changes for Postman import, including tests.
- [ ] Validate packaging and Postman import flows end-to-end; capture follow-up gaps.

## Notes & Open Questions
- Confirm whether portal output should bundle all platforms in one archive or per-platform zips.
- Check licensing/redistribution requirements for any runtime dependencies included in the packaged artifacts.
- Need clarity on Postman collection version(s) to support (v2.1 recommended?) and handling of environments.

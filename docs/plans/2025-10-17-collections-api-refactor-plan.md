# Collections API Refactor (2025-10-17)

- [x] Add dev-only diagnostics around `assertCollectionLoaded` failures.
- [x] Draft focused request mutator surface (types + helpers) to replace `updateRequestPatch`.
- [x] Implement first targeted mutator and migrate hardest caller off the generic updater.
- [x] Introduce dedicated authentication mutator and migrate UI/hooks.
- [x] Capture unit coverage for new body/auth mutators.
- [x] Swap remaining path param flows to `updateRequestPatchPathParam`.
- [x] Introduce request options/auto-save mutators; migrate hook usage.
- [x] Design request metadata setters (name, method, URL) and update RequestTabs/general callsites.
- [x] Update tests + RequestTabs helper once metadata mutators exist.
- [x] Identify remaining generic `updateRequestPatch` consumers (definition + unit tests only).
- [x] Remove generic patch API from surface; confirm no callers remain and tests cover replacements.

#tag:plan #tag:collections #tag:api

# Collections API Migration (2025-10-19)

- `collectionsApi.setCollectionsIndex` was removed; index mutation now flows through `reorderCollections` and storage is handled internally.
- UI consumers must rely on hooks (`useCollection`, `useCollections`) instead of calling `collectionsApi().getCollection` for read access. The hooks enforce the loaded-only invariant and shield components from direct store wiring.
- `collectionsApi().getCollection` remains available for non-React callers once `loadCollection` has resolved.
- Folder/request move helpers now centralise ordering and ancestry updates (`moveRequestToFolder`, `reorderFolders`, `updateRequest` when changing `folderId`); ensure downstream code does not mutate folder `requestIds` arrays directly.
- New regression coverage guards request patch equality, request move ordering, and post-merge index integrity. Keep new tests passing before shipping further API edits.

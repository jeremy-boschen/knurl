# Workspace restore tests plan

- [x] Review existing workspace restore e2e spec and persistence helpers
- [x] Split the scenario into setup/restore specs sharing a config directory
- [x] Adjust helpers or fixtures to reuse the config directory between specs safely
- [ ] Run or document verification steps for the updated e2e workflow
  - Suggested: `yarn test:e2e --spec test/specs/workspace-restore.e2e.ts`

# Worktree Script Plan (2025-10-05)

- [x] Review existing worktree helper and requirements for local-only tracking.
- [x] Design script flow ensuring worktree follows local branch without remote pulls.
- [x] Implement helper script and validate configuration against requirements.

## Notes
- Script must prefix worktree with `wsl-` and place under target directory.
- Ensure `git pull` inside worktree fetches from local branch only.

# Release Workflow Plan (2025-10-05)

- [x] Inspect failing checksum step and confirm root cause.
- [x] Update GitHub Actions workflow to generate checksums with Windows-native tooling.
- [x] Split release pipeline into build/upload and release publish stages; use `gh` CLI for drafting releases (2025-10-05).
- [x] Document change and suggest validation via rerun.

## Notes
- Replaced missing `shasum` call with PowerShell `Get-FileHash`, parsing the JSON artifact list from `tauri-action` and staging outputs in `%RUNNER_TEMP%`.

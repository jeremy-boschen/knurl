# Knurl Release Process (MVP)

This document describes how to cut an MVP release. CI automation (GitHub Actions) drafts a release on tag push for Windows.

## Versioning

- Use semantic versioning: `vX.Y.Z` tags on the repository.
- Bump the version in `src-tauri/tauri.conf.json` before tagging.

## Pre‑release Checklist

- App metadata verified in `src-tauri/tauri.conf.json` (productName, version, identifier, icons).
- Bundler set to NSIS for Windows (`bundle.targets = "nsis"`).
- Tests pass locally: `yarn test`.
- Build succeeds locally: `yarn tauri build` on Windows.
- CHANGELOG.md updated with the new version and notes.

## Building Artifacts (Manual)

1. Ensure Node/Yarn and Rust toolchain are installed.
2. Install dependencies: `yarn install`.
3. Build the app:
   - Windows: `yarn tauri build`
   - macOS/Linux (optional unsigned artifacts): `yarn tauri build`
4. Locate outputs under `src-tauri/target/release/bundle/`:
   - Windows: `*.exe` (NSIS installer)
   - macOS: `*.dmg` (unsigned)
   - Linux: `*.AppImage` (unsigned)

## Checksums

From the bundle directory, compute SHA256 checksums for each artifact (the GitHub Actions workflow also computes and uploads `.sha256` files for Windows bundles):

```
shasum -a 256 <artifact> > <artifact>.sha256
# Windows (PowerShell)
Get-FileHash -Algorithm SHA256 .\Knurl-Setup-x.y.z.exe | Format-List
```

## Creating the Release (Manual)

1. Create tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. If not using CI, draft a GitHub Release for the tag.
3. Upload artifacts and their `.sha256` checksum files.
4. Paste highlights from CHANGELOG.md, include known issues, and installation notes (WebView2 on Windows).
5. Publish the Release.

## Post‑release

- Smoke test the installer on a clean Windows machine/VM.
- Create a follow‑up issue to enable CI workflows for automated multi‑OS builds.

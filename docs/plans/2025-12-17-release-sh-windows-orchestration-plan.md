# Release script: Windows orchestrates, WSL builds Linux

## Checklist

- [x] Build Windows inside of Windows.
- [x] Build Linux inside of WSL.
- [x] Update version (bump + commit) from Windows if required (before building, to get a stable commit id).
- [x] Push to GitHub from Windows if required, only when the build succeeded.
- [x] Update GitHub release artifacts from Windows if required, only when the build succeeded.
- [x] If run as `vX.Y.Z windows`: bump+commit (if required), build Windows, then push/update artifacts.
- [x] If run without a target: do the above + build Linux via WSL, copy Linux artifacts, then continue on Windows.
- [x] Do not run git commands from inside WSL.

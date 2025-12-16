#!/bin/bash
set -euo pipefail

# Release script - sets version, builds Windows + Linux, uploads to GitHub
# Version changes are atomic: either fully committed or fully reverted

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/release/release.sh <version>"
  echo "Example: bash scripts/release/release.sh v0.1.8"
  exit 1
fi

VERSION="$1"

# Cleanup on failure: restore git state
cleanup_on_failure() {
  echo ""
  echo "❌ Release failed. Restoring git state..."
  git checkout package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json 2>/dev/null || true
  exit 1
}

trap cleanup_on_failure ERR

# ============================================================================
# PHASE 1: Validation
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 1: Validation"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Invalid version format: $VERSION"
  echo "Expected format: vX.Y.Z (e.g., v0.1.8)"
  exit 1
fi

VERSION_NUM="${VERSION#v}"
CURRENT_VERSION="$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')"

echo "Current version in files: $CURRENT_VERSION"
echo "Target version to set:    $VERSION_NUM"
echo ""

if [[ "$CURRENT_VERSION" == "$VERSION_NUM" ]]; then
  echo "⚠️  NOTE: Current version already matches target version"
  echo "         Script will re-set version to ensure consistency"
  echo ""
fi

read -p "Continue with this release? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Release cancelled."
  exit 0
fi

# ============================================================================
# PHASE 2: Update version files (not committed yet)
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 2: Update version files"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

echo "Setting version to $VERSION_NUM..."
echo ""
echo "DEBUG: Before update:"
echo "  package.json version line:"
grep '"version"' package.json | head -1
echo "  Cargo.toml version line:"
grep '^version' src-tauri/Cargo.toml | head -1
echo "  tauri.conf.json version line:"
grep '"version"' src-tauri/tauri.conf.json | head -1
echo ""

# Update package.json
echo "DEBUG: Running sed for package.json..."
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_NUM\"/" package.json

# Update Cargo.toml
echo "DEBUG: Running sed for Cargo.toml..."
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION_NUM\"/" src-tauri/Cargo.toml

# Update tauri.conf.json (critical for bundled installers)
echo "DEBUG: Running sed for tauri.conf.json..."
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_NUM\"/" src-tauri/tauri.conf.json

echo ""
echo "DEBUG: After update:"
echo "  package.json version line:"
grep '"version"' package.json | head -1
echo "  Cargo.toml version line:"
grep '^version' src-tauri/Cargo.toml | head -1
echo "  tauri.conf.json version line:"
grep '"version"' src-tauri/tauri.conf.json | head -1
echo ""

# Verify the updates worked
PKG_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
CARGO_VERSION=$(grep "^version" src-tauri/Cargo.toml | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
TAURI_VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

echo "DEBUG: Verification:"
echo "  Expected version: $VERSION_NUM"
echo "  package.json version: $PKG_VERSION"
echo "  Cargo.toml version: $CARGO_VERSION"
echo "  tauri.conf.json version: $TAURI_VERSION"
echo ""

if [[ "$PKG_VERSION" != "$VERSION_NUM" ]]; then
  echo "❌ Failed to update package.json version. Expected $VERSION_NUM, got $PKG_VERSION"
  exit 1
fi

if [[ "$CARGO_VERSION" != "$VERSION_NUM" ]]; then
  echo "❌ Failed to update Cargo.toml version. Expected $VERSION_NUM, got $CARGO_VERSION"
  exit 1
fi

if [[ "$TAURI_VERSION" != "$VERSION_NUM" ]]; then
  echo "❌ Failed to update tauri.conf.json version. Expected $VERSION_NUM, got $TAURI_VERSION"
  exit 1
fi

echo "✓ All version files updated to $VERSION_NUM"

# ============================================================================
# PHASE 3: Clean and reinstall
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: Clean and reinstall"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

yarn build:clean

echo "Reinstalling dependencies for Windows..."
yarn install --immutable

# ============================================================================
# PHASE 4: Build for Windows
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: Build for Windows"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

yarn tauri build

echo "Collecting Windows artifacts..."
mkdir -p dist

echo "DEBUG: Built executable version info:"
if [[ -f "src-tauri/target/release/knurl.exe" ]]; then
  ls -lh "src-tauri/target/release/knurl.exe"
fi

echo "DEBUG: Looking for installer in: src-tauri/target/release/bundle/nsis/"
ls -lh "src-tauri/target/release/bundle/nsis/"*.exe 2>/dev/null || echo "  (no files found)"

cp "src-tauri/target/release/knurl.exe" "dist/knurl-${VERSION_NUM}-x64.exe"

# Find the actual setup.exe that was built (version might differ)
SETUP_EXE=$(ls -1 "src-tauri/target/release/bundle/nsis"/*_x64-setup.exe 2>/dev/null | head -1)
if [[ -z "$SETUP_EXE" ]]; then
  echo "❌ Could not find Windows installer (setup.exe)"
  exit 1
fi

echo "DEBUG: Found installer: $(basename "$SETUP_EXE")"
cp "$SETUP_EXE" "dist/"

# ============================================================================
# PHASE 5: Build for Linux
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 5: Build for Linux"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if grep -qi microsoft /proc/version &> /dev/null; then
  # Already in WSL
  echo "Building in WSL..."

  # Source cargo env if it exists, then check for rust
  if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
  fi

  if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
  fi

  rm -rf node_modules 2>/dev/null || {
    echo "⚠️  Cleaning node_modules failed, retrying with sudo..."
    sudo rm -rf node_modules
  }
  yarn install --immutable
  yarn tauri build

  echo "Collecting Linux artifacts..."
  cp "src-tauri/target/release/knurl" "dist/knurl-${VERSION_NUM}-x64"

  # Find actual appimage and deb files (version might differ)
  APPIMAGE=$(ls -1 "src-tauri/target/release/bundle/appimage"/*.AppImage 2>/dev/null | head -1)
  if [[ -n "$APPIMAGE" ]]; then
    cp "$APPIMAGE" "dist/"
  fi

  DEB=$(ls -1 "src-tauri/target/release/bundle/deb"/*.deb 2>/dev/null | head -1)
  if [[ -n "$DEB" ]]; then
    cp "$DEB" "dist/"
  fi

elif command -v wsl.exe &> /dev/null; then
  # Running on Windows, invoke WSL
  echo "Invoking WSL..."
  wsl.exe bash -c "
    set -euo pipefail

    # Source cargo env if it exists, then check for rust
    if [[ -f \"\$HOME/.cargo/env\" ]]; then
      source \"\$HOME/.cargo/env\"
    fi

    if ! command -v cargo &> /dev/null; then
      echo 'Installing Rust...'
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      source \$HOME/.cargo/env
    fi

    # Clean node_modules (may fail due to Windows lock, try sudo if needed)
    rm -rf node_modules 2>/dev/null || {
      echo '⚠️  Cleaning node_modules failed, retrying with sudo...'
      sudo rm -rf node_modules || true
    }

    yarn install --immutable
    yarn tauri build
  " || return_code=$?

  if [[ ${return_code:-0} -ne 0 ]]; then
    exit $return_code
  fi

  echo "Collecting Linux artifacts..."
  cp "src-tauri/target/release/knurl" "dist/knurl-${VERSION_NUM}-x64"

  # Find actual appimage and deb files (version might differ)
  APPIMAGE=$(ls -1 "src-tauri/target/release/bundle/appimage"/*.AppImage 2>/dev/null | head -1)
  if [[ -n "$APPIMAGE" ]]; then
    cp "$APPIMAGE" "dist/"
  fi

  DEB=$(ls -1 "src-tauri/target/release/bundle/deb"/*.deb 2>/dev/null | head -1)
  if [[ -n "$DEB" ]]; then
    cp "$DEB" "dist/"
  fi

else
  echo "⚠️  Not on Windows/WSL. Skipping Linux build."
fi

# ============================================================================
# PHASE 6: Restore node_modules and commit version changes
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 6: Restore node_modules and commit version changes"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Clean reinstall node_modules (ensure Windows bindings for git hooks)
echo "Reinstalling node_modules for Windows..."
rm -rf node_modules
yarn install --immutable

echo "Staging version files..."
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json

echo "Committing version change..."
git commit -m "chore(release): bump version to $VERSION_NUM"

echo "Creating git tag: $VERSION"
if git rev-parse "$VERSION" &>/dev/null; then
  echo "⚠️  Tag $VERSION already exists locally."
else
  git tag "$VERSION"
fi

echo "Pushing tag to remote..."
git push origin "$VERSION"

# ============================================================================
# PHASE 7: Collect and upload artifacts
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 7: Collect and upload artifacts"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Create zipped versions of artifacts
echo "Creating zipped artifacts..."
for file in dist/*; do
  if [[ -f "$file" ]]; then
    base=$(basename "$file")
    echo "  Zipping $base..."
    zip -j "dist/${base}.zip" "$file" > /dev/null
  fi
done

echo ""
echo "Artifacts to upload:"
ls -lh dist/

echo ""

# Check if release already exists
if gh release view "$VERSION" &>/dev/null; then
  echo "Release $VERSION already exists. Uploading artifacts..."
  # Build list of files to upload
  artifact_files=()
  for file in dist/*; do
    artifact_files+=("$file")
  done
  gh release upload "$VERSION" "${artifact_files[@]}" --clobber
else
  echo "Creating GitHub Release: $VERSION"
  # Build list of files to upload
  artifact_files=()
  for file in dist/*; do
    artifact_files+=("$file")
  done
  gh release create "$VERSION" "${artifact_files[@]}" \
    --draft \
    --title "$VERSION" \
    --notes "See the assets to download this version and install."
fi

# ============================================================================
# PHASE 8: Cleanup
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 8: Cleanup"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

rm -rf dist

echo ""
echo "✅ Release complete: $VERSION"
echo "Review at: https://github.com/jeremy-boschen/knurl/releases/tag/$VERSION"
echo "Publish the draft release when ready."
echo ""

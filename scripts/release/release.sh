#!/bin/bash
set -euo pipefail

# Release script - sets version, builds Windows + Linux, uploads to GitHub
# Version changes are atomic: either fully committed or fully reverted

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/release/release.sh <version> [target]"
  echo "Example: bash scripts/release/release.sh v0.1.8 windows"
  echo "Targets: windows, linux, both (default: both)"
  exit 1
fi

VERSION="$1"
TARGET="${2:-both}"

# Validate target
if [[ ! "$TARGET" =~ ^(windows|linux|both)$ ]]; then
  echo "❌ Invalid target: $TARGET"
  echo "Valid targets: windows, linux, both"
  exit 1
fi

# These will be set in Phase 3
BUILD_TEMP=""

# Cleanup temp directory on any exit
cleanup_temp() {
  if [[ -n "$BUILD_TEMP" && -d "$BUILD_TEMP" ]]; then
    rm -rf "$BUILD_TEMP"
  fi
}

# Cleanup on failure: restore git state and temp
cleanup_on_failure() {
  echo ""
  echo "❌ Release failed. Restoring git state..."
  git checkout package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json 2>/dev/null || true
  cleanup_temp
  exit 1
}

trap cleanup_on_failure ERR
trap cleanup_temp EXIT

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

echo "Current version: $CURRENT_VERSION"
echo "New version:     $VERSION_NUM"
echo ""

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
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_NUM\"/" package.json
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION_NUM\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_NUM\"/" src-tauri/tauri.conf.json

# Verify the updates worked
PKG_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
CARGO_VERSION=$(grep "^version" src-tauri/Cargo.toml | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
TAURI_VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

if [[ "$PKG_VERSION" != "$VERSION_NUM" ]] || [[ "$CARGO_VERSION" != "$VERSION_NUM" ]] || [[ "$TAURI_VERSION" != "$VERSION_NUM" ]]; then
  echo "❌ Failed to update version files"
  exit 1
fi
echo "✓ Version set to $VERSION_NUM"

# ============================================================================
# PHASE 3: Setup build environment
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: Setup build environment"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

MAIN_DIR="$(pwd)"
BUILD_TEMP=$(mktemp -d)
echo "Build directory: $BUILD_TEMP"

mkdir -p "$MAIN_DIR/dist"

# ============================================================================
# PHASE 4: Build for Windows
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: Build for Windows"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if [[ "$TARGET" == "linux" ]]; then
  echo "⏭️  Skipping Windows build (target: linux)"
else
  WINDOWS_WORKTREE="$BUILD_TEMP/windows"
  echo "Creating Windows worktree at $WINDOWS_WORKTREE..."
  git worktree add "$WINDOWS_WORKTREE" HEAD

  cd "$WINDOWS_WORKTREE"

  echo "Installing dependencies..."
  yarn install --immutable

  echo "Building for Windows..."
  yarn tauri build

  echo "Collecting Windows artifacts..."
  cp "src-tauri/target/release/knurl.exe" "$MAIN_DIR/dist/knurl-${VERSION_NUM}-x64.exe"

  # Find the actual setup.exe that was built
  SETUP_EXE=$(ls -1 "src-tauri/target/release/bundle/nsis"/*_x64-setup.exe 2>/dev/null | head -1)
  if [[ -z "$SETUP_EXE" ]]; then
    echo "❌ Could not find Windows installer (setup.exe)"
    exit 1
  fi
  cp "$SETUP_EXE" "$MAIN_DIR/dist/"

  cd "$MAIN_DIR"
  git worktree remove "$WINDOWS_WORKTREE"
fi

# ============================================================================
# PHASE 5: Build for Linux
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 5: Build for Linux"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if [[ "$TARGET" == "windows" ]]; then
  echo "⏭️  Skipping Linux build (target: windows)"
elif grep -qi microsoft /proc/version &> /dev/null; then
  # Already in WSL
  echo "Building in WSL..."

  LINUX_WORKTREE="$BUILD_TEMP/linux"
  git worktree add "$LINUX_WORKTREE" HEAD
  cd "$LINUX_WORKTREE"

  # Install Rust if needed
  if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
  fi

  if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
  fi

  echo "Installing dependencies..."
  yarn install --immutable

  echo "Building for Linux..."
  yarn tauri build

  echo "Collecting Linux artifacts..."
  cp "src-tauri/target/release/knurl" "$MAIN_DIR/dist/knurl-${VERSION_NUM}-x64"

  APPIMAGE=$(ls -1 "src-tauri/target/release/bundle/appimage"/*.AppImage 2>/dev/null | head -1)
  [[ -n "$APPIMAGE" ]] && cp "$APPIMAGE" "$MAIN_DIR/dist/"

  DEB=$(ls -1 "src-tauri/target/release/bundle/deb"/*.deb 2>/dev/null | head -1)
  [[ -n "$DEB" ]] && cp "$DEB" "$MAIN_DIR/dist/"

  cd "$MAIN_DIR"
  git worktree remove "$LINUX_WORKTREE"

elif command -v wsl.exe &> /dev/null; then
  # Running on Windows, invoke WSL to build
  echo "Invoking WSL to build for Linux..."

  # Create a temporary build script for WSL
  BUILD_SCRIPT=$(mktemp)
  cat > "$BUILD_SCRIPT" << 'WSLSCRIPT'
#!/bin/bash
set -euo pipefail

MAIN_DIR="$1"
BUILD_TEMP="$2"
VERSION_NUM="$3"

cd "$MAIN_DIR"

LINUX_WORKTREE="$BUILD_TEMP/linux-wsl"
git worktree add "$LINUX_WORKTREE" HEAD
cd "$LINUX_WORKTREE"

# Install Rust if needed
if [[ -f "$HOME/.cargo/env" ]]; then
  source "$HOME/.cargo/env"
fi

if ! command -v cargo &> /dev/null; then
  echo "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source $HOME/.cargo/env
fi

echo "Installing dependencies..."
yarn install --immutable

echo "Building for Linux..."
yarn tauri build

echo "Collecting Linux artifacts..."
cp "src-tauri/target/release/knurl" "$MAIN_DIR/dist/knurl-${VERSION_NUM}-x64"

APPIMAGE=$(ls -1 "src-tauri/target/release/bundle/appimage"/*.AppImage 2>/dev/null | head -1)
[[ -n "$APPIMAGE" ]] && cp "$APPIMAGE" "$MAIN_DIR/dist/"

DEB=$(ls -1 "src-tauri/target/release/bundle/deb"/*.deb 2>/dev/null | head -1)
[[ -n "$DEB" ]] && cp "$DEB" "$MAIN_DIR/dist/"

cd "$MAIN_DIR"
git worktree remove "$LINUX_WORKTREE"
WSLSCRIPT

  wsl.exe bash "$BUILD_SCRIPT" "$MAIN_DIR" "$BUILD_TEMP" "$VERSION_NUM" || return_code=$?
  rm -f "$BUILD_SCRIPT"

  if [[ ${return_code:-0} -ne 0 ]]; then
    exit $return_code
  fi

else
  echo "⚠️  Not on Windows/WSL. Skipping Linux build."
fi

# ============================================================================
# PHASE 6: Commit version changes
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 6: Commit version changes"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

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

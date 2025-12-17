#!/bin/bash
set -euo pipefail

# Release script - sets version, builds Windows + Linux, uploads to GitHub

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/release/release.sh <version> [target]"
  echo "Example: bash scripts/release/release.sh v0.1.8"
  echo "Targets: windows, linux, both (default: both)"
  exit 1
fi

VERSION="$1"
TARGET="${2:-both}"

if [[ ! "$TARGET" =~ ^(windows|linux|both)$ ]]; then
  echo "❌ Invalid target: $TARGET"
  exit 1
fi

MAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ../.. && pwd)"
BUILD_TEMP=""

cleanup_temp() {
  if [[ -n "$BUILD_TEMP" && -d "$BUILD_TEMP" ]]; then
    rm -rf "$BUILD_TEMP"
  fi
}

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
# PHASE 2: Update version files
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 2: Update version files"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

echo "Setting version to $VERSION_NUM..."

# Update package.json - handle various whitespace patterns
sed -i "s/\"version\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"version\": \"$VERSION_NUM\"/g" package.json

# Update Cargo.toml - match version at start of line with optional whitespace
sed -i "s/^version[[:space:]]*=[[:space:]]*\"[^\"]*\"/version = \"$VERSION_NUM\"/g" src-tauri/Cargo.toml

# Update tauri.conf.json - handle various whitespace patterns
sed -i "s/\"version\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"version\": \"$VERSION_NUM\"/g" src-tauri/tauri.conf.json

echo "Verifying version changes..."
PKG_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
CARGO_VERSION=$(grep "^version" src-tauri/Cargo.toml | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
TAURI_VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

echo "  package.json version: $PKG_VERSION"
echo "  Cargo.toml version: $CARGO_VERSION"
echo "  tauri.conf.json version: $TAURI_VERSION"

if [[ "$PKG_VERSION" != "$VERSION_NUM" ]] || [[ "$CARGO_VERSION" != "$VERSION_NUM" ]] || [[ "$TAURI_VERSION" != "$VERSION_NUM" ]]; then
  echo "❌ Failed to update version files"
  echo "  Expected: $VERSION_NUM"
  exit 1
fi
echo "✓ Version set to $VERSION_NUM"

# ============================================================================
# Build functions
# ============================================================================

build_windows() {
  local version_num="$1"
  local build_temp=$(mktemp -d -t knurlb.XXXXXX)

  echo ""
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo "Building for Windows"
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""

  local worktree="$build_temp/windows"
  git worktree add "$worktree" HEAD

  cd "$worktree"

  echo "Installing dependencies..."
  yarn install --immutable

  echo "Building for Windows..."
  yarn tauri build

  echo "Collecting Windows artifacts..."
  mkdir -p "$MAIN_DIR/dist"
  cp "src-tauri/target/release/knurl.exe" "$MAIN_DIR/dist/knurl-${version_num}-x64.exe"

  local setup_exe=$(ls -1 "src-tauri/target/release/bundle/nsis"/*_x64-setup.exe 2>/dev/null | head -1)
  if [[ -z "$setup_exe" ]]; then
    echo "❌ Could not find Windows installer"
    cd "$MAIN_DIR"
    git worktree remove --force "$worktree"
    rm -rf "$build_temp"
    return 1
  fi
  cp "$setup_exe" "$MAIN_DIR/dist/"

  cd "$MAIN_DIR"
  git worktree remove --force "$worktree"
  rm -rf "$build_temp"

  echo "✓ Windows build complete"
}

build_linux() {
  local version_num="$1"
  local build_temp=$(mktemp -d -t knurlb.XXXXXX)

  echo ""
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo "Building for Linux"
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""

  local worktree="$build_temp/linux"
  git worktree add "$worktree" HEAD

  cd "$worktree"

  # Install Rust if needed
  if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
  fi

  if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
  fi

  echo "Installing dependencies..."
  yarn install --immutable

  echo "Building for Linux..."
  yarn tauri build

  echo "Collecting Linux artifacts..."
  mkdir -p "$MAIN_DIR/dist"
  cp "src-tauri/target/release/knurl" "$MAIN_DIR/dist/knurl-${version_num}-x64"

  local appimage=$(ls -1 "src-tauri/target/release/bundle/appimage"/*.AppImage 2>/dev/null | head -1)
  [[ -n "$appimage" ]] && cp "$appimage" "$MAIN_DIR/dist/"

  local deb=$(ls -1 "src-tauri/target/release/bundle/deb"/*.deb 2>/dev/null | head -1)
  [[ -n "$deb" ]] && cp "$deb" "$MAIN_DIR/dist/"

  cd "$MAIN_DIR"
  git worktree remove --force "$worktree"
  rm -rf "$build_temp"

  echo "✓ Linux build complete"
}

# ============================================================================
# PHASE 3: Build
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: Build"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

mkdir -p "$MAIN_DIR/dist"

cd "$MAIN_DIR"

if [[ "$TARGET" == "windows" || "$TARGET" == "both" ]]; then
  build_windows "$VERSION_NUM"
fi

if [[ "$TARGET" == "linux" || "$TARGET" == "both" ]]; then
  if grep -qi microsoft /proc/version 2>/dev/null; then
    # Running in WSL
    build_linux "$VERSION_NUM"
  elif command -v wsl.exe &> /dev/null; then
    # Running on Windows, invoke WSL
    echo "Invoking WSL to build for Linux..."
    wsl.exe bash -c "cd '$MAIN_DIR' && bash scripts/release/release.sh '$VERSION' linux"
  else
    echo "⚠️  Not on Windows/WSL. Skipping Linux build."
  fi
fi

# ============================================================================
# PHASE 4: Commit version changes
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: Commit version changes"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

cd "$MAIN_DIR"

echo "Installing dependencies..."
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
# PHASE 5: Collect and upload artifacts
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 5: Collect and upload artifacts"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

echo "Creating zipped artifacts..."
for file in "$MAIN_DIR/dist"/*; do
  if [[ -f "$file" ]]; then
    base=$(basename "$file")
    echo "  Zipping $base..."
    zip -j "$MAIN_DIR/dist/${base}.zip" "$file" > /dev/null
  fi
done

echo ""
echo "Artifacts to upload:"
ls -lh "$MAIN_DIR/dist/"

echo ""

# Check if release already exists
if gh release view "$VERSION" &>/dev/null; then
  echo "Release $VERSION already exists. Uploading artifacts..."
  gh release upload "$VERSION" "$MAIN_DIR/dist"/* --clobber
else
  echo "Creating GitHub Release: $VERSION"
  gh release create "$VERSION" "$MAIN_DIR/dist"/* \
    --draft \
    --title "$VERSION" \
    --notes "See the assets to download this version and install."
fi

# ============================================================================
# PHASE 6: Cleanup
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 6: Cleanup"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

rm -rf "$MAIN_DIR/dist"

echo ""
echo "✅ Release complete: $VERSION"
echo "Review at: https://github.com/jeremy-boschen/knurl/releases/tag/$VERSION"
echo "Publish the draft release when ready."
echo ""

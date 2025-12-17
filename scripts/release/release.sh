#!/bin/bash
set -euox pipefail

# Release script - sets version, builds Windows + Linux, uploads to GitHub

usage() {
  echo "Usage: bash scripts/release/release.sh <version> [target] [--skip-version-check]"
  echo "Example: bash scripts/release/release.sh v0.1.8"
  echo "Targets: windows, linux, both (default: both)"
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

VERSION="$1"
shift

TARGET="both"
SKIP_VERSION_CHECK=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    windows|linux|both)
      TARGET="$1"
      shift
      ;;
    --skip-version-check)
      SKIP_VERSION_CHECK=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ ! "$TARGET" =~ ^(windows|linux|both)$ ]]; then
  echo "❌ Invalid target: $TARGET"
  exit 1
fi

IS_WSL=0
if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  IS_WSL=1
elif [[ -r /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=1
fi

MAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ../.. && pwd)"
BUILD_TEMP=""

cd "$MAIN_DIR"

cleanup_temp() {
  if [[ -n "$BUILD_TEMP" && -d "$BUILD_TEMP" ]]; then
    rm -rf "$BUILD_TEMP"
  fi
}

cleanup_on_failure() {
  echo ""
  echo "❌ Release failed. Restoring git state..."
  if [[ "$IS_WSL" -eq 0 ]]; then
    git checkout package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json 2>/dev/null || true
  fi
  cleanup_temp
  exit 1
}

trap cleanup_on_failure ERR
trap cleanup_temp EXIT

invoke_wsl_linux_build() {
  if ! command -v wsl.exe &> /dev/null; then
    echo "❌ wsl.exe not found. Cannot build Linux from Windows."
    return 1
  fi

  echo "Invoking WSL to build for Linux..."
  # Rely on WSL inheriting the Windows working directory (repo root).
  wsl.exe bash -lc "bash scripts/release/release.sh '$VERSION' linux --skip-version-check"
}

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

if [[ "$IS_WSL" -eq 1 ]]; then
  if [[ "$TARGET" != "linux" ]]; then
    echo "❌ This script must be launched from Windows for target: $TARGET"
    echo "Linux builds run inside WSL (invoked from Windows)."
    exit 1
  fi
  echo "Running inside WSL (Linux build only)."
  SKIP_VERSION_CHECK=1
fi

if [[ "$SKIP_VERSION_CHECK" -eq 0 ]]; then
  read -p "Continue with this release? (y/n) " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
    exit 0
  fi
else
  echo "Skipping version confirmation prompt (--skip-version-check)"
fi

# ============================================================================
# PHASE 2: Update + commit version files (Windows only)
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 2: Update + commit version files"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

cd "$MAIN_DIR"

if [[ "$IS_WSL" -eq 1 ]]; then
  echo "Skipping version update/commit (WSL build only)."
else
  echo "Setting version to $VERSION_NUM..."

  # Update package.json - match semver version pattern
  sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION_NUM\"/g" package.json

  # Update Cargo.toml - match version at start of line with =
  sed -i "s/^version = \"[0-9.]*\"/version = \"$VERSION_NUM\"/g" src-tauri/Cargo.toml

  # Update tauri.conf.json - match version
  sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION_NUM\"/g" src-tauri/tauri.conf.json

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

  echo "Staging version files..."
  git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock

  if git diff --cached --quiet; then
    echo "No version changes to commit (already at $VERSION_NUM)."
  else
    echo "Committing version change..."
    git commit -m "chore(release): bump version to $VERSION_NUM" --no-verify
  fi
fi

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
  mkdir -p "$MAIN_DIR/release-artifacts"
  cp "src-tauri/target/release/knurl.exe" "$MAIN_DIR/release-artifacts/knurl-${version_num}-x64.exe"

  local setup_exe=$(ls -1 "src-tauri/target/release/bundle/nsis"/*_x64-setup.exe 2>/dev/null | head -1)
  if [[ -z "$setup_exe" ]]; then
    echo "❌ Could not find Windows installer"
    cd "$MAIN_DIR"
    git worktree remove --force "$worktree"
    rm -rf "$build_temp"
    return 1
  fi
  cp "$setup_exe" "$MAIN_DIR/release-artifacts/"

  cd "$MAIN_DIR"
  git worktree remove --force "$worktree"
  rm -rf "$build_temp"

  echo "✓ Windows build complete"
}

build_linux() {
  local version_num="$1"
  local build_temp
  build_temp="$(mktemp -d -t knurl-linux.XXXXXX)"

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
  mkdir -p "$MAIN_DIR/release-artifacts"
  cp "src-tauri/target/release/knurl" "$MAIN_DIR/release-artifacts/knurl-${version_num}-x64"

  local appimage=$(ls -1 "src-tauri/target/release/bundle/appimage"/*.AppImage 2>/dev/null | head -1)
  [[ -n "$appimage" ]] && cp "$appimage" "$MAIN_DIR/release-artifacts/"

  local deb=$(ls -1 "src-tauri/target/release/bundle/deb"/*.deb 2>/dev/null | head -1)
  [[ -n "$deb" ]] && cp "$deb" "$MAIN_DIR/release-artifacts/"

  cd "$MAIN_DIR"
  git worktree remove --force "$worktree"
  rm -rf "$build_temp"

  echo "✓ Linux build complete"
}

# ============================================================================
# PHASE 3: Build (Windows orchestrates, WSL builds Linux)
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: Build"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

mkdir -p "$MAIN_DIR/release-artifacts"

cd "$MAIN_DIR"

if [[ "$IS_WSL" -eq 1 ]]; then
  build_linux "$VERSION_NUM"
  exit 0
fi

if [[ "$TARGET" == "windows" || "$TARGET" == "both" ]]; then
  build_windows "$VERSION_NUM"
fi

if [[ "$TARGET" == "linux" || "$TARGET" == "both" ]]; then
  invoke_wsl_linux_build
fi

# ============================================================================
# PHASE 4: Push + release artifacts (Windows only)
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: Push + release artifacts"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

cd "$MAIN_DIR"

echo "Creating git tag: $VERSION"
if git rev-parse "$VERSION" &>/dev/null; then
  LOCAL_TAG_SHA="$(git rev-list -n 1 "$VERSION")"
  HEAD_SHA="$(git rev-parse HEAD)"
  if [[ "$LOCAL_TAG_SHA" != "$HEAD_SHA" ]]; then
    echo "❌ Local tag $VERSION already exists but does not point to HEAD."
    echo "  tag:  $LOCAL_TAG_SHA"
    echo "  HEAD: $HEAD_SHA"
    exit 1
  fi
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

echo "Collecting application artifacts..."
# Collect all files (only binaries/installers should be in dist from build phases)
ARTIFACTS=()
for file in "$MAIN_DIR/release-artifacts"/*; do
  if [[ -f "$file" ]]; then
    ARTIFACTS+=("$file")
    echo "  Found: $(basename "$file")"
  fi
done

if [[ ${#ARTIFACTS[@]} -eq 0 ]]; then
  echo "❌ No artifacts found in dist/"
  cleanup_on_failure
fi

echo ""
echo "Artifacts to upload:"
ls -lh "$MAIN_DIR/release-artifacts"/*

echo ""

# Check if release already exists
if gh release view "$VERSION" &>/dev/null; then
  echo "Release $VERSION already exists. Uploading artifacts..."
  gh release upload "$VERSION" "${ARTIFACTS[@]}" --clobber
else
  echo "Creating GitHub Release: $VERSION"
  gh release create "$VERSION" "${ARTIFACTS[@]}" \
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

rm -rf "$MAIN_DIR/release-artifacts"

echo ""
echo "✅ Release complete: $VERSION"
echo "Review at: https://github.com/jeremy-boschen/knurl/releases/tag/$VERSION"
echo "Publish the draft release when ready."
echo ""

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
  git checkout package.json src-tauri/Cargo.toml 2>/dev/null || true
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

if [[ "$CURRENT_VERSION" == "$VERSION_NUM" ]]; then
  echo "ℹ️  Version is already $VERSION_NUM"
else
  echo "Updating package.json..."
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_NUM\"/" package.json

  echo "Updating Cargo.toml..."
  sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION_NUM\"/" src-tauri/Cargo.toml
fi

# ============================================================================
# PHASE 3: Clean build artifacts
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: Clean build artifacts"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

yarn build:clean

# ============================================================================
# PHASE 4: Build for Windows
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: Build for Windows"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

yarn tauri build

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

else
  echo "⚠️  Not on Windows/WSL. Skipping Linux build."
fi

# ============================================================================
# PHASE 6: Commit version changes (only if builds succeeded)
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 6: Commit version changes"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if [[ "$CURRENT_VERSION" != "$VERSION_NUM" ]]; then
  echo "Staging version files..."
  git add package.json src-tauri/Cargo.toml

  echo "Committing version change..."
  git commit -m "chore(release): bump version to $VERSION_NUM"
fi

echo "Creating git tag: $VERSION"
if git rev-parse "$VERSION" &>/dev/null; then
  echo "⚠️  Tag $VERSION already exists. Skipping tag creation."
else
  git tag "$VERSION"
fi

# ============================================================================
# PHASE 7: Collect and upload artifacts
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 7: Collect and upload artifacts"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

echo "Collecting artifacts..."
mkdir -p release-artifacts
find src-tauri/target/release/bundle -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.appimage" -o -name "*.deb" -o -name "*.dmg" \) -exec cp {} release-artifacts/ \;

echo ""
echo "Artifacts:"
ls -lh release-artifacts/

echo ""
echo "Creating GitHub Release: $VERSION"
gh release create "$VERSION" \
  release-artifacts/* \
  --draft \
  --title "$VERSION" \
  --notes "See the assets to download this version and install."

# ============================================================================
# PHASE 8: Cleanup
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "PHASE 8: Cleanup"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

rm -rf release-artifacts

echo ""
echo "✅ Release complete: $VERSION"
echo "Review at: https://github.com/jeremy-boschen/knurl/releases/tag/$VERSION"
echo "Publish the draft release when ready."
echo ""

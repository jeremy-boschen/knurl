#!/bin/bash
set -euo pipefail

# Release script - bumps version, tags repo, builds Windows + Linux, uploads to GitHub

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/release/release.sh <major|minor|patch>"
  echo "Example: bash scripts/release/release.sh patch"
  exit 1
fi

RELEASE_TYPE="$1"

# Validate release type
if ! [[ "$RELEASE_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo "❌ Invalid release type: $RELEASE_TYPE"
  echo "Expected one of: major, minor, patch"
  exit 1
fi

echo "📦 Preparing $RELEASE_TYPE release"
echo ""

# Update version and commit
echo "🔢 Updating version..."
node scripts/release/update-version.mjs "$RELEASE_TYPE"

# Get the new version from package.json
VERSION="v$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')"
echo "New version: $VERSION"
echo ""

# Create git tag
echo "🏷️  Creating tag: $VERSION"
git tag "$VERSION"

echo ""
echo "🧹 Cleaning build artifacts..."
yarn clean

# Build for Windows
echo "🪟 Building for Windows..."
yarn tauri build

# Build for Linux (in WSL)
echo "🐧 Building for Linux..."
if command -v wsl.exe &> /dev/null; then
  # Running on Windows, invoke WSL
  wsl.exe bash -c "
    set -euo pipefail
    cd '$PWD'

    # Ensure Rust is installed in WSL
    if ! command -v cargo &> /dev/null; then
      echo 'Installing Rust...'
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      source \$HOME/.cargo/env
    fi

    # Rebuild native modules for Linux platform
    echo 'Rebuilding native modules for Linux...'
    rm -rf node_modules
    yarn install --immutable
    yarn tauri build
  "
elif grep -qi microsoft /proc/version &> /dev/null; then
  # Already in WSL - rebuild native modules for Linux platform
  echo "Rebuilding native modules for Linux..."

  # Ensure Rust is installed in WSL
  if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source \$HOME/.cargo/env
  fi

  rm -rf node_modules
  yarn install --immutable
  yarn tauri build
else
  echo "⚠️  Not on Windows/WSL. Skipping Linux build."
  echo "Build on WSL and re-run this script, or manually upload Linux artifacts."
fi

echo ""
echo "📂 Collecting artifacts..."
mkdir -p release-artifacts
find src-tauri/target/release/bundle -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.appimage" -o -name "*.deb" -o -name "*.dmg" \) -exec cp {} release-artifacts/ \;

echo ""
echo "📋 Artifacts collected:"
ls -lh release-artifacts/

echo ""
echo "🚀 Creating GitHub Release: $VERSION"
gh release create "$VERSION" \
  release-artifacts/* \
  --draft \
  --title "$VERSION" \
  --notes "See the assets to download this version and install."

echo ""
echo "✅ Release created as draft: $VERSION"
echo "Review at: https://github.com/jeremy-boschen/knurl/releases/tag/$VERSION"
echo "Publish when ready."

# Cleanup
rm -rf release-artifacts

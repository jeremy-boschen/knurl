#!/bin/bash
set -euo pipefail

# Release script - builds Windows + Linux locally, uploads to GitHub

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/release.sh <version>"
  echo "Example: bash scripts/release.sh v0.1.8"
  exit 1
fi

VERSION="$1"

# Validate version format
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Invalid version format: $VERSION"
  echo "Expected format: v0.1.8"
  exit 1
fi

echo "📦 Building release: $VERSION"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
yarn build:clean

# Build for Windows
echo "🪟 Building for Windows..."
yarn tauri build

# Build for Linux (in WSL)
echo "🐧 Building for Linux..."
if command -v wsl.exe &> /dev/null; then
  # Running on Windows, invoke WSL
  wsl.exe bash -c "cd '$PWD' && rm -rf node_modules && yarn install --immutable && yarn tauri build"
elif grep -qi microsoft /proc/version &> /dev/null; then
  # Already in WSL - rebuild native modules for Linux platform
  echo "Rebuilding native modules for Linux..."
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

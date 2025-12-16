#!/bin/bash
set -euo pipefail

# Release script - sets version, tags repo, builds Windows + Linux, uploads to GitHub

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/release/release.sh <version>"
  echo "Example: bash scripts/release/release.sh v0.1.8"
  exit 1
fi

VERSION="$1"

# Validate version format
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Invalid version format: $VERSION"
  echo "Expected format: vX.Y.Z (e.g., v0.1.8)"
  exit 1
fi

# Extract version without 'v' prefix
VERSION_NUM="${VERSION#v}"

# Get current version
CURRENT_VERSION="$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')"

echo "📦 Release version confirmation"
echo ""
echo "Current: $CURRENT_VERSION"
echo "New:     $VERSION_NUM"
echo ""

# Prompt for confirmation
read -p "Continue with this release? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Release cancelled."
  exit 1
fi

echo ""

# Check if version is already set
if [[ "$CURRENT_VERSION" == "$VERSION_NUM" ]]; then
  echo "ℹ️  Version is already $VERSION_NUM. Skipping version update."
else
  echo "🔢 Updating version..."

  # Update package.json
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_NUM\"/" package.json

  # Update Cargo.toml
  sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION_NUM\"/" src-tauri/Cargo.toml

  # Commit version changes
  git add package.json src-tauri/Cargo.toml
  git commit -m "chore(release): bump version to $VERSION_NUM"

  echo "Version updated: $VERSION_NUM"
fi

echo ""

# Create git tag
echo "🏷️  Creating tag: $VERSION"
if git rev-parse "$VERSION" &>/dev/null; then
  echo "⚠️  Tag $VERSION already exists. Skipping tag creation."
else
  git tag "$VERSION"
fi

echo ""
echo "🧹 Cleaning build artifacts..."
yarn clean

# Build for Windows
echo "🪟 Building for Windows..."
yarn tauri build

# Build for Linux (WSL only)
echo "🐧 Building for Linux..."
if grep -qi microsoft /proc/version &> /dev/null; then
  # In WSL - rebuild native modules for Linux platform
  echo "Rebuilding native modules for Linux..."

  # Ensure Rust is installed in WSL
  if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
  fi

  rm -rf node_modules
  yarn install --immutable
  yarn tauri build
else
  echo "⚠️  Not in WSL. Skipping Linux build."
  echo "Run this script from WSL to build Linux, or manually upload Linux artifacts."
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

#!/usr/bin/env bash
# Rename Tauri build artifacts to consistent naming scheme
# Usage: ./scripts/release/rename-artifacts.sh v0.1.7 x86_64-apple-darwin

set -euo pipefail

VERSION="$1"
TARGET="$2"

# Remove leading 'v' from version if present
VERSION="${VERSION#v}"

# Target platform mapping
case "$TARGET" in
  x86_64-pc-windows-msvc)
    PLATFORM="x86_64-windows"
    # Windows NSIS installer
    if [ -f "src-tauri/target/release/bundle/nsis/knurl_${VERSION}_x64-setup.exe" ]; then
      mv "src-tauri/target/release/bundle/nsis/knurl_${VERSION}_x64-setup.exe" "release-files/knurl-v${VERSION}-${PLATFORM}.exe"
    fi
    ;;
  x86_64-apple-darwin)
    PLATFORM="x86_64-darwin"
    # macOS DMG
    if [ -f "src-tauri/target/release/bundle/macos/knurl.app" ]; then
      dmg_file=$(find src-tauri/target/release/bundle/macos -name "*.dmg" | head -1)
      if [ -n "$dmg_file" ]; then
        cp "$dmg_file" "release-files/knurl-v${VERSION}-${PLATFORM}.dmg"
      fi
    fi
    ;;
  aarch64-apple-darwin)
    PLATFORM="aarch64-darwin"
    # macOS ARM DMG
    dmg_file=$(find src-tauri/target/release/bundle/macos -name "*.dmg" | head -1)
    if [ -n "$dmg_file" ]; then
      cp "$dmg_file" "release-files/knurl-v${VERSION}-${PLATFORM}.dmg"
    fi
    ;;
  x86_64-unknown-linux-gnu)
    PLATFORM="x86_64-linux"
    # Linux AppImage
    if [ -f "src-tauri/target/release/bundle/appimage/knurl_${VERSION}_amd64.AppImage" ]; then
      cp "src-tauri/target/release/bundle/appimage/knurl_${VERSION}_amd64.AppImage" "release-files/knurl-v${VERSION}-${PLATFORM}.AppImage"
    fi
    # Linux DEB
    if [ -f "src-tauri/target/release/bundle/deb/knurl_${VERSION}_amd64.deb" ]; then
      cp "src-tauri/target/release/bundle/deb/knurl_${VERSION}_amd64.deb" "release-files/knurl-v${VERSION}-${PLATFORM}.deb"
    fi
    ;;
  *)
    echo "Unknown target: $TARGET"
    exit 1
    ;;
esac

echo "Renamed artifacts for $TARGET"

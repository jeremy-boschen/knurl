#!/usr/bin/env bash
# Rename Tauri build artifacts to consistent naming scheme
# Usage: ./scripts/release/rename-artifacts.sh v0.1.7 x86_64-apple-darwin

set -euo pipefail

VERSION="$1"
TARGET="$2"

# Remove leading 'v' from version if present
VERSION="${VERSION#v}"

echo "🔍 Renaming artifacts for $TARGET (version: $VERSION)"
echo "---"

# Ensure release-files directory exists
mkdir -p release-files

# Debug: show what's in the bundle directories
if [ -d "src-tauri/target/release/bundle" ]; then
  echo "📦 Contents of src-tauri/target/release/bundle:"
  find src-tauri/target/release/bundle -type f -name "*knurl*" -o -name "*.exe" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.dmg" 2>/dev/null | sort || true
else
  echo "❌ Bundle directory not found: src-tauri/target/release/bundle"
  exit 1
fi
echo "---"

# Target platform mapping
case "$TARGET" in
  x86_64-pc-windows-msvc)
    PLATFORM="x86_64-windows"
    echo "🪟 Processing Windows x64..."

    # Try different possible NSIS installer names
    nsis_dir="src-tauri/target/release/bundle/nsis"
    if [ -d "$nsis_dir" ]; then
      echo "  Looking for .exe in $nsis_dir"
      exe_file=$(find "$nsis_dir" -maxdepth 1 -name "*.exe" | head -1 || true)
      if [ -n "$exe_file" ]; then
        echo "  ✅ Found: $exe_file"
        cp "$exe_file" "release-files/knurl-v${VERSION}-${PLATFORM}.exe"
      else
        echo "  ⚠️  No .exe found in $nsis_dir"
        ls -la "$nsis_dir" || true
      fi
    else
      echo "  ⚠️  NSIS directory not found: $nsis_dir"
    fi
    ;;

  x86_64-apple-darwin)
    PLATFORM="x86_64-darwin"
    echo "🍎 Processing macOS Intel..."

    macos_dir="src-tauri/target/release/bundle/macos"
    if [ -d "$macos_dir" ]; then
      echo "  Looking for .dmg in $macos_dir"
      dmg_file=$(find "$macos_dir" -maxdepth 1 -name "*.dmg" | head -1 || true)
      if [ -n "$dmg_file" ]; then
        echo "  ✅ Found: $dmg_file"
        cp "$dmg_file" "release-files/knurl-v${VERSION}-${PLATFORM}.dmg"
      else
        echo "  ⚠️  No .dmg found in $macos_dir"
        ls -la "$macos_dir" 2>/dev/null || true
      fi
    else
      echo "  ⚠️  macOS bundle directory not found: $macos_dir"
    fi
    ;;

  aarch64-apple-darwin)
    PLATFORM="aarch64-darwin"
    echo "🍎 Processing macOS ARM..."

    macos_dir="src-tauri/target/release/bundle/macos"
    if [ -d "$macos_dir" ]; then
      echo "  Looking for .dmg in $macos_dir"
      dmg_file=$(find "$macos_dir" -maxdepth 1 -name "*.dmg" | head -1 || true)
      if [ -n "$dmg_file" ]; then
        echo "  ✅ Found: $dmg_file"
        cp "$dmg_file" "release-files/knurl-v${VERSION}-${PLATFORM}.dmg"
      else
        echo "  ⚠️  No .dmg found in $macos_dir"
        ls -la "$macos_dir" 2>/dev/null || true
      fi
    else
      echo "  ⚠️  macOS bundle directory not found: $macos_dir"
    fi
    ;;

  x86_64-unknown-linux-gnu)
    PLATFORM="x86_64-linux"
    echo "🐧 Processing Linux x64..."

    # AppImage
    appimage_dir="src-tauri/target/release/bundle/appimage"
    if [ -d "$appimage_dir" ]; then
      echo "  Looking for .AppImage in $appimage_dir"
      appimage_file=$(find "$appimage_dir" -maxdepth 1 -name "*.AppImage" | head -1 || true)
      if [ -n "$appimage_file" ]; then
        echo "  ✅ Found: $appimage_file"
        cp "$appimage_file" "release-files/knurl-v${VERSION}-${PLATFORM}.AppImage"
      else
        echo "  ⚠️  No .AppImage found in $appimage_dir"
        ls -la "$appimage_dir" 2>/dev/null || true
      fi
    else
      echo "  ⚠️  AppImage directory not found: $appimage_dir"
    fi

    # DEB
    deb_dir="src-tauri/target/release/bundle/deb"
    if [ -d "$deb_dir" ]; then
      echo "  Looking for .deb in $deb_dir"
      deb_file=$(find "$deb_dir" -maxdepth 1 -name "*.deb" | head -1 || true)
      if [ -n "$deb_file" ]; then
        echo "  ✅ Found: $deb_file"
        cp "$deb_file" "release-files/knurl-v${VERSION}-${PLATFORM}.deb"
      else
        echo "  ⚠️  No .deb found in $deb_dir"
        ls -la "$deb_dir" 2>/dev/null || true
      fi
    else
      echo "  ⚠️  DEB directory not found: $deb_dir"
    fi
    ;;

  *)
    echo "❌ Unknown target: $TARGET"
    exit 1
    ;;
esac

echo "---"
echo "📁 Final release files:"
ls -lah release-files/ || echo "  (no files)"
echo "✅ Done processing $TARGET"

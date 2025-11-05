# Knurl Installation Guide (MVP)

This guide covers installing the Knurl MVP builds. The MVP targets Windows first; unsigned builds for macOS and Linux may be provided as best‑effort artifacts.

## System Requirements

- Windows 10/11 (x64)
  - Microsoft Edge WebView2 Runtime (Evergreen). If missing, the installer downloads the Evergreen Bootstrapper and installs it automatically.
  - No Rust toolchain required to run the app.
- macOS 12+ (Apple Silicon or Intel) — optional unsigned DMG for testing only.
- Linux (glibc ≥ 2.28) — optional AppImage for testing only.

## Install (Windows)

1. Download the `Knurl-Setup-x.y.z.exe` installer from the GitHub Release matching the version you want.
2. Double‑click the installer. Because the MVP is unsigned, Windows SmartScreen may warn you. Choose “More info” → “Run anyway” if you trust the source.
3. Follow the installer prompts. The app is added to Start Menu and can be uninstalled via “Apps & Features”.

### WebView2 Runtime

Knurl uses the WebView2 runtime. The Windows installer is configured to download and install the Evergreen Bootstrapper automatically if WebView2 is not present.

## Install (macOS, unsigned)

1. Download the `.dmg` from the GitHub Release and open it.
2. Drag Knurl to Applications.
3. First launch may be blocked because the app is unsigned. Right‑click the app → Open → Open.

## Install (Linux, AppImage)

1. Download the `.AppImage` from the GitHub Release.
2. Mark it executable: `chmod +x Knurl-x.y.z.AppImage`.
3. Run it: `./Knurl-x.y.z.AppImage`.

## Uninstall

- Windows: Settings → Apps → Installed apps → Knurl → Uninstall.
- macOS: Move the app to Trash.
- Linux: Delete the AppImage file.

## Privacy & Logging

- No telemetry. The app does not send usage data.
- Logs are emitted to the in‑app console/UI for troubleshooting and are not persisted to disk by default.
- Release builds reduce verbosity (Info level); development builds show Debug.

## Troubleshooting

- SmartScreen warning on Windows: The MVP build is unsigned. Verify the download source (GitHub Releases) and proceed via “More info” → “Run anyway”.
- Missing WebView2: Install the Evergreen WebView2 Runtime, then relaunch the app.
- Startup issues: Try reinstalling, then run from a terminal to view console output.

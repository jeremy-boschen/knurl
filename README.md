# Knurl

[![GitHub release](https://img.shields.io/github/v/release/jeremy-boschen/knurl?logo=github&label=latest)](https://github.com/jeremy-boschen/knurl/releases)
[![Downloads](https://img.shields.io/github/downloads/jeremy-boschen/knurl/total?logo=tauri&label=downloads)](https://github.com/jeremy-boschen/knurl/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**Knurl** is a privacy-first desktop client for exploring, testing, and documenting HTTP APIs. It runs entirely on your
machine—no cloud sync, no telemetry—so you can inspect requests, tweak headers, and ship integrations with confidence.

> ⚠️ **Pre-release builds:** Knurl is still in rapid development. Expect frequent updates and occasional breaking
> changes while we stabilise the MVP.

---

## Highlights

- 🚀 **Powerful request builder** – Compose any HTTP verb, tweak query/path params, and send with a single click.
- 🔐 **Authentication handled** – Quickly swap between Bearer, Basic, API keys, and OAuth2 flows (with discovery
  support).
- 🧩 **Environment variables** – Create collections of variables and inject them with `{{variable}}` syntax across URLs,
  headers, and bodies.
- 📂 **Collections that travel with you** – Group requests, duplicate, import/export, and share native JSON bundles.
- 🧭 **Deep visibility** – Pretty-print JSON, inspect headers, and view raw responses without leaving the app.
- 🖥️ **Cross-platform & offline** – Built with Tauri + React 19; runs on Windows, macOS, and Linux without extra
  services.

## Quick Start

1. **Download** the latest installer from the [Releases page](https://github.com/jeremy-boschen/knurl/releases).
2. **Install & launch** the app for your platform (MSI/EXE on Windows, DMG on macOS, AppImage/Deb/ZIP on Linux).
3. **Create your first request**: choose a method, paste a URL, and hit **Send**.
4. **Organise** requests into collections and environments as your API surface grows.

Need a little more help? Check the in-app tips or open a discussion—Knurl keeps every request local, so feel free to
explore without worrying about upstream services.

## Feature Tour

| Request Builder                                                            | Response Viewer                                                     |
|----------------------------------------------------------------------------|---------------------------------------------------------------------|
| ![Request builder screenshot](docs/assets/screenshots/request-builder.png) | ![Response screenshot](docs/assets/screenshots/response-viewer.png) |

> Don’t see an image above? We’re still capturing production screenshots. Follow the project and watch for updates.

### Roadmap (MVP)

- [ ] GraphQL support with schema introspection

See [`docs/plans`](docs/plans/) for active workstreams.

## Learn More

- 🎥 **Demo video**: _Coming soon_ (we’ll embed a short walkthrough as we approach public beta).
- 🛠️ **Want to build from source or contribute?** Head over to [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for developer
  setup, scripts, and testing guidance.

## Support & Feedback

- 💬 [GitHub Discussions](https://github.com/jeremy-boschen/knurl/discussions) – ask questions, share ideas.
- 🐛 [Issues](https://github.com/jeremy-boschen/knurl/issues) – report bugs or request features.

## License

Knurl is licensed under the [Apache 2.0 License](LICENSE). Feel free to explore, fork, or extend the app—just keep the
notices intact.

---

_Built with Tauri, React 19, and a love for clean HTTP tooling._

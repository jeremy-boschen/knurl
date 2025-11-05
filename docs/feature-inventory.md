# Knurl Feature Inventory

Use this catalog to understand the product surface and the supporting platform guarantees that keep those experiences working. Update entries whenever behaviour changes, and verify each area before shipping modifications.

## Workspace & Navigation

- Tabbed workspace remembers the set of open requests per collection and restores them after restart, including scroll position and active panels.
- Global scratchpad collection offers an always-available canvas for ad-hoc explorations without polluting curated libraries.
- Collections sidebar lists user libraries, respects custom ordering, and reflects request counts and timestamps to signal activity.
- Launch flow hydrates persisted state slices, validates availability of required collections, and invokes post-hydrate callbacks for dependent features.

## Collections & Library Management

- Users can create, rename, duplicate, reorder, and delete collections; every collection is stored locally with per-collection encryption keys.
- Hierarchical folders give each collection an internal tree for organising requests, supporting drag-and-drop between folders.
- Import/export flows produce native JSON bundles that scrub runtime-only secrets before writing to disk, enabling safe sharing.
- Merge workflow analyses differences between an existing collection and an imported bundle, applies non-conflicting updates, and emits a summary for user review.
- Collections track which requests were open when the app was closed so the workspace can repopulate tabs on next launch.

## Request Authoring Experience

- Request builder supports the full HTTP method set, custom URLs, and inline editing for query and path parameters.
- Body composer handles raw text, JSON, form-encoded, and multipart payloads, performing validation and previewing the formatted body.
- Header editor provides toggleable rows, stable ordering, and quick duplication to streamline experimentation.
- Users can clone or rename requests, open the same request in multiple tabs, and manage tab focus without losing unsaved edits.
- Variable interpolation resolves environment variables everywhere in the request—URL, headers, body, and authentication material—before the request is sent.

## Authentication & Authorization

- Built-in strategies cover unauthenticated, Basic, Bearer (with configurable scheme and placement), API Key, and OAuth 2.0 flows.
- OAuth assistance includes credential storage, token acquisition, refresh handling, and discovery document support so users can rely on real-world provider metadata.
- Supported OAuth flows: client credentials, authorization code with PKCE, and device code with timed polling, mirroring production provider expectations.
- Authentication state integrates with collections to keep secrets scoped per collection while allowing quick swapping between strategies inside the request builder.

## Environment & Secret Management

- Collections expose named environment sets, each with key/value pairs that can be toggled on or off to control active substitutions.
- Secure fields keep sensitive values in memory-only form; they are omitted from exports and persisted storage to maintain privacy.
- Users can designate which environment a request uses, with fallback to collection defaults, ensuring reproducible executions across teams.

## Execution & Networking

- Requests execute through a staged pipeline that resolves variables, prepares protocol payloads, performs the HTTP exchange, and gathers telemetry for downstream consumers.
- Long-running calls can be cancelled from the UI; aborts propagate to the native backend that performs the actual network work.
- Errors surface through a unified application error model, enabling consistent messaging whether failures originate from the network, storage, or validation layers.
- Native backend relies on libcurl-based execution to deliver full HTTP compatibility, TLS support, and proxy handling without exposing system credentials.

## Response Analysis

- Response viewer provides formatted JSON, raw payload inspection, and header breakdowns, allowing quick pivots between readability and fidelity.
- Timeline panel captures lifecycle events (DNS lookup, handshake, payload upload/download) with severity filters to aid debugging.
- Binary and large payloads prompt controlled downloads instead of force-loading into memory, protecting stability.
- Metadata such as status, duration, size, redirects, and request/response headers remain accessible even after navigating away from the response panel.

## Storage, Privacy & Resilience

- All user data lives on the local filesystem; there is no cloud sync or telemetry collection.
- Collections, scratch space, and environment data are encrypted at rest using per-collection AES-GCM keys.
- Persistence layer tolerates missing or partially corrupted files, logging recoverable issues and recreating defaults as needed.

## Desktop Integration & Extensibility

- Application ships as a Tauri desktop app, bundling the React front-end with a Rust backend for cross-platform distribution (Windows, macOS, Linux).
- Backend commands cover networking, storage, file export, clipboard helpers, and authentication flows, enabling the UI to stay responsive.
- A dedicated e2e bridge toggles on under test mode so automated suites can call backend capabilities without relying on production UI affordances.
- Platform prerequisites include modern Rust, MSVC, and WebView2 on Windows; installers and CI pipelines validate those versions.

## Quality, Testing & Tooling

- Unit and component tests run under Vitest with React Testing Library, using a custom setup file that mocks native bridges.
- End-to-end coverage relies on WebdriverIO, a bundled OAuth mock server, and tailored configuration to simulate complex authentication exchanges.
- Rust backend is validated with `cargo test`, linted with Clippy (treating warnings as errors), and formatted with `cargo fmt`.
- JavaScript and TypeScript code is linted and formatted via Biome; Lefthook enforces lint/test checks before commits to maintain baseline quality.

## Roadmap & Known Gaps

- Planned enhancement: GraphQL support with schema introspection and a specialized request builder.
- Requested coverage: end-to-end UI flows that configure each OAuth strategy through on-screen controls rather than direct backend invocation.

---

Maintain this inventory as the authoritative view of shipped functionality. Before changing a feature, verify its entry here, capture the intended validation steps, and update the description if behaviour evolves.

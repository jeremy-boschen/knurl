# MVP Release Readiness Plan (2025-10-05)

## Objectives

- Define the concrete work required to ship the Knurl MVP to GitHub Releases with confidence.
- Capture risks, owners (TBD), and validation gates for each focus area.
- Output an actionable checklist that can be tracked to completion before tagging `v0.1.x`.

## Workstreams & Tasks

### 1. Scope, Governance, and Change Control
- [ ] Lock MVP scope and freeze high-risk feature work; document defer/accept decisions in `docs/mvp-release-plan.md`.
- [ ] Establish release criteria (tests, manual QA, security checks) and record in `RELEASE.md`.
- [ ] Define branching/tagging workflow (`main` hard-freeze? release branch?) and communicate to contributors.
- [ ] Ensure semantic version bumps are automated or scripted (npm + Cargo + Tauri config).

### 2. Code Quality Deep-Dive
- [ ] Frontend audit: review critical React surfaces (`src/components/{collections,request-builder,response}`) for TODOs, error handling, and UX papercuts; capture issues in backlog.
- [ ] State integrity review: walk Zustand slices under `src/state/` (collections, request-tabs, environments) for immutability, persistence, and migration coverage.
- [ ] Backend audit: review `src-tauri/src/http_client`, `app_data`, and command handlers for panic paths, unwraps, error mapping.
- [ ] Bindings parity: compare `src/bindings` TypeScript contracts vs Rust commands to ensure schemas and auth enums stay in sync.
- [ ] Remove or track stray console logging / dev flags left in production builds.

### 3. Testing & Quality Assurance
- [ ] Run consolidated checks via `yarn check`; fix outstanding lint/test failures.
- [ ] Frontend coverage sweep: identify critical flows lacking Vitest coverage (imports, auth flows, request execution) and add suites.
- [ ] Backend coverage: add/expand Rust integration tests for HTTP client, encryption, and app data migrations.
- [ ] Manual QA matrix: author smoke/regression test plan covering Windows install, request CRUD, environment switching, OAuth flows.
- [ ] Set up Playwright or e2e automation harness (optional for MVP if manual coverage sufficient).

### 4. Build, Packaging, and Distribution
- [ ] Validate `yarn build` + `yarn tauri build` on Windows/macOS/Linux; record exact toolchain versions used.
- [ ] Audit Tauri config (`src-tauri/tauri.conf.json`) for release flags (disable devtools, confirm CSP, window settings).
- [ ] Evaluate binary size/performance trade-offs (`opt-level = "z"` vs `3`) and adjust if launch perf suffers.
- [ ] Harden release profiles: ensure web assets pre-built, sourcemaps handled correctly, tree-shaking verified.
- [ ] Confirm installer metadata (icons, descriptions) and draft signed certificate path (even if deferred).
- [ ] Ensure artifacts include LICENSE and third-party notices where required.

### 5. Dependency & Security Review
- [ ] Pin Rust dependencies with floating versions (`tokio = "*"`, etc.) to explicit minimum patch versions.
- [ ] Run `cargo audit`, `cargo deny`, `npm audit` (or `yarn npm audit --all`) and triage findings.
- [ ] Validate `third-party-rust-licenses.json` and `THIRD_PARTY_NOTICES.md` are current; regenerate if dependencies changed.
- [ ] Review security posture: WebView CSP, IPC command guardrails, storage encryption defaults (AES-GCM key management).
- [ ] Secret scanning: run `gitleaks` and ensure CI covers it pre-release.

### 6. Documentation & Communications
- [ ] Update README to reflect current architecture (Zod validation, Yarn 4, actual CLI commands) and include screenshots.
- [ ] Refresh INSTALL.md with signed/unsigned status, WebView requirements, and troubleshooting.
- [ ] Prepare CHANGELOG entry for MVP (confirm Unreleased section aligns with final scope).
- [ ] Draft blog post / release announcement copy (audience, key features, known limitations).
- [ ] Create onboarding docs for contributors (coding standards already in AGENTS.md, but public-friendly summary needed).

### 7. CI/CD & Repo Operations
- [ ] Expand GitHub Actions to run lint/tests on PRs (`yarn check`, `cargo test`); add matrix for platforms if feasible.
- [ ] Verify release workflow uploads checksums and artifacts for all target OSes or document manual steps for macOS/Linux.
- [ ] Configure branch protection (required checks, review count) and CODEOWNERS if missing.
- [ ] Enable Dependabot (npm, cargo) or Renovate for ongoing updates.
- [ ] Ensure secrets and signing cert placeholders are documented and stored securely.

### 8. Telemetry, Logging, and Support Readiness
- [ ] Decide on crash/error reporting strategy (even if opting out); document manual log retrieval instructions.
- [ ] Verify in-app log viewer retention and privacy stance are acceptable for release.
- [ ] Prepare troubleshooting KB entries (network failures, TLS errors, auth issues).
- [ ] Define support channel (GitHub Issues template, Discord, email) and update repository settings.

### 9. Post-Release Follow-Up
- [ ] Plan for hotfix cadence and criteria (what merits 0.1.x patch vs defer).
- [ ] Schedule retrospective post-MVP to prioritize backlog.
- [ ] Track telemetry/analytics backlog item for future (if desired) with privacy assessment.

## Deliverables

- Updated documentation (`README.md`, `INSTALL.md`, `RELEASE.md`, CHANGELOG).
- Completed checklists with owners and links to issues/PRs.
- Verified builds and signed artifacts uploaded to GitHub Release draft.
- QA sign-off report and known issues list.

## Timeline (Proposed)

| Week | Focus |
| ---- | ----- |
| Week 1 (Oct 6–10) | Finish audits (code, dependencies), update docs, pin versions. |
| Week 2 (Oct 13–17) | Implement fixes, expand automated testing, validate builds on all OS targets. |
| Week 3 (Oct 20–24) | Final QA pass, draft release notes, freeze main branch. |
| Week 4 (Oct 27–31) | Tag release, publish assets, execute post-release smoke tests. |

## Open Questions

- Do we need notarized macOS builds for MVP, or is unsigned acceptable?
- Is Windows code signing feasible before MVP (cert procurement timeline)?
- Which support channel do we advertise publicly on release day?
- Are we comfortable publishing with current README (requires rewrite) before tag?

---

_Status: Drafted 2025-10-05 by Codex. Update checkboxes as work completes._

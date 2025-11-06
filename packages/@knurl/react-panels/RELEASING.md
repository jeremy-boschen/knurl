# Release Guide

This document describes how to publish a new version of @jeremy-boschen/react-panels to npm.

## Prerequisites

Before you can publish, ensure you have:

1. **npm account** - https://www.npmjs.com/signup
2. **npm token** added to GitHub Secrets (one-time setup - see below)
3. **Write access** to the repository

## One-Time Setup: npm Token

### 1. Generate npm Automation Token

```bash
# Login to npm
npm login

# Generate an automation token
npm token create --type=automation
```

Copy the token that's displayed (starts with `npm_...`).

### 2. Add Token to GitHub Secrets

1. Go to https://github.com/jeremy-boschen/react-panels/settings/secrets/actions
2. Click **"New repository secret"**
3. **Name:** `NPM_TOKEN`
4. **Value:** Paste your npm token (the one starting with `npm_...`)
5. Click **"Add secret"**

✅ **That's it!** You only need to do this once. The GitHub Actions workflow will now be able to publish to npm automatically.

## Publishing a New Version

### Step 1: Update Version Number

Update the version in `package.json`:

```bash
# For a patch release (bug fixes): 0.1.0 → 0.1.1
npm version patch

# For a minor release (new features): 0.1.0 → 0.2.0
npm version minor

# For a major release (breaking changes): 0.1.0 → 1.0.0
npm version major
```

This will:
- Update `package.json`
- Create a git commit: "Bump version to x.y.z"
- Create a git tag: `vx.y.z`

### Step 2: Push Changes

```bash
# Push the commit and tag
git push origin main --tags
```

### Step 3: Create GitHub Release

**Option A: Via GitHub Web UI**

1. Go to https://github.com/jeremy-boschen/react-panels/releases
2. Click **"Draft a new release"**
3. Click **"Choose a tag"** and select the tag you just pushed (e.g., `v0.1.1`)
4. **Release title:** Same as tag (e.g., `v0.1.1`)
5. **Description:** Add release notes (see below for template)
6. Click **"Publish release"**

**Option B: Via GitHub CLI** (faster!)

```bash
# Create a release (replace version and notes)
gh release create v0.1.1 \
  --title "v0.1.1" \
  --notes "
## What's Changed

- Fixed cursor drift during resize drag (#123)
- Improved constraint handling (#124)

## Full Changelog

https://github.com/jeremy-boschen/react-panels/compare/v0.1.0...v0.1.1
"
```

### Step 4: Watch the Magic Happen! ✨

Once you publish the GitHub release, the publish workflow (`.github/workflows/publish.yml`) will automatically:

1. ✅ Checkout the code
2. ✅ Install dependencies
3. ✅ Run all tests
4. ✅ Build the package
5. ✅ Publish to npm with `--access public`

**Monitor the workflow:**
- Go to https://github.com/jeremy-boschen/react-panels/actions
- You'll see a "Publish to npm" workflow running
- It takes about 2-3 minutes

**When it completes:**
- Check npm: https://www.npmjs.com/package/@jeremy-boschen/react-panels
- Your new version should be published!

### Step 5: Verify Publication

```bash
# Check the latest version on npm
npm view @jeremy-boschen/react-panels version

# Test installation
npm install @jeremy-boschen/react-panels@latest
```

## Release Notes Template

Use this template when creating releases:

```markdown
## What's Changed

### ✨ New Features
- Added support for X (#PR)
- Implemented Y feature (#PR)

### 🐛 Bug Fixes
- Fixed issue with Z (#PR)
- Resolved problem where... (#PR)

### 🔧 Improvements
- Improved performance of... (#PR)
- Enhanced error messages (#PR)

### 📚 Documentation
- Updated README with... (#PR)
- Added examples for... (#PR)

### 🧪 Tests
- Added tests for... (#PR)
- Improved test coverage to X% (#PR)

### 🏗️ Internal
- Refactored... (#PR)
- Updated dependencies (#PR)

## Full Changelog

https://github.com/jeremy-boschen/react-panels/compare/v0.1.0...v0.1.1
```

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch (0.1.0 → 0.1.1)**: Bug fixes, documentation updates, internal changes
- **Minor (0.1.0 → 0.2.0)**: New features, non-breaking API additions
- **Major (0.1.0 → 1.0.0)**: Breaking changes, API removals

## If Something Goes Wrong

### Unpublish a Version (within 72 hours)

```bash
# Unpublish a specific version (use sparingly!)
npm unpublish @jeremy-boschen/react-panels@0.1.1

# Note: npm only allows unpublishing within 72 hours
```

### Deprecate a Version (preferred)

```bash
# Deprecate a version (better than unpublishing)
npm deprecate @jeremy-boschen/react-panels@0.1.1 "This version has a critical bug. Please upgrade to 0.1.2"
```

### Delete a GitHub Release

1. Go to https://github.com/jeremy-boschen/react-panels/releases
2. Click the release
3. Click **"Delete"**
4. Note: This doesn't unpublish from npm!

## Troubleshooting

### "npm publish failed with 403"

- Check that `NPM_TOKEN` secret is set correctly
- Verify your npm account has permission to publish to `@jeremy-boschen` scope

### "Tests failed"

- The workflow will not publish if tests fail
- Fix the tests and create a new release

### "Package already exists"

- You tried to publish a version that already exists
- Bump the version number and try again

## Best Practices

✅ **DO:**
- Test locally before releasing (`yarn test && yarn build`)
- Write clear release notes
- Follow semantic versioning
- Keep a changelog up to date

❌ **DON'T:**
- Rush releases without testing
- Skip version bumps
- Publish directly via `npm publish` (use GitHub releases instead)
- Unpublish versions if possible (use deprecate instead)

## Questions?

- Open an issue: https://github.com/jeremy-boschen/react-panels/issues
- Start a discussion: https://github.com/jeremy-boschen/react-panels/discussions

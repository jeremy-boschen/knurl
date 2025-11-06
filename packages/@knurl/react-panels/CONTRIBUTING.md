# Contributing to @jeremy-boschen/react-panels

## Development Setup

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Build the library
yarn build

# Type check
yarn typecheck
```

## Testing

All changes should include tests. We maintain **98.2% test coverage** and aim to keep it there.

Run tests with coverage:
```bash
yarn test --coverage
```

## GitHub Actions

This project uses GitHub Actions for CI/CD:

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`:
- Tests on Node.js 18.x, 20.x, and 22.x
- Runs type checking
- Builds the package
- Verifies build output

### Publish Workflow (`.github/workflows/publish.yml`)

Automatically publishes to npm when a GitHub release is created:
- Runs tests
- Builds the package
- Publishes to npm with `--access public`

## Publishing a New Version

### 1. Update Version

```bash
# Update version in package.json (manually or with npm version)
npm version patch  # or minor, major
```

### 2. Push Changes

```bash
git add package.json
git commit -m "Bump version to x.y.z"
git push origin main
```

### 3. Create GitHub Release

**Option A: Via GitHub UI**
1. Go to https://github.com/jeremy-boschen/react-panels/releases
2. Click "Draft a new release"
3. Create a new tag: `v1.0.0` (matching package.json version)
4. Set title: `v1.0.0`
5. Add release notes describing changes
6. Click "Publish release"

**Option B: Via GitHub CLI**
```bash
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes "Release notes here"
```

### 4. GitHub Actions Will:
- ✅ Run all tests
- ✅ Build the package
- ✅ Publish to npm automatically

**Important:** You need to set up the `NPM_TOKEN` secret first (see below).

## Setting Up npm Publishing

Before the publish workflow can work, you need to add your npm token to GitHub Secrets:

### 1. Generate npm Token

```bash
# Login to npm
npm login

# Generate an automation token
npm token create --type=automation
```

Copy the token that's generated.

### 2. Add Token to GitHub Secrets

1. Go to https://github.com/jeremy-boschen/react-panels/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click "Add secret"

Now the publish workflow can automatically publish to npm when you create a release!

## Commit Guidelines

- Use clear, descriptive commit messages
- Reference issues when applicable
- Keep commits focused and atomic

## Pull Requests

- PRs should include tests for new features
- All CI checks must pass
- Maintain or improve test coverage

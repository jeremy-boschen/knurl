# Setup Instructions for react-panels Repository

## Commands to Push Package to New Repository

Run these commands to set up and push the react-panels package to its own repository:

```bash
# 1. Navigate to a working directory
cd ~/projects  # or wherever you keep your repos

# 2. Clone the react-panels repository
git clone https://github.com/jeremy-boschen/react-panels.git
cd react-panels

# 3. Create a new branch for this work
BRANCH_NAME="claude/initial-setup-011CUrzhcs9roykhpTTSbwRU"
git checkout -b "$BRANCH_NAME"

# 4. Copy all package files from knurl repo
KNURL_PKG="/home/user/knurl/packages/@knurl/react-panels"

# Copy source files
cp -r "$KNURL_PKG/src" ./

# Copy configuration files
cp "$KNURL_PKG/package.json" ./
cp "$KNURL_PKG/tsconfig.json" ./
cp "$KNURL_PKG/vite.config.ts" ./
cp "$KNURL_PKG/vitest.config.ts" ./

# Copy documentation
cp "$KNURL_PKG/README.md" ./
cp "$KNURL_PKG/LICENSE" ./
cp "$KNURL_PKG/CHANGELOG.md" ./
cp "$KNURL_PKG/CODE_OF_CONDUCT.md" ./
cp "$KNURL_PKG/CONTRIBUTING.md" ./
cp "$KNURL_PKG/RELEASING.md" ./
cp "$KNURL_PKG/SECURITY.md" ./

# Copy GitHub files
cp -r "$KNURL_PKG/.github" ./

# 5. Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
yarn.lock
package-lock.json

# Build output
dist/
*.tgz

# Testing
coverage/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
EOF

# 6. Install dependencies
yarn install

# 7. Run tests to verify everything works
yarn test

# 8. Build to verify it works
yarn build

# 9. Check what files will be published
npm pack --dry-run

# 10. Stage all files
git add .

# 11. Commit
git commit -m "Initial commit: React panels library

Features:
- Pixel and percentage-based panel sizing
- Horizontal and vertical layouts
- Nested panel support
- Imperative API (setSizes, getSizes)
- Draggable resize handles with callbacks
- React 19+ support
- Zero dependencies except React
- Full TypeScript support
- 98.2% test coverage (38 tests)

Infrastructure:
- GitHub Actions CI/CD workflows
- Issue and PR templates
- Code of Conduct, Security Policy
- Contributing and Release guides
- Dependabot configuration
- Automated npm publishing on releases"

# 12. Push to GitHub
git push -u origin "$BRANCH_NAME"

# 13. Create a pull request to main
gh pr create \
  --title "Initial library setup with full open source infrastructure" \
  --body "This PR sets up the complete React panels library with:

## Package Contents
- Complete source code with 98.2% test coverage
- TypeScript support
- Vite build configuration
- Comprehensive test suite (38 tests)

## Open Source Infrastructure
- GitHub Actions CI (tests on Node 18, 20, 22)
- GitHub Actions publish workflow (auto-publish on releases)
- Issue templates (bug reports, feature requests)
- Pull request template
- Code of Conduct
- Security Policy
- Contributing Guide
- Release Guide
- Dependabot configuration

## Documentation
- Comprehensive README with examples
- API documentation
- Badges (npm, license, CI status)
- Support and contribution links

Ready for first release once merged!" \
  --base main

echo ""
echo "✅ Done! Your react-panels repository is set up."
echo ""
echo "Next steps:"
echo "1. Review and merge the PR on GitHub"
echo "2. Set up NPM_TOKEN secret (see RELEASING.md)"
echo "3. Create your first release: gh release create v0.1.0"
```

## Alternative: Manual Setup via GitHub Web

If you prefer to set up manually:

1. **Create the repo on GitHub** (already done ✓)

2. **Upload files via GitHub web interface:**
   - Go to https://github.com/jeremy-boschen/react-panels
   - Click "Upload files"
   - Drag all files from `/home/user/knurl/packages/@knurl/react-panels/`
   - Commit directly to main or create a new branch

3. **Enable GitHub Actions:**
   - Go to Settings > Actions > General
   - Allow all actions and reusable workflows

4. **Set up npm token:**
   - Go to Settings > Secrets > Actions
   - Add secret named `NPM_TOKEN`
   - Value: Your npm automation token

## Files to Copy

From `/home/user/knurl/packages/@knurl/react-panels/`:

```
Directories:
- src/
- .github/

Files:
- package.json
- tsconfig.json
- vite.config.ts
- vitest.config.ts
- README.md
- LICENSE
- CHANGELOG.md
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- RELEASING.md
- SECURITY.md
- .gitignore (create new, contents above)
```

## Verifying the Setup

After copying files:

```bash
# Install and test
yarn install
yarn test        # Should show 38 tests passing
yarn build       # Should create dist/ folder

# Verify package contents
npm pack --dry-run  # Should show ~14KB package
```

## Ready to Publish

Once everything is pushed and NPM_TOKEN is set up:

```bash
# Create first release
npm version 0.1.0
git push --tags
gh release create v0.1.0 \
  --title "v0.1.0 - Initial Release" \
  --notes "First public release of @jeremy-boschen/react-panels"

# GitHub Actions will automatically publish to npm!
```

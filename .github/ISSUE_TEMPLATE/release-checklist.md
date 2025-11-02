---
name: Release Checklist
about: Complete release process checklist for new versions
title: 'Release vX.X.X: Complete Release Process and Documentation'
labels: ['release', 'documentation', 'priority:high']
assignees: ''
---

<!-- 
CLI Usage:
gh issue create --template release-checklist.md --title "Release vX.X.X: Complete Release Process and Documentation" --label "release,documentation,priority:high" --body "Replace vX.X.X with actual version number"
-->

## 🚀 Release vX.X.X - Complete Release Process

### Overview
This issue tracks the complete release process for version vX.X.X of the Deepgram Voice Interaction React component. This is a [minor/major/patch] version release that should include [new features/improvements/bug fixes].

### 📋 Release Checklist

#### Pre-Release Preparation
- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [ ] Run: `npm test`
  - [ ] Run: `npm run test:e2e`
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`
- [ ] **Documentation Updated**: All relevant documentation updated
- [ ] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management
- [ ] **Bump Version**: Update package.json to vX.X.X
  - [ ] Run: `npm version [patch/minor/major]` (or manually update)
- [ ] **Update Dependencies**: Ensure all dependencies are up to date
  - [ ] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package
- [ ] **Clean Build**: Clean previous builds
  - [ ] Run: `npm run clean`
- [ ] **Build Package**: Create production build
  - [ ] Run: `npm run build`
- [ ] **Validate Package**: Ensure package is valid
  - [ ] Run: `npm run validate`
- [ ] **Test Package**: Test package installation
  - [ ] Run: `npm run package:local`
  - [ ] Verify package can be installed and imported

#### Documentation
- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/vX.X.X/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
- [ ] **Review Documentation**: Review documentation for completeness and accuracy
  - [ ] Check all examples work correctly
  - [ ] Verify migration guides are accurate
  - [ ] Ensure all links are working
  - [ ] Review for typos and clarity
- [ ] **Test Documentation Examples**: Test all examples and migration guides
  - [ ] Test all code examples in NEW-FEATURES.md
  - [ ] Test all code examples in EXAMPLES.md
  - [ ] Test migration steps in MIGRATION.md
  - [ ] Verify API examples in API-CHANGES.md
- [ ] **Update Main Documentation**: Update README and other docs as needed
- [ ] **Update Migration Guide**: Update migration documentation if needed

#### Git Operations
- [ ] **Commit Changes**: Commit all release-related changes
  - [ ] Commit: Version bump and documentation updates
  - [ ] Message: `chore: prepare release vX.X.X`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `release/vX.X.X` branch
  - [ ] Push: `git push origin release/vX.X.X`
- [ ] **Tag Release**: Create git tag for the release
  - [ ] Tag: `git tag vX.X.X`
  - [ ] Push: `git push origin vX.X.X`

#### Package Publishing
- [ ] **Publish to GitHub Registry**: Publish package to GitHub Package Registry
  - [ ] Run: `npm publish` (automatically publishes to GitHub Registry)
  - [ ] Verify: Package appears in GitHub Packages
- [ ] **Verify Installation**: Test package installation from registry
  - [ ] Test: Install from `@signal-meaning/deepgram-voice-interaction-react@vX.X.X`
  - [ ] Verify: Package works correctly in test environment

#### GitHub Release
- [ ] **Create GitHub Release**: Create release on GitHub
  - [ ] Title: `Release vX.X.X`
  - [ ] Description: Include changelog and migration notes
  - [ ] Tag: `vX.X.X`
  - [ ] Target: `main` branch
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `vX.X.X` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/vX.X.X` branch
  - [ ] Add: `vX.X.X` label to `release/vX.X.X` branch

#### Post-Release
- [ ] **Update Main Branch**: Merge release branch to main
  - [ ] Merge: `release/vX.X.X` → `main`
  - [ ] Push: `git push origin main`
- [ ] **Clean Up**: Clean up release artifacts
  - [ ] Remove: Local `.tgz` files
  - [ ] Remove: Build artifacts if needed
- [ ] **Announcement**: Announce release (if applicable)
  - [ ] Update: Any external documentation
  - [ ] Notify: Relevant teams or users

### 🔧 Automated Workflows

The following GitHub Actions workflows will be triggered automatically:

1. **Test Workflow** (`.github/workflows/test.yml`):
   - Runs on push to main/develop
   - Runs linting, tests, and package validation
   - Tests package installation from tarball

2. **Publish Workflow** (`.github/workflows/publish.yml`):
   - Runs on GitHub release creation
   - Builds and publishes to GitHub Package Registry
   - Verifies package installation

### 📚 Documentation Standards

Follow the established documentation structure in `docs/releases/`:

- **CHANGELOG.md**: [Keep a Changelog](https://keepachangelog.com/) format
  - Categories: Added, Changed, Deprecated, Removed, Fixed, Security
  - Include links to issues, PRs, and documentation
- **MIGRATION.md**: Breaking changes and migration steps
  - Detailed list with migration steps
  - Deprecated features and alternatives
  - Before/after code examples
- **NEW-FEATURES.md**: New features with examples
  - High-level feature descriptions
  - Usage examples and patterns
  - Benefits and documentation links
- **API-CHANGES.md**: API surface changes
  - Component props, callbacks, state interface
  - Method changes and TypeScript types
- **EXAMPLES.md**: Usage examples and best practices
  - Basic and advanced usage examples
  - Migration examples and common patterns
- **PACKAGE-STRUCTURE.md**: Package directory structure and file listing
  - Visual representation of included files and directories
  - Package entry points and their purposes
  - Installation and verification steps

### 🚨 Important Notes

1. **Version Bump**: Use `npm version [patch/minor/major]` to automatically bump version
2. **Registry**: Package is configured to publish to GitHub Package Registry
3. **Testing**: All tests must pass before release
4. **Documentation**: Comprehensive documentation is required
5. **Breaking Changes**: Must be clearly documented in MIGRATION.md

### 🔗 Related Documentation

- [Release Documentation Standards](docs/releases/README.md)
- [Development Workflow](docs/DEVELOPMENT.md)
- [Migration Guide](docs/migration/README.md)
- [Package Distribution](issues/ISSUE-package-distribution.md)

### ✅ Completion Criteria

This release is complete when:
- [ ] All checklist items are completed
- [ ] Package is published to GitHub Registry
- [ ] GitHub release is created and labeled
- [ ] Documentation is complete and accurate
- [ ] All tests are passing
- [ ] Package installation is verified

---

**Labels**: `release`, `vX.X.X`, `documentation`  
**Milestone**: vX.X.X Release

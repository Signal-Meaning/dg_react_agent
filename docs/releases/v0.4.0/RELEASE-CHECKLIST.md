# Release v0.4.0 - Complete Release Process

## 🚀 Release v0.4.0 - Complete Release Process

### Overview
This document tracks the complete release process for version 0.4.0 of the Deepgram Voice Interaction React component. This is a minor version release that should include new features and improvements.

### 📋 Release Checklist

#### Pre-Release Preparation
- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [ ] Run: `npm test`
  - [ ] Run: `npm run test:e2e`
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`
- [ ] **Documentation Updated**: All relevant documentation updated
- [ ] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management
- [ ] **Bump Version**: Update package.json to 0.4.0
  - [ ] Run: `npm version minor` (or manually update to 0.4.0)
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
  - [ ] Create: `docs/releases/v0.4.0/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
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
  - [ ] Message: `chore: prepare release v0.4.0`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `release/v0.4.0` branch
  - [ ] Push: `git push origin release/v0.4.0`
- [ ] **Tag Release**: Create git tag for the release
  - [ ] Tag: `git tag v0.4.0`
  - [ ] Push: `git push origin v0.4.0`

#### Package Publishing
- [ ] **Publish to GitHub Registry**: Publish package to GitHub Package Registry
  - [ ] Run: `npm publish` (automatically publishes to GitHub Registry)
  - [ ] Verify: Package appears in GitHub Packages
- [ ] **Verify Installation**: Test package installation from registry
  - [ ] Test: Install from `@signal-meaning/deepgram-voice-interaction-react@0.4.0`
  - [ ] Verify: Package works correctly in test environment

#### GitHub Release
- [ ] **Create GitHub Release**: Create release on GitHub
  - [ ] Title: `Release v0.4.0`
  - [ ] Description: Include changelog and migration notes
  - [ ] Tag: `v0.4.0`
  - [ ] Target: `main` branch
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `v0.4.0` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/v0.4.0` branch
  - [ ] Add: `v0.4.0` label to `release/v0.4.0` branch

#### Post-Release
- [ ] **Update Main Branch**: Merge release branch to main
  - [ ] Merge: `release/v0.4.0` → `main`
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

2. **Test and Publish Workflow** (`.github/workflows/test-and-publish.yml`):
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

### 🚨 Important Notes

1. **Version Bump**: Use `npm version minor` to automatically bump to 0.4.0
2. **Registry**: Package is configured to publish to GitHub Package Registry
3. **Testing**: All tests must pass before release
4. **Documentation**: Comprehensive documentation is required
5. **Breaking Changes**: Must be clearly documented in MIGRATION.md

### 🔗 Related Documentation

- [Release Documentation Standards](../README.md)
- [Development Workflow](../../DEVELOPMENT.md)
- [Migration Guide](../../migration/README.md)
- [Package Distribution](../../../issues/ISSUE-package-distribution.md)

### ✅ Completion Criteria

This release is complete when:
- [ ] All checklist items are completed
- [ ] Package is published to GitHub Registry
- [ ] GitHub release is created and labeled
- [ ] Documentation is complete and accurate
- [ ] All tests are passing
- [ ] Package installation is verified

---

**GitHub Issue**: [#129](https://github.com/Signal-Meaning/dg_react_agent/issues/129)  
**Assignee**: @davidmcgee  
**Labels**: `release`, `v0.4.0`, `documentation`  
**Milestone**: v0.4.0 Release

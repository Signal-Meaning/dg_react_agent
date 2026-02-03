# Release v0.4.0 - Complete Release Process

## 🚀 Release v0.4.0 - Complete Release Process

### Overview
This document tracks the complete release process for version 0.4.0 of the Deepgram Voice Interaction React component. This is a minor version release that should include new features and improvements.

### 📋 Release Checklist

#### Pre-Release Preparation
- [x] **Code Review Complete**: All PRs merged and code reviewed
- [x] **Tests Passing**: All unit tests and E2E tests passing
  - [x] Run: `npm test`
  - [x] Run: `npm run test:e2e`
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint`
- [x] **Documentation Updated**: All relevant documentation updated
- [x] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management
- [x] **Bump Version**: Update package.json to 0.4.0
  - [x] Run: `npm version minor` (or manually update to 0.4.0)
- [x] **Update Dependencies**: Ensure all dependencies are up to date
  - [x] Run: `npm update`
  - [x] Review and update any outdated dependencies

#### Build and Package
- [x] **Clean Build**: Clean previous builds
  - [x] Run: `npm run clean`
- [x] **Build Package**: Create production build
  - [x] Run: `npm run build`
- [x] **Validate Package**: Ensure package is valid
  - [x] Run: `npm run validate`
- [x] **Test Package**: Test package installation
  - [x] Run: `npm run package:local`
  - [x] Verify package can be installed and imported

#### Documentation
- [x] **Create Release Documentation**: Follow the established structure
  - [x] Create: `docs/releases/v0.4.0/` directory
  - [x] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [x] Create: `MIGRATION.md` if there are breaking changes
  - [x] Create: `NEW-FEATURES.md` for new features
  - [x] Create: `API-CHANGES.md` for API changes
  - [x] Create: `EXAMPLES.md` with usage examples
- [x] **Review Documentation**: Review documentation for completeness and accuracy
  - [x] Check all examples work correctly
  - [x] Verify migration guides are accurate
  - [x] Ensure all links are working
  - [x] Review for typos and clarity
- [x] **Test Documentation Examples**: Test all examples and migration guides
  - [x] Test all code examples in NEW-FEATURES.md
  - [x] Test all code examples in EXAMPLES.md
  - [x] Test migration steps in MIGRATION.md
  - [x] Verify API examples in API-CHANGES.md
- [x] **Update Main Documentation**: Update README and other docs as needed
- [x] **Update Migration Guide**: Update migration documentation if needed

#### Git Operations
- [x] **Commit Changes**: Commit all release-related changes
  - [x] Commit: Version bump and documentation updates
  - [x] Message: `chore: prepare release v0.4.0`
- [x] **Create Release Branch**: Create a release branch for the version
  - [x] Create: `release/v0.4.0` branch
  - [x] Push: `git push origin release/v0.4.0`
- [x] **Tag Release**: Create git tag for the release
  - [x] Tag: `git tag v0.4.0`
  - [x] Push: `git push origin v0.4.0`

#### Package Publishing
- [x] **Publish to GitHub Registry**: Publish package to GitHub Package Registry
  - [x] Run: `npm publish` (automatically publishes to GitHub Registry)
  - [x] Verify: Package appears in GitHub Packages
- [x] **Verify Installation**: Test package installation from registry
  - [x] Test: Install from `@signal-meaning/deepgram-voice-interaction-react@0.4.0`
  - [x] Verify: Package works correctly in test environment

#### GitHub Release
- [x] **Create GitHub Release**: Create release on GitHub
  - [x] Title: `Release v0.4.0`
  - [x] Description: Include changelog and migration notes
  - [x] Tag: `v0.4.0`
  - [x] Target: `main` branch
- [x] **Add Release Labels**: Label the release appropriately
  - [x] Add: `release` label
  - [x] Add: `v0.4.0` label
- [x] **Add Branch Labels**: Label the release branch
  - [x] Add: `release` label to `release/v0.4.0` branch
  - [x] Add: `v0.4.0` label to `release/v0.4.0` branch

#### Post-Release
- [x] **Update Main Branch**: Merge release branch to main
  - [x] Merge: `release/v0.4.0` → `main`
  - [x] Push: `git push origin main`
- [x] **Clean Up**: Clean up release artifacts
  - [x] Remove: Local `.tgz` files
  - [x] Remove: Build artifacts if needed
- [x] **Announcement**: Announce release (if applicable)
  - [x] Update: Any external documentation
  - [x] Notify: Relevant teams or users

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
- [x] All checklist items are completed
- [x] Package is published to GitHub Registry
- [x] GitHub release is created and labeled
- [x] Documentation is complete and accurate
- [x] All tests are passing
- [x] Package installation is verified

---

**GitHub Issue**: [#129](https://github.com/Signal-Meaning/dg_react_agent/issues/129)  
**Assignee**: @davidmcgee  
**Labels**: `release`, `v0.4.0`, `documentation`  
**Milestone**: v0.4.0 Release

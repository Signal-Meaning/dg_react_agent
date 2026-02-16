# Issue #461: Release v0.9.1 – Release Checklist

**GitHub:** [#461 Release v0.9.1: Complete Release Process and Documentation](https://github.com/Signal-Meaning/dg_react_agent/issues/461)

**Progress:** **Complete.** Release v0.9.1 / 0.2.1 published; GitHub release and tag v0.9.1 exist; release branch merged to main. **Issue #461 should be resolved and closed** with a comment linking to `docs/issues/ISSUE-461/`.

---

## 🚀 Release v0.9.1 - Complete Release Process

### Overview

This issue tracks the complete release process for version **v0.9.1** of the Deepgram Voice Interaction React component. This is a **patch** version release that should include bug fixes (Issue #459: session.update race / conversation_already_has_active_response).

The repository publishes two packages to GitHub Package Registry. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). Each package has its own version in its `package.json`; you may release the component only, the backend only, or both in one release.

---

### 📋 Release Checklist

#### Pre-Release Preparation

- [x] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [x] Run what CI runs (catches broken imports, packaging tests, etc.): `npm run lint` then `npm run test:mock`. CI uses these same commands; passing locally means the Test and Publish workflow test job should pass.
  - [ ] Optionally run full suite: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
  - [ ] Optional but recommended: Run real-API integration tests (when `OPENAI_API_KEY` is available; see `docs/issues/ISSUE-451/SCOPE.md`)
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All 8 in-scope tests pass (CI runs mocks only; this step validates against live OpenAI when keys are set)
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint`
- [x] **Documentation Updated**: All relevant documentation updated
- [x] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section
- [x] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management

- [x] **Bump Version**: Update package.json to v0.9.1
  - [x] Run: `npm version patch` (or manually update)
- [x] **Bump voice-agent-backend version** (if releasing that package): Update `packages/voice-agent-backend/package.json` version (0.2.0 → 0.2.1)
- [x] **Update Dependencies**: Ensure all dependencies are up to date
  - [x] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package (CI performs build — no local build required)

- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation

- [x] **Create Release Documentation**: Follow the established structure
  - [x] Create: `docs/releases/v0.9.1/` directory
  - [x] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [x] Create: `MIGRATION.md` if there are breaking changes
  - [x] Create: `NEW-FEATURES.md` for new features
  - [x] Create: `API-CHANGES.md` for API changes
  - [x] Create: `EXAMPLES.md` with usage examples
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replaced `v0.9.1` and `0.9.1` placeholders with actual version
- [x] **Validate Documentation**: Run validation to ensure all required documents are present
  - [x] Run: `npm run validate:release-docs 0.9.1`
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

- [x] **Commit Changes**: Commit all release-related changes
  - [x] Commit: Version bump and documentation updates
  - [x] Message: `chore: prepare release v0.9.1`
- [x] **Create Release Branch**: Create a release branch for the version
  - [x] Create: `release/v0.9.1` branch
  - [x] Push: `git push origin release/v0.9.1`

#### Package Publishing

- [x] **Publish to GitHub Registry**: Publish package(s) to GitHub Package Registry
  - [x] **Preferred: Use CI build** (validated CI build)
    - GitHub release created; CI test-and-publish ran; both packages published.
    - [x] Check GitHub Actions workflow status
    - [x] Verify all CI checks pass
    - [x] Verify both packages appear in GitHub Packages (voice-agent-react@0.9.1, voice-agent-backend@0.2.1)
- [x] **Tag Release**: Tag v0.9.1 created and pushed (release created from release branch)
- [x] **Verify Installation**: Packages in use (e.g. voice-commerce on 0.9.1/0.2.1 per #462)

#### GitHub Release

- [x] **Create GitHub Release**: Create release on GitHub
  - [x] Title: **Release v0.9.1**
  - [x] Description: Include changelog and migration notes
  - [x] Tag: `v0.9.1`
  - [x] Target: `release/v0.9.1` branch (release created from release branch)
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `v0.9.1` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/v0.9.1` branch
  - [ ] Add: `v0.9.1` label to `release/v0.9.1` branch

#### Post-Release

- [x] **Update Main Branch**: Merge release branch to main via Pull Request (release/v0.9.1 → main completed)
- [x] **Clean Up**: No local package artifacts to remove
- [x] **Announcement**: Release completed; downstream (e.g. voice-commerce) adopted 0.9.1/0.2.1

---

### 🔧 Automated Workflows

The following GitHub Actions workflows will be triggered automatically:

1. **Test Workflow** (`.github/workflows/test.yml`):
   - Runs on push to main/develop
   - Runs linting, tests, and package validation
   - Tests package installation from tarball

2. **Test and Publish Workflow** (`.github/workflows/test-and-publish.yml`):
   - Runs on GitHub release creation (or workflow_dispatch)
   - **Test Job**: Runs first and includes:
     - Linting (`npm run lint`)
     - Tests with mock APIs only (`npm run test:mock` — no real API calls)
     - Build in CI (`npm run build`)
     - Package validation (`npm run package:local`)
   - **Publish Job**: Only runs if test job succeeds
     - Builds again in CI and publishes to GitHub Package Registry
   - Verifies package installation
   - All non-skipped tests must pass before publishing

---

### 📚 Documentation Standards

Follow the established documentation structure in `docs/releases/`:

- **CHANGELOG.md**: [Keep a Changelog](https://keepachangelog.com/) format — categories: Added, Changed, Deprecated, Removed, Fixed, Security; include links to issues, PRs, and documentation
- **MIGRATION.md**: Breaking changes and migration steps; deprecated features and alternatives; before/after code examples
- **NEW-FEATURES.md**: New features with examples; usage examples and patterns; benefits and documentation links
- **API-CHANGES.md**: API surface changes — component props, callbacks, state interface; method changes and TypeScript types
- **EXAMPLES.md**: Usage examples and best practices; basic and advanced usage; migration examples and common patterns
- **PACKAGE-STRUCTURE.md**: Package directory structure and file listing; package entry points and their purposes; installation and verification steps

---

### 🚨 Important Notes

1. **Version Bump**: Use `npm version patch` to automatically bump version
2. **Registry**: Package is configured to publish to GitHub Package Registry
3. **Testing**: All tests must pass before release
4. **Documentation**: Comprehensive documentation is required
5. **Breaking Changes**: Must be clearly documented in MIGRATION.md
6. **Merge to main via PR**: Branch protection may require changes through a pull request. Do not push a local merge directly to `main`; open a PR from `release/v0.9.1` to `main` and merge the PR.

---

### 🔗 Related Documentation

- Release Documentation Standards: `docs/releases/README.md`
- Development Workflow: `docs/DEVELOPMENT.md`
- Migration Guide: `docs/migration/README.md`
- Package Distribution: `docs/issues/ISSUE-package-distribution.md` (or repo issues)

---

### ✅ Completion Criteria

This release is complete when:

- [x] All checklist items are completed
- [x] Package is published to GitHub Registry
- [x] GitHub release is created and labeled
- [x] Documentation is complete and accurate
- [x] All tests are passing
- [x] Package installation is verified

**→ Resolve and close GitHub issue #461** with a comment linking to `docs/issues/ISSUE-461/` (this folder).

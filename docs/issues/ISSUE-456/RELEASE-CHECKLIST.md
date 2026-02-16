# Issue #456: Release v0.9.0 – Release Checklist

**GitHub:** [#456 Release v0.9.0: Complete Release Process and Documentation](https://github.com/Signal-Meaning/dg_react_agent/issues/456)

**Epic:** [#455](https://github.com/Signal-Meaning/dg_react_agent/issues/455) — Real-API tests, function-call contract, and 3pp scope (voice-commerce feedback). Complete the four tracked issues (#451–#454) as part of this release.

**Progress:** Lint ✅. test:mock ✅. npm test ✅. E2E proxy: backend running, `USE_PROXY_MODE=true npm run test:e2e` run started (fixed `test.describe.optional` → `test.describe` in openai-proxy-tts-diagnostic.spec.js). Verify full E2E pass when run completes, then version bump and release docs.

---

## 🚀 Release v0.9.0 - Complete Release Process

### Overview

This issue tracks the complete release process for version **v0.9.0** of the Deepgram Voice Interaction React component. This is a **minor** version release that should include new features, real-API tests, function-call contract work, and 3pp scope (voice-commerce feedback).

The repository publishes two packages to GitHub Package Registry. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). Each package has its own version in its `package.json`; you may release the component only, the backend only, or both in one release.

---

### 📋 Release Checklist

#### Pre-Release Preparation

- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [x] Run what CI runs (catches broken imports, packaging tests, etc.): `npm run lint` then `npm run test:mock`. CI uses these same commands; passing locally means the Test and Publish workflow test job should pass.
  - [x] Optionally run full suite: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [x] Start backend: `cd test-app && npm run backend` (backend on port 8080)
    - [x] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding (244 tests; confirm when run completes)
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint`
- [ ] **Documentation Updated**: All relevant documentation updated
- [ ] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management

- [ ] **Bump Version**: Update package.json to v0.9.0
  - [ ] Run: `npm version minor` (or manually update to 0.9.0)
- [ ] **Bump voice-agent-backend version** (if releasing that package): Update `packages/voice-agent-backend/package.json` version (e.g. 0.1.0 → 0.2.0)
- [ ] **Update Dependencies**: Ensure all dependencies are up to date
  - [ ] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package (CI performs build — no local build required)

- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation

- [ ] **Create Release Documentation**: Follow the established structure
  - [ ] Create: `docs/releases/v0.9.0/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features
  - [ ] Create: `API-CHANGES.md` for API changes
  - [ ] Create: `EXAMPLES.md` with usage examples
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `vX.X.X` and `X.X.X` placeholders with `v0.9.0` and `0.9.0`
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs v0.9.0`
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
  - [ ] Message: `chore: prepare release v0.9.0`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `release/v0.9.0` branch
  - [ ] Push: `git push origin release/v0.9.0`

#### Package Publishing

- [ ] **Publish to GitHub Registry**: Publish package(s) to GitHub Package Registry
  - [ ] **Preferred**: Use CI build (validated CI build)
    - Create GitHub release to trigger `.github/workflows/test-and-publish.yml`
    - CI workflow will: test (mock APIs only), build in CI, validate packages, and publish both the root package and `@signal-meaning/voice-agent-backend`. No local build required.
    - Test job runs first: linting, mock tests, build, package validation (including voice-agent-backend pack dry-run)
    - Publish job only runs if test job succeeds; it publishes root then voice-agent-backend (each skips if that version already exists unless force is set)
    - All non-skipped tests must pass before publishing
    - **Monitor CI workflow**: Wait for CI build to complete successfully
      - [ ] Check GitHub Actions workflow status
      - [ ] Verify all CI checks pass
      - [ ] Verify both packages appear in GitHub Packages (if released)
    - Only proceed to tagging if publish succeeds
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - Root: Run `npm publish` from repo root
    - Backend: Run `cd packages/voice-agent-backend && npm publish`
    - Verify: Package(s) appear in GitHub Packages
    - Only proceed to tagging if publish succeeds
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package(s) successfully published to GitHub Packages
  - [ ] Tag: `git tag v0.9.0`
  - [ ] Push: `git push origin v0.9.0`
- [ ] **Verify Installation**: Test package installation from registry
  - [ ] Test: Install from `@signal-meaning/voice-agent-react@v0.9.0`
  - [ ] If releasing backend: Install from `@signal-meaning/voice-agent-backend@<version>` (see `packages/voice-agent-backend/README.md` for registry config)
  - [ ] Verify: Package(s) work correctly in test environment

#### GitHub Release

- [ ] **Create GitHub Release**: Create release on GitHub
  - [ ] Title: `Release v0.9.0`
  - [ ] Description: Include changelog and migration notes
  - [ ] Tag: `v0.9.0`
  - [ ] Target: `main` branch
- [ ] **Add Release Labels**: Label the release appropriately
  - [ ] Add: `release` label
  - [ ] Add: `v0.9.0` label
- [ ] **Add Branch Labels**: Label the release branch
  - [ ] Add: `release` label to `release/v0.9.0` branch
  - [ ] Add: `v0.9.0` label to `release/v0.9.0` branch

#### Post-Release

- [ ] **Update Main Branch**: Merge release branch to main via Pull Request (required — do not push directly to main)
  - [ ] Open a PR: `release/v0.9.0` → `main` (e.g. "Merge release/v0.9.0 into main")
  - [ ] Get review/approval if branch protection requires it
  - [ ] Merge the PR (squash or merge commit per repo policy)
  - Do **not** `git push origin main` from a local merge — use the GitHub PR merge so branch protection is satisfied
- [ ] **Clean Up**: Clean up release artifacts (only if you ran optional local package)
  - [ ] If you ran `npm run package:local` locally: remove any `.tgz` in repo root, or leave (they are gitignored)
- [ ] **Announcement**: Announce release (if applicable)
  - [ ] Update: Any external documentation
  - [ ] Notify: Relevant teams or users

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

1. **Version Bump**: Use `npm version [patch/minor/major]` to automatically bump version
2. **Registry**: Package is configured to publish to GitHub Package Registry
3. **Testing**: All tests must pass before release
4. **Documentation**: Comprehensive documentation is required
5. **Breaking Changes**: Must be clearly documented in MIGRATION.md
6. **Merge to main via PR**: Branch protection may require changes through a pull request. Do not push a local merge directly to `main`; open a PR from `release/v0.9.0` to `main` and merge the PR.

---

### 🔗 Related Documentation

- [Release Documentation Standards](/docs/releases/README.md)
- [Development Workflow](/docs/DEVELOPMENT.md)
- [Migration Guide](/docs/migration/README.md)
- [Package Distribution](/issues/ISSUE-package-distribution.md)

---

### ✅ Completion Criteria

This release is complete when:

- [ ] All checklist items are completed
- [ ] Package is published to GitHub Registry
- [ ] GitHub release is created and labeled
- [ ] Documentation is complete and accurate
- [ ] All tests are passing
- [ ] Package installation is verified

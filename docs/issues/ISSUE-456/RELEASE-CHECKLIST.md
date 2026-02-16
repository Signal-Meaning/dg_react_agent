# Issue #456: Release v0.9.0 – Release Checklist

**GitHub:** [#456 Release v0.9.0: Complete Release Process and Documentation](https://github.com/Signal-Meaning/dg_react_agent/issues/456)

**Epic:** [#455](https://github.com/Signal-Meaning/dg_react_agent/issues/455) — Real-API tests, function-call contract, and 3pp scope (voice-commerce feedback). Complete the four tracked issues (#451–#454) as part of this release.

**Progress:** Publish complete (both packages). GitHub release created; tag v0.9.0. PR #458 merged (release/v0.9.0 → main). **Remaining (optional):** Add release/branch labels if repo uses them; verify install from registry.

---

## 🚀 Release v0.9.0 - Complete Release Process

### Overview

This issue tracks the complete release process for version **v0.9.0** of the Deepgram Voice Interaction React component. This is a **minor** version release that should include new features, real-API tests, function-call contract work, and 3pp scope (voice-commerce feedback).

The repository publishes two packages to GitHub Package Registry. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). Each package has its own version in its `package.json`; you may release the component only, the backend only, or both in one release.

---

### 📋 Release Checklist

#### Pre-Release Preparation

- [x] **Code Review Complete**: All PRs merged and code reviewed
- [x] **Tests Passing**: All unit tests and E2E tests passing
  - [x] Run what CI runs (catches broken imports, packaging tests, etc.): `npm run lint` then `npm run test:mock`. CI uses these same commands; passing locally means the Test and Publish workflow test job should pass.
  - [x] Optionally run full suite: `npm test`
  - [x] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [x] Start backend: `cd test-app && npm run backend` (backend on port 8080)
    - [x] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [x] Verify: All tests pass in proxy mode before proceeding (244 tests, exit 0)
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint`
- [x] **Documentation Updated**: All relevant documentation updated (epic #451–#454: TEST-STRATEGY, BACKEND-FUNCTION-CALL-CONTRACT, scope docs)
- [x] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section (v0.9.0: no component API changes; evolution entry added)
- [x] **Breaking Changes Documented**: Any breaking changes identified and documented (none for v0.9.0)

#### Version Management

- [x] **Bump Version**: Update package.json to v0.9.0
  - [x] Manually updated to 0.9.0
- [x] **Bump voice-agent-backend version** (if releasing that package): Update `packages/voice-agent-backend/package.json` version (e.g. 0.1.0 → 0.2.0)  
  **Since v0.8.4 we have backend source commits:** openai.upstreamOptions merge (#441), OpenAI proxy move to voice-agent-backend (#445), openai-proxy turn_detection fix (#451), Epic #455 contract/docs in index.js → **bumped to 0.2.0**.
- [x] **Update Dependencies**: Ensure all dependencies are up to date
  - [x] Run: `npm update` (145 packages updated)
  - [x] Review and update any outdated dependencies (optional: run `npm audit` for 1 reported high severity and address if needed)

#### Build and Package (CI performs build — no local build required)

- [x] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below). Build and publish were performed by CI (Test and Publish workflow).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation

- [x] **Create Release Documentation**: Follow the established structure
  - [x] Create: `docs/releases/v0.9.0/` directory
  - [x] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [x] Create: `MIGRATION.md` if there are breaking changes
  - [x] Create: `NEW-FEATURES.md` for new features
  - [x] Create: `API-CHANGES.md` for API changes
  - [x] Create: `EXAMPLES.md` with usage examples
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replaced `vX.X.X` and `X.X.X` with `v0.9.0` and `0.9.0`
  - [x] Create: `RELEASE-NOTES.md`
- [x] **Validate Documentation**: Run validation to ensure all required documents are present
  - [x] Run: `npm run validate:release-docs 0.9.0` — passed
- [x] **Review Documentation**: Review documentation for completeness and accuracy
  - [x] Check all examples work correctly (NEW-FEATURES/EXAMPLES only reference install commands and existing docs; no new runnable code)
  - [x] Verify migration guides are accurate (MIGRATION.md: no breaking changes, upgrade steps correct)
  - [x] Ensure all links are working (docs/API-REFERENCE.md, BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md, development/TEST-STRATEGY.md verified)
  - [x] Review for typos and clarity — consistent with Epic #455 and release scope
- [x] **Test Documentation Examples**: Test all examples and migration guides
  - [x] NEW-FEATURES.md / EXAMPLES.md: install commands and doc links only; no additional test needed
  - [x] MIGRATION.md: no migration steps (no breaking changes)
  - [x] API-CHANGES.md: no API examples (no component changes)
- [x] **Update Main Documentation**: Update README and other docs as needed (no update required; README version is badge-driven)
- [x] **Update Migration Guide**: Update migration documentation if needed (no update required for v0.9.0)

#### Git Operations

- [x] **Commit Changes**: Commit all release-related changes
  - [x] Commit: Version bump and documentation updates
  - [x] Message: `chore: prepare release v0.9.0`
- [x] **Create Release Branch**: Create a release branch for the version
  - [x] Create: `release/v0.9.0` branch
  - [x] Push: `git push origin release/v0.9.0`

#### Package Publishing

- [x] **Publish to GitHub Registry**: Publish package(s) to GitHub Package Registry
  - [x] **Preferred**: Use CI build (validated CI build)
    - **Lesson:** Version must be bumped in `package.json` (and backend if applicable) and committed on the release branch **before** creating the GitHub release; otherwise CI publishes the previous version and the release does not update. Use `npm run release:issue X.X.X minor` to create the release branch; it rejects if the branch already exists or if package.json version does not match, so the mistake is caught early.
    - Create GitHub release to trigger `.github/workflows/test-and-publish.yml`
    - CI workflow ran: test job passed, publish job published root and voice-agent-backend
    - **Monitor CI workflow**: Wait for CI build to complete successfully
      - [x] Check GitHub Actions workflow status
      - [x] Verify all CI checks pass
      - [x] Verify both packages appear in GitHub Packages (if released)
  - N/A **Fallback**: Dev publish (only if CI fails)
- [x] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [x] Verify: Package(s) successfully published to GitHub Packages
  - [x] Tag: created via `gh release create v0.9.0` (tag v0.9.0 on remote)
  - [x] Push: tag pushed with release
- [ ] **Verify Installation**: Test package installation from registry (optional)
  - [ ] Test: Install from `@signal-meaning/voice-agent-react@v0.9.0`
  - [ ] If releasing backend: Install from `@signal-meaning/voice-agent-backend@0.2.0`
  - [ ] Verify: Package(s) work correctly in test environment

#### GitHub Release

- [x] **Create GitHub Release**: Create release on GitHub
  - [x] Title: `Release v0.9.0`
  - [x] Description: Include changelog and migration notes (CHANGELOG.md)
  - [x] Tag: `v0.9.0`
  - [x] Target: `release/v0.9.0` branch (release created from release branch)
- [ ] **Add Release Labels**: Label the release appropriately (if repo uses release/version labels)
  - [ ] Add: `release` label
  - [ ] Add: `v0.9.0` label
- [ ] **Add Branch Labels**: Label the release branch (if repo uses branch labels)
  - [ ] Add: `release` label to `release/v0.9.0` branch
  - [ ] Add: `v0.9.0` label to `release/v0.9.0` branch

#### Post-Release

- [x] **Update Main Branch**: Merge release branch to main via Pull Request (required — do not push directly to main)
  - [x] Open a PR: `release/v0.9.0` → `main` — [PR #458](https://github.com/Signal-Meaning/dg_react_agent/pull/458)
  - [x] Get review/approval if branch protection requires it
  - [x] Merge the PR (squash or merge commit per repo policy)
  - Do **not** `git push origin main` from a local merge — use the GitHub PR merge so branch protection is satisfied
- [x] **Clean Up**: Clean up release artifacts (only if you ran optional local package)
  - N/A — did not run `npm run package:local` locally; no `.tgz` to remove
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
   - Runs on GitHub release creation (or workflow_dispatch). When triggered by **creating** the release, the release already exists, so the workflow’s “Create GitHub Release” step is intentionally skipped (it only runs for workflow_dispatch or push to `release/v*`).
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

- [x] All required checklist items are completed (merge PR done; optional: labels, verify install, announcement)
- [x] Package is published to GitHub Registry
- [x] GitHub release is created (labeling optional)
- [x] Documentation is complete and accurate
- [x] All tests are passing
- [ ] Package installation is verified (optional; run when authenticated to GitHub Package Registry)

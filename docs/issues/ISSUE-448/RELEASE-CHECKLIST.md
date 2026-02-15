# Issue #448: Release v0.8.4 – Release Checklist

**GitHub:** [#448 Release v0.8.4: Complete Release Process and Documentation](https://github.com/Signal-Meaning/dg_react_agent/issues/448)

## 🚀 Release v0.8.4 - Complete Release Process

### Overview
This issue tracks the complete release process for version v0.8.4 of the React component and backend. This is a **patch** version release (bug fixes and minor improvements).

The repository publishes two packages to GitHub Package Registry: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). CI (`.github/workflows/test-and-publish.yml`) can publish both when the workflow runs (e.g. on GitHub release creation or manual dispatch).

**Progress:** CI/CD on push to main disabled ✅. Lint ✅. Unit/integration tests ✅. Version bump to 0.8.4 ✅. Release docs created (`docs/releases/v0.8.4/`: CHANGELOG, RELEASE-NOTES, PACKAGE-STRUCTURE) ✅. `npm run validate:release-docs 0.8.4` ✅. Next: Create release branch, push, then publish via GitHub release or workflow_dispatch.

---

### 📋 Release Checklist

#### CI/CD configuration (do first)
- [x] **Disable automated CI/CD on push to main**: We do not want any automated CI/CD runs at this stage. Disable workflow runs that trigger on every merge to main.
  - [x] In `.github/workflows/test-and-publish.yml`, remove or comment out the `push:` trigger (e.g. `push: branches: [ main, 'release/v*' ]`) so the workflow **only** runs on:
    - `release: types: [published]` (when a GitHub release is created), and/or
    - `workflow_dispatch` (manual run).
  - [x] Verify no other workflows run on push to main if they should also be disabled. (Only `test-and-publish.yml` had push-to-main; `debug-auth.yml` is workflow_dispatch only.)
  - [x] Result: Merging PRs into `main` will no longer trigger test/publish runs; publishing remains possible via creating a GitHub release or running the workflow manually.

#### Pre-Release Preparation
- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [x] Run: `npm test` — passed (90 suites, 899 tests)
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint` — passed
- [ ] **Documentation Updated**: All relevant documentation updated
- [ ] **API Changes Documented**: Any API changes appear in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: Any breaking changes identified and documented

#### Version Management
- [x] **Bump Version**: Update package.json to v0.8.4
  - [x] Manually set to 0.8.4
- [ ] **Bump voice-agent-backend version** (if releasing that package): Update `packages/voice-agent-backend/package.json` version (e.g. 0.1.1 → 0.1.2)
- [ ] **Update Dependencies**: Ensure all dependencies are up to date
  - [ ] Run: `npm update`
  - [ ] Review and update any outdated dependencies

#### Build and Package (CI performs build — no local build required)
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Package Publishing below).
- [ ] **Optional local validation only**: If you want to verify build locally before pushing:
  - [ ] Run: `npm run clean` then `npm run build` then `npm run validate` (or `npm run package:local`). Do **not** commit any `.tgz` or `dist/` — they are gitignored; CI will build from source.

#### Documentation
- [x] **Create Release Documentation**: Follow the established structure
  - [x] Create: `docs/releases/v0.8.4/` directory
  - [x] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [x] No MIGRATION.md (no breaking changes)
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (0.8.4, voice-agent-react)
  - [x] Create: `RELEASE-NOTES.md`
- [x] **Validate Documentation**: Run validation to ensure all required documents are present
  - [x] Run: `npm run validate:release-docs 0.8.4` — passed
- [ ] **Review Documentation**: Review documentation for completeness and accuracy
- [ ] **Update Main Documentation**: Update README and other docs as needed

#### Git Operations
- [ ] **Commit Changes**: Commit all release-related changes
  - [ ] Commit: Version bump, CI/CD trigger change, release docs, checklist updates
  - [ ] Message: `chore: prepare release v0.8.4`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `release/v0.8.4` branch
  - [ ] Push: `git push origin release/v0.8.4`

#### Package Publishing
- [ ] **Publish to GitHub Registry**: Publish package(s) to GitHub Package Registry
  - [ ] **Preferred**: Use CI build
    - Create GitHub release to trigger `.github/workflows/test-and-publish.yml` (workflow runs on `release: published` or `workflow_dispatch` after disabling push trigger).
    - CI workflow will: test (mock APIs only), build in CI, validate packages, and publish both root package and `@signal-meaning/voice-agent-backend` when configured.
  - [ ] **Fallback**: Dev publish (only if CI fails) — run `npm publish` from repo root and/or `cd packages/voice-agent-backend && npm publish`
- [ ] **Tag Release**: After publish succeeds: `git tag v0.8.4` and `git push origin v0.8.4`
- [ ] **Verify Installation**: Test install from `@signal-meaning/voice-agent-react@0.8.4` (and backend if released)

#### GitHub Release
- [ ] **Create GitHub Release**: Title `Release v0.8.4`, tag `v0.8.4`, description with changelog/migration notes
- [ ] **Add Labels**: `release`, `v0.8.4` on the issue and release branch as desired

#### Post-Release
- [ ] **Update Main Branch**: Merge release branch to main **via Pull Request** (do not push directly to main)
  - [ ] Open PR: `release/v0.8.4` → `main`, merge after review
- [ ] **Announcement**: Update external docs or notify teams if applicable

---

### ✅ Completion Criteria

This release is complete when:
- [ ] CI/CD no longer runs automatically on merge to main (trigger disabled).
- [ ] All checklist items above are completed.
- [ ] Package(s) published to GitHub Registry.
- [ ] GitHub release created and tagged.
- [ ] Documentation complete and installation verified.

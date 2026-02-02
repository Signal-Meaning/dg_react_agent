## Context

This release perfects the release for the customer. The defect they reported has been resolved via **Issue #381** (OpenAI Realtime proxy). This patch delivers the fix to customers: backend proxy, unit/integration/E2E validation, greeting injection, and documentation. Acceptance criteria for #381 are complete.

---

## 🚀 Quick Release v0.7.11 - Patch Release

### Overview
This is a patch release for version v0.7.11 of the Deepgram Voice Interaction React component. This release delivers the **Issue #381** fix (OpenAI Realtime proxy) and resolves the defect reported by the customer. Bug fixes and minor improvements with no breaking changes.

### 📋 Quick Release Checklist

#### Pre-Release
- [ ] **Tests Passing**: All tests passing
  - [ ] Run: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start proxy server: `npm run test:proxy:server` (in test-app directory)
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`

#### Version & Build (CI performs build — no local build required)
- [ ] **Bump Version**: Update to v0.7.11
  - [ ] Run: `npm version patch`
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Publish below).
- [ ] **Optional**: Run `npm run build` or `npm run package:local` locally to verify; do **not** commit any `.tgz` (gitignored).

#### Documentation
- [ ] **⚠️ CRITICAL: Create Release Documentation BEFORE Publishing** ⚠️
  - [ ] Create: `docs/releases/v0.7.11/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace v0.7.11 and 0.7.11 placeholders with actual version
  - [ ] Create: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs 0.7.11` (version without "v" prefix)
- [ ] **Update Version**: Update version references in docs
- [ ] **⚠️ DO NOT proceed to Release section until documentation is complete** ⚠️

#### Release
- [ ] **Commit Changes**: Commit all release-related changes (including documentation)
  - [ ] Commit: `git add . && git commit -m "chore: prepare release v0.7.11"`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `git checkout -b release/v0.7.11` (from current working branch or main)
  - [ ] Push: `git push origin release/v0.7.11`
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **⚠️ Documentation must be committed to release branch BEFORE creating GitHub release** ⚠️
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/test-and-publish.yml`)
    - Create GitHub release (this triggers CI; CI builds from source and publishes)
    - **Monitor CI workflow**: Wait for CI build to complete successfully
      - Check GitHub Actions workflow status
      - Verify all CI checks pass
      - Verify package appears in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - Run: `npm publish` (automatically publishes to GitHub Registry)
    - Verify: Package appears in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package is successfully published to GitHub Packages
  - [ ] Tag: `git tag v0.7.11`
  - [ ] Push: `git push origin v0.7.11`
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] Title: `v0.7.11`
  - [ ] Description: Copy from CHANGELOG.md
  - [ ] Target: `release/v0.7.11` branch (or `main` if release branch merged)
- [ ] **Post-Release**: Merge release branch to main (if not already merged)
  - [ ] Merge: `release/v0.7.11` → `main`
  - [ ] Push: `git push origin main`

### 🚨 Important Notes
- This is a patch release - no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes (include Fix: Issue #381 – OpenAI Realtime proxy)

### ✅ Completion Criteria
- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated
- [ ] All tests passing

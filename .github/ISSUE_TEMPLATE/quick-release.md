---
name: Quick Release
about: Quick release process for patch versions
title: 'Quick Release vX.X.X: Patch Release'
labels: ['release', 'patch', 'priority:medium']
assignees: ''
---

<!-- 
CLI Usage:
gh issue create --template quick-release.md --title "Quick Release vX.X.X: Patch Release" --label "release,patch,priority:medium"
-->

## 🚀 Quick Release vX.X.X - Patch Release

### Overview
This is a patch release for version vX.X.X of the Deepgram Voice Interaction React component. This release includes bug fixes and minor improvements with no breaking changes.

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

#### Version & Build
- [ ] **Bump Version**: Update to vX.X.X
  - [ ] Run: `npm version patch`
- [ ] **Build Package**: Create production build
  - [ ] Run: `npm run build`
- [ ] **Test Package**: Verify package works
  - [ ] Run: `npm run package:local`

#### Documentation
- [ ] **⚠️ CRITICAL: Create Release Documentation BEFORE Publishing** ⚠️
  - [ ] Create: `docs/releases/vX.X.X/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `vX.X.X` and `X.X.X` placeholders with actual version
  - [ ] Create: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs X.X.X` (version without "v" prefix)
- [ ] **Update Version**: Update version references in docs
- [ ] **⚠️ DO NOT proceed to Release section until documentation is complete** ⚠️

#### Release
- [ ] **Commit Changes**: Commit all release-related changes (including documentation)
  - [ ] Commit: `git add . && git commit -m "chore: prepare release vX.X.X"`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `git checkout -b release/vX.X.X` (from current working branch or main)
  - [ ] Push: `git push origin release/vX.X.X`
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **⚠️ Documentation must be committed to release branch BEFORE creating GitHub release** ⚠️
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/test-and-publish.yml`)
    - Create GitHub release (this triggers CI publish workflow)
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
  - [ ] Tag: `git tag vX.X.X`
  - [ ] Push: `git push origin vX.X.X`
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] Title: `vX.X.X`
  - [ ] Description: Copy from CHANGELOG.md
  - [ ] Target: `release/vX.X.X` branch (or `main` if release branch merged)
- [ ] **Post-Release**: Merge release branch to main (if not already merged)
  - [ ] Merge: `release/vX.X.X` → `main`
  - [ ] Push: `git push origin main`

### 🚨 Important Notes
- This is a patch release - no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes

### ✅ Completion Criteria
- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated
- [ ] All tests passing

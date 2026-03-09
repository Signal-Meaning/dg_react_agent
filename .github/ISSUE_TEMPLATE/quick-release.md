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

**Process order — do not skip:** Complete **Pre-Release** (tests, lint, audit) before Version & Build or Release. Do **not** create the GitHub release or publish until Pre-Release is complete.

#### Pre-Release
- [ ] **Tests Passing**: All tests passing
  - [ ] Run: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
  - [ ] **⚠️ REQUIRED if this patch fixes proxy/API behavior** (e.g. openai-proxy, message ordering, session.update timing): Run real-API integration test. Mock-only success is **not** sufficient. When `OPENAI_API_KEY` is available:
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All in-scope tests pass against the real API. If keys are not available, document the exception.
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`
- [ ] **npm audit (prerequisite for CI)**: No high/critical vulnerabilities — **required before triggering workflow**
  - [ ] Run: `npm audit --audit-level=high` — must pass (exit 0). CI runs this same check; passing locally avoids workflow failure at the audit step.
  - [ ] If it fails: fix with `npm audit fix` or overrides as per policy, then re-run until it passes.

#### Version & Build (CI performs build — no local build required)
- [ ] **Bump Version**: Update to vX.X.X
  - [ ] Run: `npm version patch`
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Publish below).
- [ ] **Optional**: Run `npm run build` or `npm run package:local` locally to verify; do **not** commit any `.tgz` (gitignored).

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

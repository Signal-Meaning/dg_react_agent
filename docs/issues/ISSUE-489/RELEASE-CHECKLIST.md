# Issue #489: Quick Release v0.9.8 – Release Checklist

**GitHub:** [#489 Quick Release v0.9.8: Patch Release](https://github.com/Signal-Meaning/dg_react_agent/issues/489)

**Source template:** `.github/ISSUE_TEMPLATE/quick-release.md`

**Branch:** Create `release/v0.9.8` from `main` after version bump and release docs are committed (or from a feature branch that has been merged to main). Do not create the release branch until version is bumped and documentation is in place.

---

## Quick Release v0.9.8 – Patch Release

### Overview

This is a patch release for version v0.9.8 of the Deepgram Voice Interaction React component. This release includes bug fixes and minor improvements with no breaking changes.

**Packages:** **@signal-meaning/voice-agent-react** (root 0.9.8). **@signal-meaning/voice-agent-backend** — bump only if releasing backend in this release; otherwise leave at current version.

---

### Pre-Release

- [ ] **Tests Passing**: All tests passing
  - [ ] Run: `npm run lint` then `npm run test:mock` (what CI runs)
  - [ ] Optionally full suite: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
    - [ ] Verify: All tests pass in proxy mode before proceeding
  - [ ] **⚠️ REQUIRED if this patch fixes proxy/API behavior** (e.g. openai-proxy, message ordering, session.update timing): Run real-API integration test. Mock-only success is **not** sufficient. When `OPENAI_API_KEY` is available:
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All in-scope tests pass against the real API. If keys are not available, document the exception.
- [ ] **Linting Clean**: No linting errors
  - [ ] Run: `npm run lint`

### Version & Build (CI performs build — no local build required)

- [ ] **Bump Version**: Update to v0.9.8
  - [ ] Run: `npm version patch --no-git-tag-version` (or `npm version patch` if committing immediately)
  - [ ] Commit version bump when ready for release branch
- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Publish below).
- [ ] **Optional**: Run `npm run build` or `npm run package:local` locally to verify; do **not** commit any `.tgz` (gitignored).

### Documentation

- [ ] **⚠️ CRITICAL: Create Release Documentation BEFORE Publishing** ⚠️
  - [ ] Create: `docs/releases/v0.9.8/` directory
  - [ ] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - Replace `vX.X.X` and `X.X.X` placeholders with v0.9.8 and 0.9.8
  - [ ] Create: `RELEASE-NOTES.md` (optional but standard)
- [ ] **Validate Documentation**: Run validation to ensure all required documents are present
  - [ ] Run: `npm run validate:release-docs 0.9.8` (version without "v" prefix)
- [ ] **Update Version**: Update version references in docs
- [ ] **⚠️ DO NOT proceed to Release section until documentation is complete** ⚠️

### Release

- [ ] **Commit Changes**: Commit all release-related changes (including documentation)
  - [ ] Commit: Version bump and release docs; message e.g. `chore: prepare release v0.9.8 (Issue #489)`
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] Create: `git checkout -b release/v0.9.8` (from current working branch or main)
  - [ ] Push: `git push origin release/v0.9.8`
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **⚠️ Documentation must be committed to release branch BEFORE creating GitHub release** ⚠️
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/test-and-publish.yml`)
    - Create GitHub release (this triggers CI; CI builds from source and publishes)
    - **Monitor CI workflow**: Wait for CI build to complete successfully
      - Check GitHub Actions workflow status
      - Verify all CI checks pass
      - Verify package(s) appear in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - Run: `npm publish` from repo root (automatically publishes to GitHub Registry)
    - Verify: Package appears in GitHub Packages
    - **Only proceed to tagging if publish succeeds**
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package is successfully published to GitHub Packages
  - [ ] Tag: `git tag v0.9.8`
  - [ ] Push: `git push origin v0.9.8`
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] Title: `Release v0.9.8` (or `v0.9.8`)
  - [ ] Description: Copy from CHANGELOG.md
  - [ ] Target: `release/v0.9.8` branch (or `main` if release branch merged)
- [ ] **Post-Release**: Merge release branch to main via PR
  - [ ] Open PR: `release/v0.9.8` → `main`
  - [ ] Merge via GitHub (do not push directly to main)
  - [ ] **Do not** delete the release branch (release branches are permanent per .cursorrules)

### Post-Release

- [ ] **Close #489** on GitHub with comment linking to `docs/issues/ISSUE-489/` and this checklist (after GitHub release and CI publish succeed)
- [ ] **Labels**: Add `release`, `v0.9.8` to release and/or release branch as per repo practice
- [ ] **Announcement** (if applicable)

---

### 🚨 Important Notes

- This is a patch release — no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes for this release

### ✅ Completion Criteria

- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated
- [ ] All tests passing
- [ ] Release branch merged to main via PR
- [ ] #489 closed with link to this folder

---

### References

- [Quick release template](.github/ISSUE_TEMPLATE/quick-release.md)
- [Full release checklist template](.github/ISSUE_TEMPLATE/release-checklist.md)
- [PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md)

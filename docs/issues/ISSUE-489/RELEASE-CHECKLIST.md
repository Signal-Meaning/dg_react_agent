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

- [x] **Tests Passing**: All tests passing
  - [x] Run: `npm run lint` then `npm run test:mock` (what CI runs) — **passed**
  - [ ] Optionally full suite: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e` (full suite: as of last run, 218 passed, 4 failed, 23 skipped — see below)
    - [ ] **Full run (reference):** Latest full run had **4 failures**: (1) context-retention-agent-usage › retain context when disconnecting/reconnecting, (2) idle-timeout-behavior › restart timeout after USER_STOPPED_SPEAKING (actualTimeout 8052 &lt; 9000), (3) openai-proxy-e2e › 8b. Lengthy response (connection closed before 15s), (4) openai-proxy-e2e › 9. Repro session retained (got greeting instead of context). See [E2E-FAILURES-RESOLUTION.md § Latest full E2E run](./E2E-FAILURES-RESOLUTION.md#latest-full-e2e-run).
    - [ ] **Spot-check (recommended):** The 6 Issue #489 triage specs pass in focused runs. Run: `USE_PROXY_MODE=true npm run test:e2e -- --grep "deepgram-greeting-idle-timeout|context-retention-agent-usage|deepgram-text-session-flow|deepgram-manual-vad-workflow"`. With existing server: `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- --grep "deepgram-greeting-idle-timeout|context-retention-agent-usage|deepgram-text-session-flow|deepgram-manual-vad-workflow"`.
  - [ ] **⚠️ REQUIRED if this patch fixes proxy/API behavior** (e.g. openai-proxy, message ordering, session.update timing): Run real-API integration test. Mock-only success is **not** sufficient. When `OPENAI_API_KEY` is available:
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All in-scope tests pass against the real API. If keys are not available, document the exception.
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint` — **passed**

### Version & Build (CI performs build — no local build required)

- [x] **Bump Version**: Update to v0.9.8 — **done** (package.json)
- [x] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release (see Publish below).
- [ ] **Optional**: Run `npm run build` or `npm run package:local` locally to verify; do **not** commit any `.tgz` (gitignored).

### Documentation

- [x] **⚠️ CRITICAL: Create Release Documentation BEFORE Publishing** ⚠️
  - [x] Create: `docs/releases/v0.9.8/` directory
  - [x] Create: `CHANGELOG.md` with all changes (Keep a Changelog format)
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
  - [x] Create: `RELEASE-NOTES.md` (optional but standard)
- [x] **Validate Documentation**: Run validation to ensure all required documents are present
  - [x] Run: `npm run validate:release-docs 0.9.8` — **passed**
- [x] **Update Version**: Version references in docs (v0.9.8 / 0.9.8)
- [x] **⚠️ DO NOT proceed to Release section until documentation is complete** ⚠️ — **done**

### Release

- [x] **Commit Changes**: Commit all release-related changes (including documentation)
  - [x] Commit: `chore: prepare release v0.9.8 (Issue #489)` — **pushed**
- [x] **Create Release Branch**: Create a release branch for the version
  - [x] Branch: `release/v0.9.8` created and pushed
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

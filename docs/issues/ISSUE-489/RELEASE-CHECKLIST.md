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
  - [x] Optionally full suite: `npm test` — **passed** (107 suites, 982 tests; 2 suites / 30 tests skipped)
  - [x] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [x] Run: `npm run test:e2e` from test-app (proxy is default).
    - [x] **Latest full run:** 223+ passed, 24 skipped, **2 failed** (see below). Core flows (openai-proxy-e2e 9/9a/10, idle timeout, context-retention) pass.
    - **2 remaining E2E failures** (documented in [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md)): (1) **declarative-props-api.spec.js** — `interruptAgent prop › should interrupt TTS when interruptAgent prop is true` (real-API/timing; race fix applied; skipped in CI). (2) **openai-proxy-tts-diagnostic.spec.js** — `diagnose TTS path` (env/backend-dependent).
    - **Real-API E2E run:** TTS diagnostic passes with real proxy; interruptAgent tests use `skipIfNoRealBackendAsync()` (probe backend). Component fix: `interruptAgent()` dispatches `PLAYBACK_STATE_CHANGE` so `audio-playing-status` updates. E2E interruptAgent describe: 2 tests passed (callback, clear); 1 skipped in CI by design. See [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md).
  - [ ] **⚠️ REQUIRED if this patch fixes proxy/API behavior:** Run real-API integration test when `OPENAI_API_KEY` is available. When running:
    - [ ] Run: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
    - [ ] Verify: All in-scope tests pass against the real API. If keys are not available, document the exception.
    - **Note:** Run locally when `OPENAI_API_KEY` is set; real-API tests are skipped otherwise. This release includes settings/context refactor (proxy message path); running the integration test before publish is recommended when the key is available.
- [x] **Linting Clean**: No linting errors
  - [x] Run: `npm run lint` — **passed**
- [ ] **npm audit (prerequisite for CI)**: No high/critical vulnerabilities — **required before triggering workflow**
  - [ ] Run: `npm audit --audit-level=high` — must pass (exit 0). CI runs this same check; passing locally avoids workflow failure at the audit step.
  - [ ] If it fails: fix with `npm audit fix` or overrides as per policy, then re-run until it passes.

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
  - [x] Commit: `fix(Issue #489): interruptAgent + DRY real-API + backend reachability` — **pushed** (component fix, E2E helpers DRY + reachability, interruptAgent tests use skipIfNoRealBackendAsync)
- [x] **Create Release Branch**: Create a release branch for the version
  - [x] Branch: `release/v0.9.8` created and pushed
- [ ] **Publish**: Publish to GitHub Registry — **← TRIGGER CI/CD**
  - [x] **⚠️ Documentation must be committed to release branch BEFORE creating GitHub release** ⚠️ — **done** (all release docs and E2E updates committed and pushed to `release/v0.9.8`)
  - [ ] **Preferred**: Use CI build (`.github/workflows/test-and-publish.yml`)
    - **Trigger:** GitHub **Actions** → **Test and Publish Package** → **Run workflow** → set **Branch** to `release/v0.9.8` (leave Version empty) → Run. Or from CLI: `gh workflow run "Test and Publish Package" --ref release/v0.9.8`.
    - **Monitor CI workflow**: Wait for workflow to complete successfully → verify package(s) appear in GitHub Packages.
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

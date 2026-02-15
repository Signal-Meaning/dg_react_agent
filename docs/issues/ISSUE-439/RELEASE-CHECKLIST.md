# Release checklist (Issue #439)

**Source:** [.github/ISSUE_TEMPLATE/release-checklist.md](../../.github/ISSUE_TEMPLATE/release-checklist.md)  
**Issue:** [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439) — OpenAI proxy: start() with no options must not request transcription

Use this checklist when cutting a release that includes the Issue #439 fix. Replace `vX.X.X` with the actual version (e.g. `v0.8.4`).

---

## 🚀 Release vX.X.X — Complete Release Process

### Overview

This release includes **Issue #439**: when the host uses an OpenAI proxy (`proxyEndpoint` containing `/openai`) and calls `ref.current.start()` with no arguments, the component no longer requests or creates a transcription manager; the session is agent-only. This checklist follows the repo release template.

The repository publishes two packages. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). **The backend has already been bumped** (e.g. Issue #441 → 0.1.2). For this release (#439), bump only the **root** component version.

---

### 📋 Release Checklist

#### Pre-Release Preparation

- [ ] **Code Review Complete**: All PRs for this release merged and reviewed
- [ ] **Tests Passing**
  - [ ] Run: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode**
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Verify: All tests pass in proxy mode before proceeding
- [ ] **Linting Clean**
  - [ ] Run: `npm run lint`
- [ ] **Documentation Updated**: Issue #439 docs and BACKEND-PROXY/MIGRATION-GUIDE.md (OpenAI proxy agent-only) are current
- [ ] **API Changes Documented**: Any API changes in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: None expected for #439; document if any

#### Version Management

- [ ] **Bump Version**: Update root `package.json` to vX.X.X
  - [ ] Run: `npm version [patch/minor/major]` (or manually update)
- [x] **Voice-agent-backend version**: Already bumped (no change needed for this release)
- [ ] **Update Dependencies** (optional): `npm update` and review

#### Build and Package

- [ ] **No local build required for release.** CI builds when you create the GitHub release.
- [ ] **Optional local check**: `npm run clean` then `npm run build` then `npm run validate`. Do not commit `.tgz` or `dist/`; CI builds from source.

#### Documentation

- [ ] **Create Release Documentation**
  - [ ] Create: `docs/releases/vX.X.X/` directory
  - [ ] Create: `CHANGELOG.md` (Keep a Changelog format; include Issue #439)
  - [ ] Create: `MIGRATION.md` if there are breaking changes
  - [ ] Create: `NEW-FEATURES.md` for new features (or omit if patch-only)
  - [ ] Create: `API-CHANGES.md` for API changes (or omit if none)
  - [ ] Create: `RELEASE-NOTES.md` (short summary and install instructions)
  - [ ] Create: `PACKAGE-STRUCTURE.md` from `docs/releases/PACKAGE-STRUCTURE.template.md` (replace version placeholders)
- [ ] **Validate Documentation**
  - [ ] Run: `npm run validate:release-docs vX.X.X`
- [ ] **Review Documentation**: Completeness, accuracy, working links

#### Git Operations

- [ ] **Commit Changes**
  - [ ] Commit: Version bump and release docs
  - [ ] Message: `chore: prepare release vX.X.X`
- [ ] **Create Release Branch**
  - [ ] Create: `release/vX.X.X` branch
  - [ ] Push: `git push origin release/vX.X.X`

#### Package Publishing

- [ ] **Publish via CI**
  - [ ] Create GitHub release (tag `vX.X.X`, target `release/vX.X.X` or `main` per workflow) to trigger `.github/workflows/test-and-publish.yml`
  - [ ] CI: test (mock), build, validate, then publish root (and voice-agent-backend only if its version was bumped in this branch)
  - [ ] Monitor CI until publish succeeds
- [ ] **Tag Release** (after publish succeeds)
  - [ ] Tag: `git tag vX.X.X` (if not created by release UI)
  - [ ] Push: `git push origin vX.X.X`
- [ ] **Verify Installation**: Install `@signal-meaning/voice-agent-react@vX.X.X` and smoke-test

#### GitHub Release

- [ ] **Create GitHub Release**
  - [ ] Title: `Release vX.X.X`
  - [ ] Description: Changelog and notes (include Issue #439 fix)
  - [ ] Tag: `vX.X.X`
- [ ] **Labels**: Add `release`, `vX.X.X`, `documentation` to the release/issue as applicable

#### Post-Release

- [ ] **Merge to main via PR**
  - [ ] Open PR: `release/vX.X.X` → `main`
  - [ ] Merge via GitHub (do not push directly to `main`)
- [ ] **Announcement** (if applicable): Notify teams, update external docs

---

### ✅ Completion Criteria

This release is complete when:

- [ ] All checklist items above are completed
- [ ] Package(s) published to GitHub Package Registry
- [ ] GitHub release created and tagged
- [ ] Documentation in `docs/releases/vX.X.X/` is complete
- [ ] All tests passing; installation verified

---

### 🔗 References

- [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439)
- [TDD-PLAN.md](./TDD-PLAN.md) — Issue #439 implementation plan
- [Release template](https://github.com/Signal-Meaning/dg_react_agent/blob/main/.github/ISSUE_TEMPLATE/release-checklist.md)
- [Release documentation standards](../../releases/README.md)

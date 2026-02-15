# Release checklist (Issue #439)

**Source:** [.github/ISSUE_TEMPLATE/release-checklist.md](../../.github/ISSUE_TEMPLATE/release-checklist.md)  
**Issue:** [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439) — OpenAI proxy: start() with no options must not request transcription

Use this checklist when cutting a release that includes the Issue #439 fix. **This run: v0.8.4.**

---

## 🚀 Release v0.8.4 — Complete Release Process

### Overview

This release includes **Issue #439**: when the host uses an OpenAI proxy (`proxyEndpoint` containing `/openai`) and calls `ref.current.start()` with no arguments, the component no longer requests or creates a transcription manager; the session is agent-only. This checklist follows the repo release template.

The repository publishes two packages. CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs: **@signal-meaning/voice-agent-react** (root) and **@signal-meaning/voice-agent-backend** (`packages/voice-agent-backend`). **The backend has already been bumped** (e.g. Issue #441 → 0.1.2). For this release (#439), bump only the **root** component version.

---

### 📋 Release Checklist

#### Pre-Release Preparation

- [ ] **Code Review Complete**: All PRs for this release merged and reviewed
- [x] **Tests Passing**
  - [x] Run: `npm run test:mock` — passed
  - [x] **E2E tests in proxy mode** — passed (fix: 16k + 24k retry for UserStartedSpeaking in idle timeout state machine test)
- [x] **Linting Clean**
  - [x] Run: `npm run lint` — passed
- [ ] **Documentation Updated**: Issue #439 docs and BACKEND-PROXY/MIGRATION-GUIDE.md (OpenAI proxy agent-only) are current
- [ ] **API Changes Documented**: Any API changes in API-REFERENCE.md evolution section
- [ ] **Breaking Changes Documented**: None expected for #439; document if any

#### Version Management

- [x] **Bump Version**: Update root `package.json` to v0.8.4
  - [x] Bumped to 0.8.4
- [x] **Voice-agent-backend version**: Already bumped (no change needed for this release)
- [ ] **Update Dependencies** (optional): `npm update` and review

#### Build and Package

- [ ] **No local build required for release.** CI builds when you create the GitHub release.
- [ ] **Optional local check**: `npm run clean` then `npm run build` then `npm run validate`. Do not commit `.tgz` or `dist/`; CI builds from source.

#### Documentation

- [x] **Create Release Documentation**
  - [x] Create: `docs/releases/v0.8.4/` directory
  - [x] Create: `CHANGELOG.md` (Keep a Changelog format; include Issue #439)
  - [x] Omit MIGRATION.md, NEW-FEATURES.md, API-CHANGES.md (patch-only)
  - [x] Create: `RELEASE-NOTES.md` (short summary and install instructions)
  - [x] Create: `PACKAGE-STRUCTURE.md` (v0.8.4)
- [x] **Validate Documentation**
  - [x] Run: `npm run validate:release-docs 0.8.4` — passed
- [ ] **Review Documentation**: Completeness, accuracy, working links

#### Git Operations

- [x] **Commit Changes**
  - [x] Commit: Version bump and release docs
  - [x] Message: `chore: prepare release v0.8.4`
- [x] **Create Release Branch**
  - [x] Create: `release/v0.8.4` branch
  - [x] Push: `git push origin release/v0.8.4`

#### Package Publishing

- [x] **Update NPM_TOKEN if expired** (required for publish to succeed)
  - **Doc:** [Publishing and Releasing](../../PUBLISHING-AND-RELEASING.md) — token creation/update, where used; see also [PUBLISH-BACKEND-401-INVESTIGATION.md](../ISSUE-425/PUBLISH-BACKEND-401-INVESTIGATION.md) for 401 investigation.
  - **Where used:** `.github/workflows/test-and-publish.yml` (and `debug-auth.yml`); secret name: `NPM_TOKEN`.
- [x] **Publish via CI**
  - [x] Create GitHub release (tag `v0.8.4`, target `release/v0.8.4`) to trigger `.github/workflows/test-and-publish.yml`
  - [x] CI: test (mock), build, validate, then publish root (workflow_dispatch run 22028792286)
  - [x] Monitor CI until publish succeeds
- [x] **Tag Release** (after publish succeeds; often created by GitHub release UI)
  - [x] Tag: `v0.8.4` (exists on remote)
- [ ] **Verify Installation**: Install `@signal-meaning/voice-agent-react@0.8.4` and smoke-test (optional: requires NPM_TOKEN / GitHub Packages auth)

#### GitHub Release

- [x] **Create GitHub Release**
  - [x] Title: `Release v0.8.4`
  - [x] Description: Changelog and notes (include Issue #439 fix); use `docs/releases/v0.8.4/RELEASE-NOTES.md` and `CHANGELOG.md`
  - [x] Tag: `v0.8.4` (create from `release/v0.8.4`)
- [ ] **Labels**: Add `release`, `v0.8.4`, `documentation` to the release/issue as applicable

#### Post-Release

- [x] **Merge to main via PR**
  - [x] Open PR: `release/v0.8.4` → `main` — [PR #443](https://github.com/Signal-Meaning/dg_react_agent/pull/443)
  - [ ] Merge via GitHub (do not push directly to `main`)
- [ ] **Announcement** (if applicable): Notify teams, update external docs

---

### ✅ Completion Criteria

This release is complete when:

- [ ] All checklist items above are completed
- [ ] Package(s) published to GitHub Package Registry
- [ ] GitHub release created and tagged
- [ ] Documentation in `docs/releases/v0.8.4/` is complete
- [ ] All tests passing; installation verified

---

### 🔗 References

- [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439)
- [TDD-PLAN.md](./TDD-PLAN.md) — Issue #439 implementation plan
- [Release template](https://github.com/Signal-Meaning/dg_react_agent/blob/main/.github/ISSUE_TEMPLATE/release-checklist.md)
- [Release documentation standards](../../releases/README.md)

# Issue #462: Release v0.9.2 / 0.2.2 – Release Checklist (patch)

**GitHub:** [#462 Fix: conversation_already_has_active_response still occurs on 0.9.1/0.2.1](https://github.com/Signal-Meaning/dg_react_agent/issues/462)

**Scope:** Patch release for both packages: **@signal-meaning/voice-agent-react@0.9.2** and **@signal-meaning/voice-agent-backend@0.2.2**. Fix: do not clear `responseInProgress` on `response.output_audio.done`; clear only on `response.output_text.done` (PR #463 merged to main).

**Post-release:** Follow up with voice-commerce with release and resolution; close #462 and update #459.

---

## 🚀 Release v0.9.2 / 0.2.2 – Patch

### Overview

Patch release to fix `conversation_already_has_active_response` still occurring at voice-commerce on 0.9.1/0.2.1. Root cause: proxy cleared “response active” on `response.output_audio.done`; the real API can send audio.done before text.done, allowing a subsequent Settings → `session.update` while the API still had an active response.

CI (`.github/workflows/test-and-publish.yml`) publishes both packages when the workflow runs. Bump **root** to **0.9.2** and **packages/voice-agent-backend** to **0.2.2**.

---

### 📋 Release Checklist

#### Pre-Release Preparation

- [x] **Code Review Complete**: PR #463 merged to main
- [ ] **Tests Passing**: All unit tests and E2E tests passing
  - [x] **Run what CI runs:** `npm run lint` then `npm run test:mock` — passed
  - [ ] Optionally: `npm test`
  - [ ] **⚠️ CRITICAL: Run E2E tests in proxy mode**
    - [ ] Start backend: `cd test-app && npm run backend`
    - [ ] Run: `USE_PROXY_MODE=true npm run test:e2e`
    - [ ] Verify: All tests pass in proxy mode
  - [ ] **Optional:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` when OPENAI_API_KEY available
- [x] **Linting Clean:** `npm run lint` — passed
- [ ] **Documentation Updated**: ISSUE-462 README/TRACKING/ANALYSIS updated; release docs below

#### Version Management

- [x] **Bump root version:** Update root `package.json` to **0.9.2**
  - [x] Run: `npm version patch` (or manually set to 0.9.2)
- [x] **Bump voice-agent-backend version:** Update `packages/voice-agent-backend/package.json` to **0.2.2**
- [ ] **Update Dependencies:** `npm update` (optional; no dependency changes required for this patch)

#### Build and Package

- [ ] **Do not run build/package locally for release.** CI builds and validates when you create the GitHub release.
- [ ] **Optional local validation:** `npm run clean` then `npm run build` then `npm run validate` (do not commit .tgz or dist/)

#### Documentation

- [x] **Create Release Documentation:** `docs/releases/v0.9.2/`
  - [x] Create: `CHANGELOG.md` (Keep a Changelog; Fixed: conversation_already_has_active_response – Issue #462)
  - [x] Create: `MIGRATION.md` (no breaking changes)
  - [x] Create: `NEW-FEATURES.md` (patch: backend fix only)
  - [x] Create: `API-CHANGES.md` (none for component; backend 0.2.2)
  - [x] Create: `EXAMPLES.md` (install 0.9.2 / 0.2.2)
  - [x] Create: `PACKAGE-STRUCTURE.md` (from template, v0.9.2)
  - [x] Create: `RELEASE-NOTES.md`
- [x] **Validate:** `npm run validate:release-docs 0.9.2` — passed
- [ ] **Update Main Documentation:** README/docs as needed (e.g. version badge if applicable)

#### Git Operations

- [x] **Commit Changes:** Version bump and release docs
  - [x] Message: `chore: prepare release v0.9.2 (Issue #462)`
- [ ] **Create Release Branch:**
  - [ ] Preferred: from **main** after merge: `npm run release:issue 0.9.2 patch` (creates issue and branch; fails if branch exists or version mismatch)
  - [ ] Or manually: Create `release/v0.9.2`, push: `git push origin release/v0.9.2`

#### Package Publishing

- [ ] **Publish via CI:**
  - [ ] **Version must be bumped** on the release branch and committed before creating the GitHub release
  - [ ] Create GitHub release (tag **v0.9.2**) to trigger `.github/workflows/test-and-publish.yml`
  - [ ] Monitor CI: test job then publish job; both packages published
  - [ ] Verify both packages in GitHub Packages: voice-agent-react@0.9.2, voice-agent-backend@0.2.2
- [ ] **Tag Release (after publish succeeds):**
  - [ ] Tag: `git tag v0.9.2`
  - [ ] Push: `git push origin v0.9.2`
- [ ] **Verify Installation:** Install @signal-meaning/voice-agent-react@0.9.2 and @signal-meaning/voice-agent-backend@0.2.2 in a test app

#### GitHub Release

- [ ] **Create GitHub Release:** Title “Release v0.9.2”, tag v0.9.2, description with changelog
- [ ] **Labels:** Add release / v0.9.2 as needed

#### Post-Release

- [ ] **Merge release branch to main via PR:** Open PR `release/v0.9.2` → `main`, merge (do not push directly to main)
- [ ] **Follow up with voice-commerce:** Send release version and resolution (they are not to be contacted until we have a release)
- [ ] **Close #462** on GitHub with comment linking to `docs/issues/ISSUE-462/`
- [ ] **Update #459** with resolution pointer (e.g. “Fixed in #462 / v0.9.2 / v0.2.2”)

---

### ✅ Completion Criteria

- [ ] All checklist items completed
- [ ] Both packages published (0.9.2, 0.2.2)
- [ ] GitHub release v0.9.2 created
- [ ] Voice-commerce followed up; #462 closed; #459 updated

---

**Source of truth for full process:** `.github/ISSUE_TEMPLATE/release-checklist.md`

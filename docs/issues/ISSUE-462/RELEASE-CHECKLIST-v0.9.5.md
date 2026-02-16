# Issue #462: Release v0.9.5 / 0.2.5 – Release Checklist (from davidrmcgee/issue462)

**GitHub:** [#462 Fix: conversation_already_has_active_response still occurs (reopened)](https://github.com/Signal-Meaning/dg_react_agent/issues/462)

**Branch:** `davidrmcgee/issue462` → create `release/v0.9.5` when ready to release.

**Scope:** Function-call qualification uses real backend HTTP (no in-test hardcoded FunctionCallResponse); process guards in .cursorrules, BACKEND-PROXY-DEFECTS, and release checklist; docs (VOICE-COMMERCE-FUNCTION-CALL-REPORT, README). No proxy code change in this release — test and process fixes so we do not repeat the false qualification.

**Use the git release template:** `.github/ISSUE_TEMPLATE/release-checklist.md` is the source of truth. This file is a focused checklist for preparing a release from this branch.

---

## Release v0.9.5 (component) / 0.2.5 (backend) – Preparation

### Overview

Patch release from branch `davidrmcgee/issue462`. Delivers:

- **Integration test:** Real-API function-call test now POSTs to an in-process minimal backend (no hardcoded FunctionCallResponse). Path: client → proxy → real API → FunctionCallRequest → **HTTP POST to backend** → FunctionCallResponse → proxy → API.
- **Process guards:** .cursorrules and `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md` require function-call flow qualification to use real backend HTTP; release checklist template updated with function-call sub-bullet.
- **Docs:** ISSUE-462 VOICE-COMMERCE-FUNCTION-CALL-REPORT (acknowledgment + “What we did”), README and release checklist (this file).

Two packages: **@signal-meaning/voice-agent-react** (root 0.9.5), **@signal-meaning/voice-agent-backend** (0.2.5). Backend version bump is optional if no backend code changed; bump if you want to ship a single version number for “process + test” release.

---

### Pre-Release Preparation

- [x] **Code Review Complete**: All PRs merged and code reviewed
- [x] **Tests Passing**
  - [x] Run what CI runs: `npm run lint` then `npm run test:mock` — **passed** (lint clean; 96 test suites passed, 28 skipped)
  - [ ] **E2E in proxy mode (optional):** `cd test-app && npm run backend` then `USE_PROXY_MODE=true npm run test:e2e` (or subset, e.g. openai-proxy-e2e)
  - [ ] **Real-API qualification (required for proxy/API behavior):** When `OPENAI_API_KEY` available: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — all in-scope tests pass. Function-call test now uses real backend HTTP (in-process minimal server).
- [x] **Linting Clean**: `npm run lint` — **passed**
- [x] **Documentation Updated**: ISSUE-462 docs, VOICE-COMMERCE-FUNCTION-CALL-REPORT, .cursorrules, BACKEND-PROXY-DEFECTS (done in prior commits)
- [x] **API Changes Documented**: None (no component/backend API changes)
- [x] **Breaking Changes Documented**: None

### Version Management

- [x] **Bump Version**: Root `package.json` → 0.9.5 — **done**
- [x] **Bump voice-agent-backend:** `packages/voice-agent-backend/package.json` → 0.2.5 — **done**
- [ ] **Update Dependencies (optional):** `npm update`; review if needed

### Build and Package (CI performs build)

- [x] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional local validation**: `npm run clean && npm run build && npm run validate` (do not commit dist/.tgz)

### Documentation

- [x] **Create Release Documentation**
  - [x] Create: `docs/releases/v0.9.5/` directory
  - [x] Create: `CHANGELOG.md` (Keep a Changelog; Fixed: function-call qualification uses real backend HTTP, process guards for #462)
  - [x] Create: `RELEASE-NOTES.md`
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
  - [x] MIGRATION.md / NEW-FEATURES.md / API-CHANGES.md / EXAMPLES.md — not required for this patch (no API changes)
- [x] **Validate Documentation**: `npm run validate:release-docs 0.9.5` — **passed**
- [x] **Review Documentation**: Completeness, links, typos — done

### Git Operations

- [ ] **Commit release docs**: e.g. `chore: add release docs for v0.9.5`
- [ ] **Create Release Branch**: From `davidrmcgee/issue462` (or from main after merge): create `release/v0.9.5`, push: `git checkout -b release/v0.9.5` then `git push origin release/v0.9.5`
  - Or use: `npm run release:issue 0.9.5 patch` if available (creates issue and branch)

### Package Publishing

- [ ] **Publish via CI**
  - [ ] Create GitHub release (tag `v0.9.5`, target `release/v0.9.5`)
  - [ ] Monitor CI: test job (lint, test:mock, build, validate) then publish job
  - [ ] Verify package(s) in GitHub Packages
- [ ] **Tag**: Created with GitHub release (v0.9.5)
- [ ] **Verify Installation (optional):** Install from registry and smoke test

### GitHub Release

- [ ] **Create GitHub Release**
  - Title: `Release v0.9.5`
  - Description: CHANGELOG content or link to `docs/releases/v0.9.5/`
  - Tag: `v0.9.5`
  - Target: `release/v0.9.5`

### Post-Release

- [ ] **Merge to main via PR**: `release/v0.9.5` → `main` (do not push directly to main)
- [ ] **Follow up with voice-commerce** (if applicable): Point to v0.9.5 and that function-call qualification now uses real backend HTTP; see ISSUE-462 docs.
- [ ] **Close or update #462** with release and resolution

---

### Completion Criteria

- [ ] Lint and test:mock pass locally (and CI)
- [ ] Release docs created and validated for v0.9.5
- [ ] GitHub release created; CI published package(s)
- [ ] PR merged: `release/v0.9.5` → `main`

---

### References

- [Release checklist template](/.github/ISSUE_TEMPLATE/release-checklist.md) — source of truth
- [PUBLISHING-AND-RELEASING.md](/docs/PUBLISHING-AND-RELEASING.md)
- [ISSUE-462 VOICE-COMMERCE-FUNCTION-CALL-REPORT](./VOICE-COMMERCE-FUNCTION-CALL-REPORT.md)
- [.cursorrules](/../../.cursorrules) — Backend / Proxy Defects, Function-call flow: real backend HTTP required

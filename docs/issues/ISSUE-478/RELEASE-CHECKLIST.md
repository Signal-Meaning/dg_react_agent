# Issue #478: Release v0.9.6 – Release Checklist (from davidrmcgee/issue478)

**GitHub:** [#478 Defect: Function-call tests do not assert presentation of agent response (result content)](https://github.com/Signal-Meaning/dg_react_agent/issues/478)

**Branch:** Start from `davidrmcgee/issue478`. After merge to `main`, create `release/v0.9.6` from `main` (or from this branch before merge, per repo preference) and proceed to GitHub release to trigger CI publish.

**Scope:** Function-call tests (integration + E2E) now assert that the agent's reply presents the function result to the user. Integration: assistant `ConversationText` content includes 12:00 or UTC. E2E 6 & 6b: wait for `agent-response` to contain function result (UTC or time pattern), then assert. No component or backend API changes.

**Use the git release template:** `.github/ISSUE_TEMPLATE/release-checklist.md` is the source of truth. This file is a focused checklist for preparing a release from this branch.

---

## Release v0.9.6 (component) – Preparation

### Overview

Patch release from branch `davidrmcgee/issue478`. Delivers:

- **Integration test (Issue #470 real-API function-call):** Assert at least one assistant `ConversationText` content includes the function result (12:00 or UTC) so we verify the API delivered a reply that reflects the function-call result.
- **E2E tests 6 & 6b:** Wait for `[data-testid="agent-response"]` to contain the function result (regex `/UTC|\d{1,2}:\d{2}/`), then assert; use `FUNCTION_CALL_RESULT_TIMEOUT` 45s so we verify the user sees the agent's follow-up with the result.

**Packages:** **@signal-meaning/voice-agent-react** (root 0.9.6). **@signal-meaning/voice-agent-backend** — no code change; leave at 0.2.5 (do not bump unless releasing backend in same release).

---

### Pre-Release Preparation

- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [x] **Tests Passing**
  - [x] Run what CI runs: `npm run lint` then `npm run test:mock` — **passed** (lint clean; 96 suites, 924 tests passed)
  - [x] **E2E in proxy mode:** `USE_PROXY_MODE=true npm run test:e2e -- test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "6\\. Simple function calling|6b\\."` — **passed** (2 tests)
  - [ ] Optionally full E2E: `USE_PROXY_MODE=true npm run test:e2e`
  - [ ] **Real-API (optional for this release):** When `OPENAI_API_KEY` available: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — confirms Issue #470 real-API function-call test (with #478 assertion) passes against live API
- [x] **Linting Clean**: `npm run lint` — **no errors**
- [x] **Documentation Updated**: ISSUE-478 README, TRACKING (done on branch)
- [x] **API Changes Documented**: None (no component/backend API changes)
- [x] **Breaking Changes Documented**: None

### Version Management

- [x] **Bump Version**: Root `package.json` → 0.9.6 (patch) — **done**
- [x] **voice-agent-backend**: Leave at 0.2.5 (no backend code change)
- [ ] **Update Dependencies (optional):** `npm update`; review if needed

### Build and Package (CI performs build)

- [x] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional local validation**: `npm run clean && npm run build && npm run validate` (do not commit dist/.tgz)

### Documentation

- [x] **Create Release Documentation**
  - [x] Create: `docs/releases/v0.9.6/` directory
  - [x] Create: `CHANGELOG.md` (Keep a Changelog; Fixed: function-call tests assert presentation of agent response [#478])
  - [x] Create: `RELEASE-NOTES.md`
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (v0.9.6)
  - [x] MIGRATION.md / NEW-FEATURES.md / API-CHANGES.md / EXAMPLES.md — not required (no API changes)
- [x] **Validate Documentation**: `npm run validate:release-docs 0.9.6` — **passed**
- [ ] **Review Documentation**: Completeness, links, typos

### Git Operations

- [x] **Commit release prep**: Version bump and release docs; message `chore: prepare release v0.9.6 (Issue #478)` — **done**
- [ ] **Merge to main**: Open PR `davidrmcgee/issue478` → `main`; merge after review
- [ ] **Create Release Branch**: Create `release/v0.9.6` from `main` (or from merged state), push: `git push origin release/v0.9.6`
  - Or: `npm run release:issue 0.9.6 patch` (if script creates branch and issue; ensure root package.json is already 0.9.6)

### Package Publishing

- [ ] **Publish via CI**
  - [ ] Create GitHub release (tag `v0.9.6`, target `release/v0.9.6`)
  - [ ] Monitor CI: test job (lint, test:mock, build, validate) then publish job
  - [ ] Verify root package in GitHub Packages (@signal-meaning/voice-agent-react@0.9.6)
- [ ] **Tag**: Created with GitHub release (v0.9.6)
- [ ] **Verify Installation (optional):** Install @signal-meaning/voice-agent-react@0.9.6 and smoke test

### GitHub Release

- [ ] **Create GitHub Release**
  - Title: `Release v0.9.6`
  - Description: Changelog / release notes (link to docs/releases/v0.9.6/ or paste summary)
  - Tag: `v0.9.6`
  - Target: `release/v0.9.6`
- [ ] **Labels**: Add `release`, `v0.9.6` to release and/or release branch as per repo practice

### Post-Release

- [ ] **Merge to main via PR**: `release/v0.9.6` → `main` (do not push directly to main)
- [ ] **Close #478** on GitHub with comment linking to `docs/issues/ISSUE-478/` and this checklist
- [ ] **Announcement** (if applicable)

---

### Focused E2E (recommended)

| Scenario | Command (from repo root) | Notes |
|----------|---------------------------|--------|
| **Tests 6 & 6b (Issue #478)** | `USE_PROXY_MODE=true npm run test:e2e -- test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "6\\. Simple function calling\|6b\\."` | Asserts agent-response includes function result (UTC or time). |
| **OpenAI proxy E2E subset** | `USE_PROXY_MODE=true npm run test:e2e -- test-app/tests/e2e/openai-proxy-e2e.spec.js` | All tests in that spec. |
| **Full E2E** | `USE_PROXY_MODE=true npm run test:e2e` | Final validation. |

---

### Completion Criteria

- [x] Lint and test:mock pass locally (and CI)
- [x] E2E tests 6 and 6b pass in proxy mode
- [x] Release docs created and validated (`npm run validate:release-docs 0.9.6`)
- [ ] PR merged: `davidrmcgee/issue478` → `main`
- [ ] Release branch `release/v0.9.6` created and pushed
- [ ] GitHub release v0.9.6 created; CI published component package
- [ ] PR merged: `release/v0.9.6` → `main`
- [ ] #478 closed with link to this folder

---

### References

- [Release template](/.github/ISSUE_TEMPLATE/release-checklist.md)
- [PUBLISHING-AND-RELEASING.md](/docs/PUBLISHING-AND-RELEASING.md)
- [ISSUE-478 TRACKING](/docs/issues/ISSUE-478/TRACKING.md)

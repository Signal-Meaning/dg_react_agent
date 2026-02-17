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
- [x] **Merge to main**: PR [#479](https://github.com/Signal-Meaning/dg_react_agent/pull/479) created; merged locally (conflicts in v0.9.6 release docs resolved: combined #473/#475 and #478); `main` pushed.
- [x] **Create Release Branch**: `release/v0.9.6` created from `davidrmcgee/issue478`, then updated to match `main` (combined CHANGELOG/RELEASE-NOTES); pushed `origin/release/v0.9.6`.

### Package Publishing

- [ ] **Publish via CI**
  - [x] GitHub release for v0.9.6 already exists (tag `v0.9.6`; created for prior Issue #475). Ensure release target is `release/v0.9.6` and points to commit with combined #473+#478 docs; re-run workflow if needed to publish from updated branch.
  - [ ] Monitor CI: test job (lint, test:mock, build, validate) then publish job
  - [ ] Verify root package in GitHub Packages (@signal-meaning/voice-agent-react@0.9.6)
- [x] **Tag**: v0.9.6 exists
- [ ] **Verify Installation (optional):** Install @signal-meaning/voice-agent-react@0.9.6 and smoke test

### GitHub Release

- [x] **Create GitHub Release**
  - Release v0.9.6 / tag `v0.9.6` already exists. If the release was created before this merge, edit the release to point to `release/v0.9.6` (latest) so it includes #478 and combined CHANGELOG/RELEASE-NOTES.
- [ ] **Labels**: Add `release`, `v0.9.6` to release and/or release branch as per repo practice

### Post-Release

- [x] **Merge to main via PR**: N/A — `main` already contains release content (issue478 merged into main; `release/v0.9.6` fast-forwarded to main). No separate release→main PR needed.
- [ ] **Close #478** on GitHub with comment linking to `docs/issues/ISSUE-478/` and this checklist (after GitHub release is created and CI publish succeeds)
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
- [x] PR #479 merged: `davidrmcgee/issue478` → `main` (merged and pushed)
- [x] Release branch `release/v0.9.6` created and pushed (in sync with main)
- [ ] **GitHub release** v0.9.6: tag exists; ensure release target is `release/v0.9.6` (with #478 + combined docs) and CI publish has run / re-run if needed
- [x] release/v0.9.6 and main in sync (no separate release→main PR needed)
- [ ] #478 closed with link to this folder (after publish)

---

### References

- [Release template](/.github/ISSUE_TEMPLATE/release-checklist.md)
- [PUBLISHING-AND-RELEASING.md](/docs/PUBLISHING-AND-RELEASING.md)
- [ISSUE-478 TRACKING](/docs/issues/ISSUE-478/TRACKING.md)

# Issue #470: Release v0.9.4 – Release Checklist

**GitHub:** [#470 Release v0.9.4: Correct conversation_already_has_active_response in function-call flow](https://github.com/Signal-Meaning/dg_react_agent/issues/470)

**Scope:** Partner-scenario coverage (E2E 6b), OpenAI proxy fix (defer `response.create` until `response.output_text.done` after function_call_output), real-API integration tests, protocol docs. See `docs/issues/ISSUE-470/SCOPE.md`.

**Progress:** Release docs created. Pre-release validation in progress.

---

## Release v0.9.4 – Complete Release Process

### Overview

Patch release for **v0.9.4** (component) and **0.2.4** (voice-agent-backend). Fixes `conversation_already_has_active_response` in the OpenAI proxy function-call flow and adds E2E + integration coverage for the #462 partner scenario.

Two packages: **@signal-meaning/voice-agent-react** (root 0.9.4), **@signal-meaning/voice-agent-backend** (0.2.4). CI (`.github/workflows/test-and-publish.yml`) publishes both when the workflow runs.

---

### Pre-Release Preparation

- [ ] **Code Review Complete**: All PRs merged and code reviewed
- [ ] **Tests Passing**
  - [x] Run what CI runs: `npm run lint` then `npm run test:mock` — **passed**
  - [ ] **E2E in proxy mode:** `cd test-app && npm run backend` (in another terminal), then `USE_PROXY_MODE=true npm run test:e2e` — all must pass
  - [ ] **Real-API qualification (proxy/API behavior release):** When `OPENAI_API_KEY` available: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — all in-scope tests pass. Optional: `cd test-app && USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e --grep "6b.*462"` to confirm E2E 6b GREEN
- [x] **Linting Clean**: `npm run lint` — no errors
- [x] **Documentation Updated**: #470 scope docs, INVESTIGATION, PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE, TDD plans
- [x] **API Changes Documented**: None (no component/backend API changes)
- [x] **Breaking Changes Documented**: None

### Version Management

- [x] **Bump Version**: Root `package.json` at 0.9.4
- [x] **Bump voice-agent-backend**: `packages/voice-agent-backend/package.json` at 0.2.4
- [ ] **Update Dependencies** (optional): `npm update`; review if needed

### Build and Package (CI performs build)

- [ ] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional local validation**: `npm run clean && npm run build && npm run validate` (do not commit dist/.tgz)

### Documentation

- [x] **Create Release Documentation**
  - [x] `docs/releases/v0.9.4/CHANGELOG.md`
  - [x] `docs/releases/v0.9.4/RELEASE-NOTES.md`
  - [x] `docs/releases/v0.9.4/PACKAGE-STRUCTURE.md`
- [x] **Validate Documentation**: `npm run validate:release-docs 0.9.4` — passed
- [ ] **Review Documentation**: Completeness, links, typos

### Git Operations

- [ ] **Commit release docs** (if not already committed): e.g. `chore: add release docs for v0.9.4`
- [x] **Release branch**: `release/v0.9.4` exists; push any new commits

### Package Publishing

- [ ] **Publish via CI**
  - Create GitHub release (tag `v0.9.4`, target `release/v0.9.4`) to trigger `.github/workflows/test-and-publish.yml`
  - **Version must be 0.9.4 / 0.2.4 and committed on release branch before creating the release**
  - Monitor CI: test job (lint, test:mock, build, validate) then publish job
  - Verify both packages in GitHub Packages
- [ ] **Tag**: Created with GitHub release (v0.9.4)
- [ ] **Verify Installation** (optional): Install from registry and smoke test

### GitHub Release

- [ ] **Create GitHub Release**
  - Title: `Release v0.9.4`
  - Description: CHANGELOG content (or link to docs/releases/v0.9.4/)
  - Tag: `v0.9.4`
  - Target: `release/v0.9.4`

### Post-Release

- [ ] **Merge to main via PR**: `release/v0.9.4` → `main` (do not push directly to main)
- [ ] **Announcement** (if applicable)

---

### Completion Criteria

- [ ] Lint and test:mock pass locally (and CI)
- [ ] Release docs validated (`npm run validate:release-docs 0.9.4`)
- [ ] GitHub release created; CI published both packages
- [ ] PR merged: `release/v0.9.4` → `main`

---

### References

- [PUBLISHING-AND-RELEASING.md](/docs/PUBLISHING-AND-RELEASING.md)
- [ISSUE-470 SCOPE](/docs/issues/ISSUE-470/SCOPE.md)
- [Release doc template](/.github/ISSUE_TEMPLATE/release-checklist.md)

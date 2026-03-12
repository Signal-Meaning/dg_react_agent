# Issue #522: Release checklist — conversation_already_has_active_response fix

**GitHub:** [#522 Bug: conversation_already_has_active_response after successful function call](https://github.com/Signal-Meaning/dg_react_agent/issues/522)

**Scope:** Proxy fix (deferred `response.create` after function_call_output; completion on `response.done`, `response.output_text.done`, or `conversation.item.done`; 20s timeout unstick; non-fatal `conversation_already_has_active_response`). E2E 6 and 6b pass with real API. Consumer: voice-commerce (Issue #1066).

**Template:** This checklist follows [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md). Use that template for the GitHub release issue; this file is the Issue #522–specific release checklist.

---

## Release v0.10.3

### Overview

**Patch release** (voice-agent-backend; component unchanged unless needed). Fixes "no agent response after function call" (voice-commerce #1066): proxy now treats `conversation.item.done` (function_call_output) as completion signal and sends deferred `response.create`; 20s timeout unstick if upstream sends no completion; `conversation_already_has_active_response` not forwarded to client.

**Packages:** Prefer **voice-agent-backend** only (proxy change). If component or root tooling changed, bump both. CI (`.github/workflows/test-and-publish.yml`) publishes when the workflow runs.

---

### Pre-Release Preparation

- [x] **Code review complete:** All PRs merged and reviewed
- [x] **Tests passing**
  - [x] **Run what CI runs:** `npm run lint` then `npm run test:mock` (must pass)
  - [x] **E2E in proxy mode:** From test-app: start backend (`npm run backend`), then `USE_PROXY_MODE=true npm run test:e2e` (or focused: `-- openai-proxy-e2e.spec.js --grep '6\\.|6b'`). All must pass.
  - [x] **Real-API qualification (required for proxy/API behavior):** When `OPENAI_API_KEY` available:
    - [x] `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — in-scope tests pass
    - [x] From test-app (backend + dev server running): `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6\\.'` — test 6 passes
    - [x] Same env: `--grep '6b'` — test 6b passes (0 recoverable errors, partner scenario)
  - [x] **Upstream event coverage (proxy release):** `npm test -- tests/openai-proxy-event-coverage.test.ts` — passes
- [x] **Linting clean:** `npm run lint` — no errors
- [x] **npm audit:** `npm audit --audit-level=high` — exit 0 (required for CI)
- [x] **Documentation updated:** ISSUE-522 docs (TDD-PLAN, FINDINGS, REMAINING-STEPS, this checklist); REQUIRED-UPSTREAM-CONTRACT.md, PROTOCOL-AND-MESSAGE-ORDERING.md, UPSTREAM-EVENT-COMPLETE-MAP.md
- [x] **API changes documented:** None (proxy internal behavior only)
- [x] **Breaking changes documented:** None

#### Optional (recommended where easy)

- [x] **Idle timeout / completion:** Run E2E or integration tests for idle-timeout-after-function-call (e.g. issue-373). Confirm component still receives completion when upstream sends completion. No change expected from this fix. _(Ran `npm test -- tests/integration/issue-487-idle-timeout-after-function-result-component.test.tsx` — 4/4 passed.)_
- [x] **Unit test (completion state machine):** Optional. Extract completion-handling into a testable function and add a unit test that when `pendingResponseCreateAfterFunctionCallOutput` is true and we receive `response.done` or `response.output_text.done`, we emit one `response.create` and clear the flag. Integration tests already cover paths. _(Covered by openai-proxy-integration.test.ts deferred response.create and conversation.item.done tests; no extraction added.)_
- [x] **TDD-PLAN checkboxes:** Mark remaining Fix 1 / Fix 2 RED/GREEN checkboxes in TDD-PLAN.md as done where implementation and tests are in place.

---

### Version Management

- [x] **Bump version:** Update `packages/voice-agent-backend/package.json` to target version (0.2.8)
- [x] **Root package (if changed):** Root `package.json` at 0.10.3 for this release
- [ ] **Update dependencies (optional):** `npm update`; review if needed

---

### Build and Package (CI performs build)

- [x] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional local validation:** `npm run clean && npm run build && npm run validate` (do not commit dist/.tgz)

---

### Documentation

- [x] **Create release documentation:** `docs/releases/v0.10.3/` _(done before release)_
  - [x] `CHANGELOG.md` (Keep a Changelog format) — include Issue #522 fix: deferred response.create; completion on response.done / response.output_text.done / conversation.item.done (function_call_output); 20s timeout unstick; conversation_already_has_active_response not forwarded
  - [x] `RELEASE-NOTES.md` — note partner validation: voice-commerce (and others) can run E2E test 6b after upgrading (from test-app: backend + dev server, `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6b"`)
  - [x] Other files per template: patch set — `PACKAGE-STRUCTURE.md` (from template); no MIGRATION/NEW-FEATURES/API-CHANGES/EXAMPLES for patch
- [x] **Validate documentation:** `npm run validate:release-docs 0.10.3` — passed
- [x] **Review documentation:** Completeness, links, typos

---

### Git Operations

- [x] **Commit:** Version bump and release docs (e.g. `chore: prepare release v0.10.3 (Issue #522)`)
- [x] **Release branch:** Create `release/v0.10.3` (or use `npm run release:issue 0.10.3 patch` if available). Push branch.

---

### Package Publishing

- [x] **Publish via CI**
  - [x] Create GitHub release: tag `v0.10.3`, target `release/v0.10.3`, description from CHANGELOG/RELEASE-NOTES
  - [x] Trigger workflow from release branch (Actions → Run workflow → Branch: release/v0.10.3)
  - [x] Monitor CI: test job then publish job
  - [x] Verify package(s) in GitHub Packages
- [x] **Tag:** Created with GitHub release
- [ ] **Verify installation (optional):** Install from registry and smoke test
- [x] **Apply `latest` dist-tag** — applied by CI when publish succeeds (see PUBLISHING-AND-RELEASING.md)

---

### GitHub Release

- [x] **Create GitHub release:** Title `Release v0.10.3`; description with changelog / link to `docs/releases/v0.10.3/`; tag `v0.10.3`; target `release/v0.10.3`
- [ ] **Labels:** Add `release`, `v0.10.3` to the release / branch as per template

---

### Post-Release

- [x] **Merge to main via PR:** `release/v0.10.3` → `main` — **[PR #526](https://github.com/Signal-Meaning/dg_react_agent/pull/526)** created; merge when ready.
- [x] **Partner validation:** Document in release notes that partners (e.g. voice-commerce) can validate with E2E 6b. After release, voice-commerce run their E2E in their repo (e.g. Issue #1066). No action required from this repo beyond release notes.
- [ ] **Close Issue #522:** After PR #526 is merged to main, close the GitHub issue.

---

### Focused E2E (Issue #522)

| Scenario | Command (from test-app) | Notes |
|----------|---------------------------|--------|
| **Test 6** | `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6\\.'` | Backend + dev server running. Agent response shows time. |
| **Test 6b (partner)** | `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6b'` | 0 recoverable errors; function-call flow without conversation_already_has_active_response. |

---

### Completion Criteria

- [x] Lint and test:mock pass (and CI)
- [x] Real-API integration and E2E 6/6b pass (or documented exception)
- [x] Release docs validated
- [x] GitHub release created; CI published package(s)
- [ ] PR merged: `release/v0.10.3` → `main` (PR #526)
- [ ] Issue #522 closed after PR merge and release notes published

---

### References

- [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md) — full release template
- [PUBLISHING-AND-RELEASING.md](../../../PUBLISHING-AND-RELEASING.md)
- [TDD-PLAN.md](./TDD-PLAN.md) — Fix 1 & 2, validation
- [REMAINING-STEPS.md](./REMAINING-STEPS.md) — done vs remaining summary
- [REQUIRED-UPSTREAM-CONTRACT.md](../../../../packages/voice-agent-backend/scripts/openai-proxy/REQUIRED-UPSTREAM-CONTRACT.md)

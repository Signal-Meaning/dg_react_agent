# Issue #522: Release checklist — conversation_already_has_active_response fix

**GitHub:** [#522 Bug: conversation_already_has_active_response after successful function call](https://github.com/Signal-Meaning/dg_react_agent/issues/522)

**Scope:** Proxy fix (deferred `response.create` after function_call_output; completion on `response.done`, `response.output_text.done`, or `conversation.item.done`; 20s timeout unstick; non-fatal `conversation_already_has_active_response`). E2E 6 and 6b pass with real API. Consumer: voice-commerce (Issue #1066).

**Template:** This checklist follows [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md). Use that template for the GitHub release issue; this file is the Issue #522–specific release checklist.

---

## Release vX.X.X (replace with actual version)

### Overview

**Patch release** (voice-agent-backend; component unchanged unless needed). Fixes "no agent response after function call" (voice-commerce #1066): proxy now treats `conversation.item.done` (function_call_output) as completion signal and sends deferred `response.create`; 20s timeout unstick if upstream sends no completion; `conversation_already_has_active_response` not forwarded to client.

**Packages:** Prefer **voice-agent-backend** only (proxy change). If component or root tooling changed, bump both. CI (`.github/workflows/test-and-publish.yml`) publishes when the workflow runs.

---

### Pre-Release Preparation

- [ ] **Code review complete:** All PRs merged and reviewed
- [ ] **Tests passing**
  - [ ] **Run what CI runs:** `npm run lint` then `npm run test:mock` (must pass)
  - [ ] **E2E in proxy mode:** From test-app: start backend (`npm run backend`), then `USE_PROXY_MODE=true npm run test:e2e` (or focused: `-- openai-proxy-e2e.spec.js --grep '6\\.|6b'`). All must pass.
  - [ ] **Real-API qualification (required for proxy/API behavior):** When `OPENAI_API_KEY` available:
    - [ ] `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — in-scope tests pass
    - [ ] From test-app (backend + dev server running): `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6\\.'` — test 6 passes
    - [ ] Same env: `--grep '6b'` — test 6b passes (0 recoverable errors, partner scenario)
  - [ ] **Upstream event coverage (proxy release):** `npm test -- tests/openai-proxy-event-coverage.test.ts` — passes
- [ ] **Linting clean:** `npm run lint` — no errors
- [ ] **npm audit:** `npm audit --audit-level=high` — exit 0 (required for CI)
- [ ] **Documentation updated:** ISSUE-522 docs (TDD-PLAN, FINDINGS, REMAINING-STEPS, this checklist); REQUIRED-UPSTREAM-CONTRACT.md, PROTOCOL-AND-MESSAGE-ORDERING.md, UPSTREAM-EVENT-COMPLETE-MAP.md
- [ ] **API changes documented:** None (proxy internal behavior only)
- [ ] **Breaking changes documented:** None

#### Optional (recommended where easy)

- [x] **Idle timeout / completion:** Run E2E or integration tests for idle-timeout-after-function-call (e.g. issue-373). Confirm component still receives completion when upstream sends completion. No change expected from this fix. _(Ran `npm test -- tests/integration/issue-487-idle-timeout-after-function-result-component.test.tsx` — 4/4 passed.)_
- [x] **Unit test (completion state machine):** Optional. Extract completion-handling into a testable function and add a unit test that when `pendingResponseCreateAfterFunctionCallOutput` is true and we receive `response.done` or `response.output_text.done`, we emit one `response.create` and clear the flag. Integration tests already cover paths. _(Covered by openai-proxy-integration.test.ts deferred response.create and conversation.item.done tests; no extraction added.)_
- [x] **TDD-PLAN checkboxes:** Mark remaining Fix 1 / Fix 2 RED/GREEN checkboxes in TDD-PLAN.md as done where implementation and tests are in place.

---

### Version Management

- [ ] **Bump version:** Update `packages/voice-agent-backend/package.json` to target version (e.g. patch)
- [ ] **Root package (if changed):** If root or component changed, bump root `package.json` per release policy
- [ ] **Update dependencies (optional):** `npm update`; review if needed

---

### Build and Package (CI performs build)

- [ ] **Do not run build/package locally for release.** CI builds and validates on GitHub release creation.
- [ ] **Optional local validation:** `npm run clean && npm run build && npm run validate` (do not commit dist/.tgz)

---

### Documentation

- [ ] **Create release documentation:** `docs/releases/vX.X.X/`
  - [ ] `CHANGELOG.md` (Keep a Changelog format) — include Issue #522 fix: deferred response.create; completion on response.done / response.output_text.done / conversation.item.done (function_call_output); 20s timeout unstick; conversation_already_has_active_response not forwarded
  - [ ] `RELEASE-NOTES.md` — note partner validation: voice-commerce (and others) can run E2E test 6b after upgrading (from test-app: backend + dev server, `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6b"`)
  - [ ] Other files per template: `MIGRATION.md` if breaking, `NEW-FEATURES.md`, `API-CHANGES.md`, `EXAMPLES.md`, `PACKAGE-STRUCTURE.md` (from `docs/releases/PACKAGE-STRUCTURE.template.md`)
- [ ] **Validate documentation:** `npm run validate:release-docs X.X.X`
- [ ] **Review documentation:** Completeness, links, typos

---

### Git Operations

- [ ] **Commit:** Version bump and release docs (e.g. `chore: prepare release vX.X.X (Issue #522)`)
- [ ] **Release branch:** Create `release/vX.X.X` (or use `npm run release:issue X.X.X patch` if available). Push branch.

---

### Package Publishing

- [ ] **Publish via CI**
  - [ ] Create GitHub release: tag `vX.X.X`, target `release/vX.X.X`, description from CHANGELOG/RELEASE-NOTES
  - [ ] Trigger workflow from release branch (Actions → Run workflow → Branch: release/vX.X.X)
  - [ ] Monitor CI: test job then publish job
  - [ ] Verify package(s) in GitHub Packages
- [ ] **Tag:** Created with GitHub release
- [ ] **Verify installation (optional):** Install from registry and smoke test
- [ ] **Apply `latest` dist-tag** only to package(s) published in this release (see PUBLISHING-AND-RELEASING.md)

---

### GitHub Release

- [ ] **Create GitHub release:** Title `Release vX.X.X`; description with changelog / link to `docs/releases/vX.X.X/`; tag `vX.X.X`; target `release/vX.X.X`
- [ ] **Labels:** Add `release`, `vX.X.X` to the release / branch as per template

---

### Post-Release

- [ ] **Merge to main via PR:** `release/vX.X.X` → `main` (do not push directly to main)
- [ ] **Partner validation:** Document in release notes that partners (e.g. voice-commerce) can validate with E2E 6b. After release, voice-commerce run their E2E in their repo (e.g. Issue #1066). No action required from this repo beyond release notes.
- [ ] **Close Issue #522:** When release is published and release notes (and 6b instructions) give partners a clear path to validate, close the GitHub issue.

---

### Focused E2E (Issue #522)

| Scenario | Command (from test-app) | Notes |
|----------|---------------------------|--------|
| **Test 6** | `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6\\.'` | Backend + dev server running. Agent response shows time. |
| **Test 6b (partner)** | `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6b'` | 0 recoverable errors; function-call flow without conversation_already_has_active_response. |

---

### Completion Criteria

- [ ] Lint and test:mock pass (and CI)
- [ ] Real-API integration and E2E 6/6b pass (or documented exception)
- [ ] Release docs validated
- [ ] GitHub release created; CI published package(s)
- [ ] PR merged: `release/vX.X.X` → `main`
- [ ] Issue #522 closed after release and release notes published

---

### References

- [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md) — full release template
- [PUBLISHING-AND-RELEASING.md](../../../PUBLISHING-AND-RELEASING.md)
- [TDD-PLAN.md](./TDD-PLAN.md) — Fix 1 & 2, validation
- [REMAINING-STEPS.md](./REMAINING-STEPS.md) — done vs remaining summary
- [REQUIRED-UPSTREAM-CONTRACT.md](../../../../packages/voice-agent-backend/scripts/openai-proxy/REQUIRED-UPSTREAM-CONTRACT.md)

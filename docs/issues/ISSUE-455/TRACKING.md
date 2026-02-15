# Epic #455 – Tracking each child to completion

Use this checklist to drive each child issue to completion. **Update both this file and the child issue’s README** when work on that issue completes—or after each phase within an issue (especially #451). When all Acceptance Criteria are met and all rows below are ✅, the epic is ready to close.

---

## #451 – Real-API tests required (focus; TDD)

**Acceptance Criteria (summary):** Relevant tests pass when run with real APIs (e.g. `USE_REAL_APIS=1`); scope is defined; run process and expectations are documented; release checklist updated if needed. **Tests drive every step** (red–green–refactor per phase). After each phase, update this TRACKING and [ISSUE-451/README.md](../ISSUE-451/README.md).

| Step | Status |
|------|--------|
| **Phase 1 – Scope (TDD):** Define which tests must pass with USE_REAL_APIS; add or identify tests that fail under real API run; document scope in ISSUE-451/README | ✅ |
| **Update docs:** Mark Phase 1 complete in this TRACKING and in ISSUE-451/README | ✅ |
| **Phase 2 – Green (TDD):** Implement or adjust tests/implementation so selected tests pass with OpenAI provider (USE_REAL_APIS=1) | ✅ |
| **Update docs:** Mark Phase 2 complete in this TRACKING and in ISSUE-451/README | ✅ |
| **Phase 3 – Document:** Document how to run real-API suite (env vars, keys, optional CI or release step) | ✅ (SCOPE.md, TEST-STRATEGY.md) |
| **Update docs:** Mark Phase 3 complete in this TRACKING and in ISSUE-451/README | ✅ |
| **Phase 4 – Release:** Update release checklist (#456) if a real-API run step is required | ✅ |
| **Update docs:** Mark Phase 4 complete in this TRACKING and in ISSUE-451/README | ✅ |
| Close #451 with link to ISSUE-451/README and this TRACKING | ⬜ |

---

## #452 – Function-call contract intentional (doc-only; any order)

**Acceptance Criteria:** Documentation clearly states the single `POST /function-call` contract is intentional; callers (e.g. voice-commerce) may customize their own backends. **Update both this TRACKING and [ISSUE-452/README.md](../ISSUE-452/README.md) when the issue is completed.** #452 may be done in any order with #453 and #454.

| Step | Status |
|------|--------|
| Identify doc locations (e.g. ISSUE-407, README, release notes) | ✅ |
| Add “intentional; callers may customize” wording | ✅ `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md` |
| No implementation change required | ✅ N/A |
| **Update docs:** Mark #452 complete in this TRACKING and in ISSUE-452/README | ✅ |
| Close #452 with link to ISSUE-452/README and this TRACKING | ⬜ |

---

## #453 – Real-API scope; 3pp out of scope (doc-only; any order)

**Acceptance Criteria:** Docs state we may adopt best-practice shape only for our tests/real-API needs; voice-commerce and other 3pp backends are out of scope. **Update both this TRACKING and [ISSUE-453/README.md](../ISSUE-453/README.md) when the issue is completed.** #453 may be done in any order with #452 and #454.

| Step | Status |
|------|--------|
| Add/update test-strategy or scope doc (e.g. TEST-STRATEGY.md) | ✅ |
| State: 3pp backends not supported or tested by this repo | ✅ `docs/development/TEST-STRATEGY.md` |
| State: any shape adoption is for our real-API/mock testing only | ✅ Same section |
| **Update docs:** Mark #453 complete in this TRACKING and in ISSUE-453/README | ✅ |
| Close #453 with link to ISSUE-453/README and this TRACKING | ⬜ |

---

## #454 – 3pp maintain own backend contracts (doc-only; any order)

**Acceptance Criteria:** Documentation states third parties maintain their own backend contracts for function calls; we keep the common single-endpoint contract. **Update both this TRACKING and [ISSUE-454/README.md](../ISSUE-454/README.md) when the issue is completed.** #454 may be done in any order with #452 and #453.

| Step | Status |
|------|--------|
| Update BACKEND-FUNCTION-CALL-CONTRACT.md or related doc | ✅ |
| State: 3pp own their contracts; we stick to common shape | ✅ `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md` |
| **Update docs:** Mark #454 complete in this TRACKING and in ISSUE-454/README | ✅ |
| Close #454 with link to ISSUE-454/README and this TRACKING | ⬜ |

---

## Epic closure

- [ ] All four issues closed on GitHub.
- [ ] This TRACKING.md and each child README updated with final status.
- [ ] Epic #455 closed with comment linking to `docs/issues/ISSUE-455/`.

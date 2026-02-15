# Epic #455 – Tracking each child to conclusion

Use this checklist to drive each child issue to its proper conclusion. Update the table and checkboxes as work completes; when all rows are ✅, the epic is ready to close.

---

## #451 – Real-API tests required

**Conclusion definition:** Relevant tests (onFunctionCallRequest, function-calling-settings, openai-proxy integration) pass when run with real APIs (e.g. `USE_REAL_OPENAI=1`); process and expectations are documented.

| Step | Status |
|------|--------|
| Define which tests must pass with USE_REAL_APIS | ⬜ |
| Implement or adjust tests/CI so they pass with OpenAI provider | ⬜ |
| Document how to run real-API suite and any env/keys | ⬜ |
| Update release checklist (#456) if new step required | ⬜ |
| Close #451 with link to this doc or ISSUE-451/README | ⬜ |

---

## #452 – Function-call contract intentional

**Conclusion definition:** Documentation clearly states the single `POST /function-call` contract is intentional; callers (e.g. voice-commerce) may customize their own backends.

| Step | Status |
|------|--------|
| Identify doc locations (e.g. ISSUE-407, README, release notes) | ⬜ |
| Add “intentional; callers may customize” wording | ⬜ |
| No implementation change required | ✅ N/A |
| Close #452 with link to this doc or ISSUE-452/README | ⬜ |

---

## #453 – Real-API scope; 3pp out of scope

**Conclusion definition:** Docs state we may adopt best-practice shape only for our tests/real-API needs; voice-commerce and other 3pp backends are out of scope.

| Step | Status |
|------|--------|
| Add/update test-strategy or scope doc (e.g. TEST-STRATEGY.md) | ⬜ |
| State: 3pp backends not supported or tested by this repo | ⬜ |
| State: any shape adoption is for our real-API/mock testing only | ⬜ |
| Close #453 with link to this doc or ISSUE-453/README | ⬜ |

---

## #454 – 3pp maintain own backend contracts

**Conclusion definition:** Documentation states third parties maintain their own backend contracts for function calls; we keep the common single-endpoint contract.

| Step | Status |
|------|--------|
| Update BACKEND-FUNCTION-CALL-CONTRACT.md or related doc | ⬜ |
| State: 3pp own their contracts; we stick to common shape | ⬜ |
| Close #454 with link to this doc or ISSUE-454/README | ⬜ |

---

## Epic closure

- [ ] All four issues closed on GitHub.
- [ ] This TRACKING.md (or each child README) updated with final status.
- [ ] Epic #455 closed with comment linking to `docs/issues/ISSUE-455/`.

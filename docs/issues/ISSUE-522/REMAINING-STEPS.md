# Issue #522: Remaining steps to resolve the issue

**Status:** Fix implemented and validated. E2E tests 6 and 6b pass with real API after the **conversation.item.done** mitigation and backend restart. Remaining work is release, documentation, and partner validation.

**Release checklist:** Use **[RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)** for the full release process. It is aligned with the [GitHub release template](../../../.github/ISSUE_TEMPLATE/release-checklist.md) and includes optional steps below as checklist items.

---

## Done (this branch)

- **Fix 1:** Proxy defers `response.create` until one of: `response.done`, `response.output_text.done`, or `conversation.item.done` (item type `function_call_output`). See REQUIRED-UPSTREAM-CONTRACT.md.
- **Fix 2:** Proxy does not forward `conversation_already_has_active_response` to the client (logged at INFO only).
- **Follow-up:** 20s timeout unstick if upstream sends none of the completion signals; proxy treats `conversation.item.done` for `function_call_output` as completion (per OpenAI Realtime API spec).
- **Refactor:** `sendDeferredResponseCreate()` in server.ts DRYs the four completion paths.
- **Tests:** Integration tests (order 2a/2b, item.done 3b, timeout path); E2E 6 and 6b pass with real API.
- **Docs:** FINDINGS.md, DEFECT-ISOLATION-PROPOSAL.md, TDD-PLAN.md, REQUIRED-UPSTREAM-CONTRACT.md, PROTOCOL-AND-MESSAGE-ORDERING.md, UPSTREAM-EVENT-COMPLETE-MAP.md updated.

---

## Remaining steps (summary)

| Step | Where | Action |
|------|--------|--------|
| **1. Release** | [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | Pre-release (tests, lint, audit), version bump, release docs, Git (branch, commit), create GitHub release, CI publish, tag, merge to main via PR. |
| **2. Partner validation** | Release notes + partner repo | After release, voice-commerce run their E2E (e.g. #1066). Release notes document that partners can use test 6b to validate. |
| **3. Optional** | RELEASE-CHECKLIST.md § Pre-Release (Optional) | Idle timeout / completion sanity check; unit test for completion state machine; mark TDD-PLAN Fix 1/Fix 2 checkboxes done. |
| **4. Close issue** | GitHub | Close #522 when release is published and release notes (and 6b instructions) give partners a clear path to validate. |

---

## Optional steps (in release checklist)

These are included in [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) under **Pre-Release Preparation → Optional**:

- **Idle timeout / completion:** Run E2E or integration tests for idle-timeout-after-function-call (e.g. issue-373). Confirm component still receives completion when upstream sends completion.
- **Unit test (6):** Optionally extract completion-handling into a testable function and add a unit test that when `pendingResponseCreateAfterFunctionCallOutput` is true and we receive `response.done` or `response.output_text.done`, we emit one `response.create` and clear the flag.
- **TDD-PLAN checkboxes:** Mark remaining Fix 1 / Fix 2 RED/GREEN checkboxes in TDD-PLAN.md as done where implementation and tests are in place.

---

## References

- **RELEASE-CHECKLIST.md** — Full release process (aligned with GitHub release template).
- **.github/ISSUE_TEMPLATE/release-checklist.md** — Source of truth for release issues; create the GitHub release issue from this template (e.g. `gh issue create --template release-checklist.md --title "Release vX.X.X: ..."`) and use RELEASE-CHECKLIST.md for #522-specific items.
- **TDD-PLAN.md** — Fix 1 & 2, validation, follow-up.
- **FINDINGS.md** — Root cause, mitigation, E2E validation 6/6b.
- **REQUIRED-UPSTREAM-CONTRACT.md** — Three completion signals; timeout; enforcement.
- **PUBLISHING-AND-RELEASING.md** — Tokens, CI, versioning.

# TDD Plan: Release gate / test coverage for upstream event types (Issue #513)

**Goal:** Add a mechanism so that known unmapped (or “ignored with warning”) upstream event types do not ship as **fatal errors** in a release. Options: regression tests that assert no Error for known non-fatal event types, release checklist item, and/or documentation of supported / ignored-with-warning / unknown event types.

**Reference:** [README.md](./README.md) · **GitHub:** [#513](https://github.com/Signal-Meaning/dg_react_agent/issues/513) · voice-commerce #908

---

## Current state

- After #512: unmapped events are warnings only (no Error to client).
- No automated gate that fails if a **new** upstream event type causes the proxy to send an Error (e.g. if someone re-introduces Error for unmapped, or adds a new code path that sends Error for a known non-fatal type).
- No single doc that lists: supported (mapped), ignored-with-warning (known, not mapped), unknown (should be rare).

## Target state

- **At least one of:**
  1. **Regression test(s):** For known non-fatal event types (e.g. `response.audio_transcript.delta`, `response.output_audio.delta`, or fixtures), assert that the client does **not** receive an Error with `code: 'unmapped_upstream_event'`. New event types that cause Error would fail the test until mapped or explicitly added to “ignore with warning.”
  2. **Release checklist:** Before each release, confirm “No new unmapped upstream event types in the last N sessions or test runs” (review logs/metrics).
  3. **Documentation:** Document which event types are **supported** (mapped), **ignored with warning** (known, intentionally not mapped), and **unknown**; unknown wired to warning + telemetry so the team can add mappings next release.

---

## TDD workflow (Red → Green → Refactor)

### Phase 1: RED — Define the gate

- [ ] **1.1** Decide which mechanism(s) to implement: regression test, checklist, docs, or combination.
- [ ] **1.2** If regression test:
  - Add test(s) that send one or more **known non-fatal** upstream event types (e.g. from fixture or mock) and assert client does **not** receive `Error` with `code: 'unmapped_upstream_event'`.
  - If #512 is not yet merged, test may currently expect Error → **RED** until #512 is in; then flip expectation so test asserts no Error → **GREEN** when proxy only logs.
  - If #512 is merged: add test for at least one event type that real API can send (e.g. `response.audio_transcript.delta` or `response.output_audio.delta` if we have a fixture); assert no Error.
- [ ] **1.3** If checklist: add item to release checklist template (e.g. in `.github/ISSUE_TEMPLATE/release-checklist.md` or issue #515 body): “Verify no new unmapped upstream event types introduced (review staging/integration logs for unmapped_upstream_event).”
- [ ] **1.4** If docs: add or update a section in `UPSTREAM-EVENT-COMPLETE-MAP.md` (or new doc): tables for **supported**, **ignored with warning**, **unknown**.

### Phase 2: GREEN — Implement

- [ ] **2.1** Regression test: implement test(s); they pass once #512 behavior is in place (no Error for unmapped).
- [ ] **2.2** Checklist: add the item; mark as done for this release when verified.
- [ ] **2.3** Docs: write supported / ignored-with-warning / unknown; ensure “unmapped” path is described as “log warning only” (aligned with #512).

### Phase 3: REFACTOR

- [ ] **3.1** Keep list of “known non-fatal” event types in one place (fixture, constant, or doc) so future event types can be added and covered by the same test or checklist.
- [ ] **3.2** Update [README.md](./README.md) master progress: check off #513.

### Phase 4: Verification

- [ ] **4.1** Run new/updated tests in CI; they pass.
- [ ] **4.2** Release checklist (or doc) is actionable and referenced in release process.

---

## Files to touch

| File | Change |
|------|--------|
| `tests/integration/openai-proxy-integration.test.ts` | Optional: add “known non-fatal event types do not yield Error” test(s). |
| `packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md` | Add supported / ignored-with-warning / unknown sections. |
| `.github/ISSUE_TEMPLATE/release-checklist.md` or release issue template | Optional: checklist item for unmapped event review. |
| `docs/issues/ISSUE-512-515/README.md` | Check off #513 progress. |

---

## Completion criteria (from issue #513)

- [ ] At least one of: regression tests for known non-fatal upstream event types, release checklist item for unmapped events, or documentation of supported/ignored/unknown event types.
- [ ] New unmapped event types are less likely to ship as fatal errors without being caught by test or process.

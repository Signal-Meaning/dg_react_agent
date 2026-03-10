# TDD Plan: Root cause of unmapped upstream events (Issue #517)

**Goal:** Investigate and fix **why** known or expected upstream event types hit the unmapped branch in the proxy. Hypothesis: the cause is our **proxy/translator pipeline** (mis-parse, mis-route, or missing explicit handling), not an upstream API defect. Add mappings or explicit ignore branches so those event types are handled and no longer fall through to the unmapped path.

**Reference:** [README.md](./README.md) · **GitHub:** [#517](https://github.com/Signal-Meaning/dg_react_agent/issues/517) · voice-commerce #908

---

## Current behavior

- Upstream (OpenAI Realtime API) sends events; some reach the unmapped `else` in `server.ts` and are logged as "Unmapped upstream event: ${eventType}".
- Voice-commerce observed events like `response.audio_transcript.delta` or `response.output_audio.delta` (or similar) with small payloads (e.g. "A") — suggesting either (a) we do not have a branch for that `msg.type`, or (b) we parse/route incorrectly so a known type is not matched (e.g. wrong shape, nested type, or string normalization).
- #512 made unmapped non-fatal (log only); this issue addresses **reducing** unmapped occurrences by fixing the pipeline.

## Target behavior

- Identify which `msg.type` values (and payload shapes) actually hit the unmapped branch in real-API or staging runs.
- For each: either **map** to component protocol, or **explicitly ignore** (dedicated branch: log and continue, same as other control-only events).
- Update UPSTREAM-EVENT-COMPLETE-MAP.md and server.ts so that known types no longer fall through to the generic unmapped branch.

---

## TDD workflow (Red → Green → Refactor)

### Phase 1: RED — Observe and specify

- [x] **1.1** Gather evidence: which upstream event types hit the unmapped branch? (Logs: "Unmapped upstream event: …"; or add temporary logging of raw `msg.type` and payload shape before the unmapped branch.)
- [x] **1.2** List candidate event types from voice-commerce and OpenAI Realtime docs (e.g. `conversation.created`, `conversation.item.input_audio_transcription.failed` / `.segment`). Check server.ts: do we have branches for these? Add explicit ignore for any that were missing.
- [x] **1.3** Add or extend a test that replays a **specific** unmapped event (e.g. from fixture or mock) and asserts that after the fix, that event type is **handled** — existing #512 test sends `conversation.created` and asserts no Error; with #517 branch that event is now explicitly handled (no unmapped path).

### Phase 2: GREEN — Implement handling

- [x] **2.1** For each identified type: add a dedicated branch in server.ts: `conversation.created`, `conversation.item.input_audio_transcription.failed`, `conversation.item.input_audio_transcription.segment` — log only, no client message (same pattern as other control-only events).
- [x] **2.2** If the root cause is **mis-parsing**: N/A for these types; we had no branch, not wrong path.
- [x] **2.3** Run integration tests; ensure no regression. #512 test and full suite pass.

### Phase 3: REFACTOR

- [x] **3.1** Update UPSTREAM-EVENT-COMPLETE-MAP.md: move previously unmapped types into "Explicitly handled" table with note Issue #517.
- [x] **3.2** Document any parsing or routing assumption: we match on `msg.type` at top level; upstream must send `type` at top level. New API event types should get an explicit branch (map or ignore) to avoid unmapped path.
- [x] **3.3** Update [README.md](./README.md) master progress: check off #517.

### Phase 4: Verification

- [x] **4.1** Run full openai-proxy integration suite (mock); all pass.
- [ ] **4.2** If possible, run with real API or voice-commerce flow; confirm previously unmapped event types no longer appear in "Unmapped upstream event" logs (or are reduced).
- [ ] **4.3** Changelog/release notes: mention root-cause fix for unmapped events (#517).

---

## Files to touch

| File | Change |
|------|--------|
| `packages/voice-agent-backend/scripts/openai-proxy/server.ts` | Add branches for identified event types (map or explicit ignore); fix parsing/routing if needed. |
| `packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md` | Document newly handled/ignored types; note #517. |
| `tests/integration/openai-proxy-integration.test.ts` | Optional: test that specific event type (e.g. from fixture) is handled and does not hit unmapped. |
| `docs/issues/ISSUE-512-515/README.md` | Add #517 to overview and progress; check off when done. |

---

## Completion criteria (from issue #517)

- [x] Logs or tests identify which upstream `msg.type` values hit the unmapped branch.
- [x] For each identified type: either mapped or explicitly ignored (with log), or documented as unknown.
- [x] No regression: existing mappings and #512 behavior unchanged; new branches only add handling or explicit ignore.

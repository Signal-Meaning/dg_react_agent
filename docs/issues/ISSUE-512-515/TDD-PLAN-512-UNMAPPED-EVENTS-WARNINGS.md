# TDD Plan: Unmapped upstream events → warnings (Issue #512)

**Goal:** Downgrade unmapped upstream events from **fatal** (proxy sends `Error` to client, triggering retries) to **warnings** (log and continue; no `Error` sent). Prevents retry/re-Settings loops when the OpenAI Realtime API sends event types the proxy does not yet map (e.g. `response.audio_transcript.delta`, `response.output_audio.delta`).

**Reference:** [README.md](./README.md) · **GitHub:** [#512](https://github.com/Signal-Meaning/dg_react_agent/issues/512) · voice-commerce #908

---

## Current behavior

- **Location:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (upstream message handler; unmapped branch ~843–864).
- Proxy receives an upstream event whose `msg.type` is not in the handled set → logs WARN **and** sends `Error` to client with `code: 'unmapped_upstream_event'`.
- Component/test-app receives Error → can trigger “Error received after sending Settings with functions” and retry/re-Settings behavior (Bug #514).

## Target behavior

- Unmapped upstream event → **log only** (WARN, with event type and safe payload representation).
- **Do not** send `Error` to the client for unmapped events.
- Continue processing the stream; no reconnection, re-Settings, or retry triggered by unmapped events.
- Malformed/non-JSON upstream messages: keep sending Error (fatal).

---

## TDD workflow (Red → Green → Refactor)

### Phase 1: RED — Failing tests

- [x] **1.1** Add or adjust integration test: when mock sends an **unmapped** upstream event (e.g. `conversation.created` or a synthetic type), client **must not** receive any message with `type === 'Error'` and `code === 'unmapped_upstream_event'`.
  - **File:** `tests/integration/openai-proxy-integration.test.ts`.
  - **Current test:** “Protocol: unmapped upstream event (e.g. conversation.created) yields Error (unmapped_upstream_event)” — **change expectation:** client must **not** receive that Error; optionally assert that no Error with that code is received, and optionally assert proxy logged a warning (if test can observe logs or a side-effect).
- [ ] **1.2** Optional: Unit test or integration test that sends a known unmapped event type (e.g. `response.audio_transcript.delta` or fixture) and asserts no Error is sent to client.
- [x] Run tests → **RED** (current implementation sends Error; new expectation fails).

### Phase 2: GREEN — Implementation

- [x] **2.1** In `server.ts`, in the unmapped-event `else` branch (~843–864):
  - Keep the `emitLog` WARN (event type; add safe payload representation if not already present, e.g. truncated or length).
  - **Remove** the block that builds `unmappedError` and sends it via `clientWs.send(JSON.stringify(unmappedError))`.
  - Result: unmapped events are logged only; no Error sent to client.
- [x] **2.2** Leave the `catch` block for malformed/non-JSON messages as-is (continue sending Error to client).
- [x] Run tests → **GREEN**.

### Phase 3: REFACTOR

- [x] **3.1** Update `UPSTREAM-EVENT-COMPLETE-MAP.md`: unmapped events are “ignored with warning” (no client Error).
- [x] **3.2** Update `PROTOCOL-SPECIFICATION.md` and any other docs that state “unmapped → Error (unmapped_upstream_event)” to “unmapped → log warning only; no client Error.”
- [x] **3.3** If test-app or component has special handling for `unmapped_upstream_event` (e.g. don’t count as agent error), consider leaving it for backward compatibility or removing if no longer needed; document.
- [x] Run tests → still **GREEN**.

### Phase 4: Verification

- [x] **4.1** Run integration test(s) that cover unmapped event path; all pass.
- [x] **4.2** If possible, run against real API or fixture that emits unmapped events; confirm no Error to client and no retry/re-Settings triggered. Done: mock test passes; USE_REAL_APIS=1 SettingsApplied/session.updated flow runs without Error.
- [x] **4.3** Update [README.md](./README.md) master progress: check off #512 RED / GREEN / REFACTOR / Verified.

---

## Files to touch

| File | Change |
|------|--------|
| `packages/voice-agent-backend/scripts/openai-proxy/server.ts` | Unmapped branch: log only; remove `unmappedError` send. |
| `tests/integration/openai-proxy-integration.test.ts` | Change “unmapped yields Error” test to “unmapped does **not** yield Error”. |
| `packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md` | Document: unmapped → warning only. |
| `tests/integration/PROTOCOL-SPECIFICATION.md` | Update unmapped row: no Error. |
| `docs/issues/ISSUE-512-515/README.md` | Check off #512 progress. |

---

## Completion criteria (from issue #512)

- [x] Unmapped upstream events downgraded from error to warning in the translation proxy.
- [x] Event type and safe payload representation logged.
- [x] No connection/component error emitted for unmapped events; no retries or re-Settings triggered by them.
- [x] Regression test: known non-fatal event types do not cause an error to be emitted (see #513 for release gate).

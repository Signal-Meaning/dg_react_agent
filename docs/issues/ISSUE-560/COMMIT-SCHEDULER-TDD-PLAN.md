# TDD plan — OpenAI proxy **commit scheduler** + completeness audit (Issue #560)

**Issue:** [#560](./README.md)  
**Parent plan:** [TDD-PLAN.md](./TDD-PLAN.md) · **Prior art:** [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md) · **Log forensics:** [PROXY-LOG-TIMELINE-REPORT-2026-04-08-153125.md](./PROXY-LOG-TIMELINE-REPORT-2026-04-08-153125.md)

**Premise (non-negotiable for this work):** The OpenAI proxy is **not** assumed complete. A **scheduler gap** that prevents **`input_audio_buffer.commit`** under realistic live mic chunking is **core** to the `turn_detection: null` architecture, but it may **not** be the only gap. This plan requires **tests first**, then implementation, plus an explicit **completeness audit** before treating the slice as closed.

---

## 1. Why “nothing ever committed” (mechanism)

With **`session.audio.input.turn_detection: null`**, OpenAI does **not** auto-commit the input buffer. The **client/proxy** must send **`input_audio_buffer.commit`** (and the proxy pairs **`response.create`** per existing ordering rules). Official guidance:

- **VAD disabled:** *“The client will have to manually emit … [`input_audio_buffer.commit`](https://developers.openai.com/api/docs/api-reference/realtime-client-events/input_audio_buffer/commit), which will create a new user input item … [and] [`input_audio_buffer.clear`](https://developers.openai.com/api/docs/api-reference/realtime-client-events/input_audio_buffer/clear) before beginning a new user input.”* — [Realtime conversations guide](https://platform.openai.com/docs/guides/realtime-conversations) (section *Disable VAD*; same material on `developers.openai.com`).

**Where it happens in this repo:** After each successful binary forward, `packages/voice-agent-backend/scripts/openai-proxy/server.ts` increments **`pendingAudioBytes`** and calls **`scheduleAudioCommit()`**, which starts a **single** timer (**`INPUT_AUDIO_COMMIT_DEBOUNCE_MS`**, 400 ms). When the timer fires, if **`pendingAudioBytes`** meets the first- or subsequent-commit threshold and **`!responseInProgress`**, the proxy sends **`commit` + `response.create`**. **Each new append clears and reschedules that timer.**

**Failure mode (evidenced in `backend-20260408-171356.log`):** Live mic produced **~37** `input_audio_buffer.append` lines with **median ~256 ms** between appends. That is **shorter than 400 ms**, so the debounce **keeps resetting** while audio is continuous. The timer therefore **never completes** while the user keeps speaking. On **client WebSocket close**, **`clearProxyConnectionTimers()`** runs and **clears** the pending timer **without** flushing a commit, so a **full pending buffer** can be **discarded** without ever reaching STT.

So: **STT/turn processing never ran** because **commit was never sent**, not because the Realtime API “ignored” audio.

---

## 2. Recommended practice (OpenAI) vs this proxy

| Mode | Who commits | Implication for us |
|------|-------------|---------------------|
| **Default (server VAD on)** | Server detects speech / end-of-turn and drives buffer lifecycle | Would **conflict** with proxy-issued **`input_audio_buffer.commit`** unless we **remove** or **reconcile** our commits (see [translator.ts](../../../packages/voice-agent-backend/scripts/openai-proxy/translator.ts) comment: server VAD + our commit → empty / “buffer too small” class errors — Issues **#414**, **#451**). |
| **`turn_detection: null` (current)** | **We** must commit (and **`clear`** when starting a new user item per docs) | Proxy **must** implement a scheduler that **cannot** strand **`append`-only** indefinitely for real-time streams, and **must** define behavior on **disconnect** / **stop**. |

**Third option (docs):** Keep **server Vad** but set **`create_response: false`** (and related flags) to retain VAD signals while manually issuing **`response.create`**. That is a **separate design spike** (see **§5**); it does **not** replace proving the **null-VAD** path is sound.

---

## 3. Why existing tests did not catch this

Integration tests in **`tests/integration/openai-proxy-integration.test.ts`** already assert **`commit`** for paths such as:

- **One** large binary frame (e.g. **40 000** bytes) then wait for assistant text — natural **>400 ms** quiet after last byte before mock replies.
- **Two** chunks with the second at **250 ms** and assertion at **250 + 400 + ε** — **intentionally** creates silence after the last chunk.

They do **not** model **sustained** streaming at **< debounce** interval **after** `pendingAudioBytes` has crossed **`OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`**, which is exactly the **live worklet** pattern seen in manual logs.

**Closure rule:** Add **new mock tests** that would **fail** on current `server.ts` behavior, **then** change the scheduler (RED → GREEN).

---

## 4. Phase 0 — Proxy completeness audit (no “scheduler only” tunnel vision)

Before or in parallel with Phase 1, produce a short **audit appendix** (section in this file or linked note) that walks the **full** client→upstream→client contract and records **pass / gap / N/A**:

| Area | Reference | Question |
|------|-----------|----------|
| Session shape GA | [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md), `mapSettingsToSessionUpdate` | Any field drift vs current OpenAI schema? |
| Ordering | [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) | `append` before `session.updated`, `commit` vs `responseInProgress`, function-call deferrals — all covered by tests? |
| Audio path | `forwardClientMessage`, resampler, `assertAppendChunkSize` | Edge cases: partial frames, max chunk, flush queues |
| Lifecycle | `client` / `upstream` `close` / `error` | **Disconnect flush** (this plan), upstream abort, SettingsApplied errors |
| Transcript mapping | `input_audio_transcription.*` → component | Dedup, deltas, failures |
| Idle / timeout | `turn_detection: null` | Component idle vs server idle ([integration notes](../../../tests/integration/openai-proxy-integration.test.ts) re `NO_SERVER_TIMEOUT_MS`) |

**Exit:** Explicit statement: “No additional P0 gaps found” **or** new rows added to [TDD-PLAN.md §2b](./TDD-PLAN.md) with tests.

---

## 5. Phase 1 — RED: new Jest cases (mock upstream)

**File:** `tests/integration/openai-proxy-integration.test.ts` (or dedicated unit harness if isolation is cleaner — prefer existing proxy harness for fidelity).

1. **`Issue #560 / scheduler: continuous binary chunks` (mock)**  
   - After `SettingsApplied`, send **PCM16** chunks on a timer (**e.g. every 250 ms**) sized so that **within a few seconds** `pendingAudioBytes` **exceeds** `OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT` **without** any inter-chunk gap **≥ `INPUT_AUDIO_COMMIT_DEBOUNCE_MS`**.  
   - **Expect:** within a bounded wall time (**define explicitly**, e.g. `firstCommitMaxWaitMs`), mock upstream receives **at least one** `input_audio_buffer.commit` **or** the test documents the **intended** new contract (e.g. max coalesce interval).  
   - **Current behavior:** expect **RED** (zero commits until stream stops).

2. **`Issue #560 / scheduler: client close with pending audio` (mock)**  
   - After the same streaming pattern (or single large pending buffer), **close** the client socket **without** a trailing silence window.  
   - **Expect:** either **commit** (and defined upstream behavior) **or** explicit **clear** + client **Error** — **not** silent loss of **≥ min** bytes with no upstream commit and no signal.  
   - **Current behavior:** expect **RED** if we assert commit-on-close.

**Naming:** Use stable `Issue #560:` prefix for `itMockOnly` grep, consistent with existing tests.

---

## 6. Phase 2 — GREEN: scheduler design (spike → pick one)

Implement the **minimal** change that satisfies Phase 1 tests. **Candidates** (document choice in PR):

- **A. Max coalesce / ceiling timer:** When `pendingAudioBytes >= min`, start or refresh a **second** timer (e.g. “commit within **X** ms even if appends continue”) to bound latency for continuous speech.  
- **B. Cadence-aware debounce:** Reduce debounce below min inter-chunk interval **only** when safe vs upstream “buffer too small” (requires careful validation).  
- **C. Close / stop flush:** On client `close`, if `pendingAudioBytes >= min` and `!responseInProgress`, emit **commit** (+ `response.create` per rules) or **`input_audio_buffer.clear`** + component-visible **Error** — **must** match product expectation.

Re-run **full** mock `openai-proxy-integration` suite and targeted **`USE_REAL_APIS=1`** when qualifying.

---

## 7. Phase 3 — REFACTOR + documentation

- Update [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md) / [TDD-PLAN.md §2b](./TDD-PLAN.md) with the **new** root cause row and test names.  
- Update [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md) expected log pattern (“continuous speech should still produce `commit` within …”).  
- [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) / [NEXT-STEP.md](./NEXT-STEP.md): point to this plan until Phase 0–2 checkboxes are done.

---

## 8. §3 — Server VAD (acknowledged, out of scope for this spike)

Enabling **server VAD** or **hybrid** (`create_response: false`) is a **protocol fork**: requires reconciling **who** commits, how **`response.create`** interleaves, and new real-API tests. **Do not** conflate with the **null-VAD** scheduler fix. Track as a **follow-up epic** after this plan’s **null-VAD** path is **proven** by tests + audit.

---

## 9. §4 — **Requirement:** client chunk-period observability

**Goal:** Make live vs inject reproducible in **numbers**, not only proxy logs.

- **Extend** [`test-app/src/mic-timing-debug.ts`](../../../test-app/src/mic-timing-debug.ts) (when `micTimingDebug=1`) **and/or** the capture path in **`AudioManager`** / worklet callback to record:  
  - **Inter-chunk interval** (ms): last N samples, min / max / median.  
  - Optional: **bytes per chunk** to the agent socket.  
- **Document** in [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md): how to copy **`[micTimingDebug]`** + correlate with proxy **`input_audio_buffer.append`** spacing.  
- **Test-app unit test** if logic is non-trivial (pure reducer over timestamps).

This is a **deliverable** of the same milestone as Phase 2 (can land in parallel after Phase 1 RED exists).

---

## 10. Checklist

| Step | Status |
|------|--------|
| Phase 0 audit appendix started | `[ ]` |
| Phase 1 test (continuous chunks) RED | `[ ]` |
| Phase 1 test (client close) RED | `[ ]` |
| Phase 2 scheduler GREEN + suite green | `[ ]` |
| `USE_REAL_APIS=1` qualification (when applicable) | `[ ]` |
| §4 chunk-period telemetry + doc | `[ ]` |
| TDD-PLAN §2b row + handoff docs updated | `[ ]` |

---

## Privacy

Do not commit raw `backend-*.log` files; reference **message types** and **timings** only.

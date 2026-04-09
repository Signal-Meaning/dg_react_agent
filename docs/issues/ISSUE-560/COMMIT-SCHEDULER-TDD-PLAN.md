# TDD plan — OpenAI proxy **commit scheduler** + completeness audit (Issue #560)

**Issue:** [#560](./README.md)  
**Parent plan:** [TDD-PLAN.md](./TDD-PLAN.md) · **Prior art:** [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md) · **Log forensics:** [PROXY-LOG-TIMELINE-REPORT-2026-04-08-153125.md](./PROXY-LOG-TIMELINE-REPORT-2026-04-08-153125.md)

**Premise (non-negotiable for this work):** The OpenAI proxy is **not** assumed complete. A **scheduler gap** under **`turn_detection: null`** (continuous mic chunks vs **400 ms** debounce) is **proven** by log forensics and is **P0** to bridge with tests + fix **or** to **exit** that mode. **Strategic direction:** **enable Server VAD** on the Realtime session so the **API** owns input-buffer commit timing (OpenAI default), and **remove proxy-issued `input_audio_buffer.commit` from the hot path** once migration tests pass. Until that migration ships, the **null-VAD** path must not strand **`append`-only** forever (Phase 1–2).

---

## 1. Why “nothing ever committed” (mechanism) — `turn_detection: null` path

With **`session.audio.input.turn_detection: null`**, OpenAI does **not** auto-commit the input buffer. The **client/proxy** must send **`input_audio_buffer.commit`** (and the proxy pairs **`response.create`** per existing ordering rules). Official guidance:

- **VAD disabled:** *“The client will have to manually emit … [`input_audio_buffer.commit`](https://developers.openai.com/api/docs/api-reference/realtime-client-events/input_audio_buffer/commit) … [and] [`input_audio_buffer.clear`](https://developers.openai.com/api/docs/api-reference/realtime-client-events/input_audio_buffer/clear) before beginning a new user input.”* — [Realtime conversations guide](https://platform.openai.com/docs/guides/realtime-conversations) (*Disable VAD*).

**Where it happens in this repo:** After each successful binary forward, `packages/voice-agent-backend/scripts/openai-proxy/server.ts` increments **`pendingAudioBytes`** and calls **`scheduleAudioCommit()`** (**`INPUT_AUDIO_COMMIT_DEBOUNCE_MS` = 400**). **Each new append clears and reschedules** that timer.

**Failure mode (evidenced in `backend-20260408-171356.log`):** Live mic **~37 ×** `input_audio_buffer.append` with **median ~256 ms** between appends → debounce **never completes** during continuous speech. **Client close** calls **`clearProxyConnectionTimers()`** without flushing commit → **silent loss** of pending audio.

---

## 2. OpenAI modes vs this proxy — **Server VAD enabled** (target)

| Mode | Who commits | This repo today | Target |
|------|-------------|-----------------|--------|
| **Server VAD (default API)** | Server commits on speech / end-of-turn per API | **Disabled:** `turn_detection: null` in `mapSettingsToSessionUpdate` ([translator.ts](../../../packages/voice-agent-backend/scripts/openai-proxy/translator.ts)) so proxy can **`commit` + `response.create`** without empty-buffer races | **Enable** `server_vad` (with explicit `idle_timeout_ms` / silence params TBD from **`Settings.agent.idleTimeoutMs`** and API schema). Proxy sends **`append` only**; **does not** send **`input_audio_buffer.commit`** on the mic path (see [PROTOCOL §3.6](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)). |
| **`turn_detection: null`** | Proxy must commit manually | Implemented; **scheduler gap** under continuous chunks | **Bridge:** Phase 1–2 tests + scheduler / close flush **until** Server VAD migration is green |

**Discounted (do not pursue as primary):** **`server_vad` + `create_response: false`** (and similar “hybrid” flags) *only* to keep VAD telemetry while manually firing **`response.create`**. **Why discounted:** It **still** relies on **server-side auto-commit** while adding a **second** control plane for **when** the model responds—harder to reason about than **one** strategy; easy to misconfigure next to **legacy proxy `commit`** code; does **not** simplify the codebase as much as **full Server VAD** with a **single** owner for buffer lifecycle. If product ever needs **manual** response gating with VAD on, revisit **after** baseline Server VAD + tests, not as the first spike.

---

## 3. Why existing tests did not catch continuous-stream stall

**`openai-proxy-integration.test.ts`** uses **one** large binary or **two** chunks with a **designed** post-last-chunk pause **≥ 400 ms**. It does **not** hold **steady** **&lt; 400 ms** cadence **after** crossing **`OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`**.

**Closure rule:** Phase 1 adds **RED** tests for that shape, then GREEN (**Phase 2**, 2026-04-04).

---

## 4. Phase 0 — Proxy completeness audit (**done for review — 2026-04-08**)

Walk-through: `translator.ts`, `server.ts`, `PROTOCOL-AND-MESSAGE-ORDERING.md`, `REALTIME-SESSION-UPDATE-FIELD-MAP.md`, `openai-audio-constants.ts`, representative **`openai-proxy-integration.test.ts`** coverage. Status: **Pass** (no known contradiction to docs), **Gap** (missing behavior or tests), **Risk** (needs real-API / migration check), **N/A**.

**Priority legend (audit + schedule):** **P0** — correctness / data loss on the live path; ship before relying on null-VAD or Server VAD in production. **P1** — qualification, observability, or doc closure before calling the slice “done.” **P2** — spec alignment or rare edge cases; still scheduled (implement + test, or **documented waiver** with rationale).

| Pri | Area | Reference | Status | Notes |
|-----|------|-----------|--------|-------|
| **P0** | **Session shape → Server VAD** | [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md), `mapSettingsToSessionUpdate` | **Pass** + **Gap** | Today: `session.audio.input` proxy-owned (`turn_detection: null`, PCM 24k, transcription). **Gap:** no mapping for **`server_vad`** fields (`idle_timeout_ms`, `silence_duration_ms`, …) from **`Settings`** — **Phase 2b** (§9 **P0**). |
| **P0** | **Ordering / gating (tests)** | [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §2–4 | **Pass** | **Pass:** append after `session.updated`, inject queue, `responseInProgress` through `output_text.done`, deferred `response.create` after function output — **well tested**. **Continuous-stream commit** + **client-close flush** locked in Jest (**Phase 1–2**, 2026-04-04). |
| **P0** | **Audio path (disconnect)** | `forwardClientMessage`, `Pcm16Mono16kTo24kStreamResampler`, `assertAppendChunkSize` | **Pass** | **Pass:** pre-`session.updated` queue + flush; min bytes before commit; max append size constant. **Client disconnect:** pending audio flushed when safe (**Phase 2** `flushPendingAudioCommitOnClientClose`). |
| **P2** | **Audio path (huge frame)** | same | **Risk** | Single client frame **> 15 MiB:** split not verified (likely **N/A** for mic). Resolve with test + split or **documented waiver** (§9 **P2**). |
| **P0** | **Lifecycle (client close)** | `client` / `upstream` `close` / `error` in `server.ts` | **Pass** | **Pass:** upstream-before-ready error to client; `client.close_code` logging (#532). **Client close** flushes pending commit when `!responseInProgress` (pad to API min if needed) before timer teardown — **Phase 2** (2026-04-04). |
| **P1** | **Transcript → component (post-VAD)** | `input_audio_transcription.*` mappers, #497 / #496 | **Pass** + **Risk** | **Pass:** delta + completed mapping covered in mock integration tests. **Risk:** **Server VAD** may change **event order** vs null-VAD — **`USE_REAL_APIS=1`** after **Phase 2b** (§9 **P1**). |
| **P0** | **Idle / timeout (migration)** | `turn_detection: null`, component `idleTimeoutMs` | **Pass** + **Gap** | **Pass:** documented: no server `idle_timeout_ms` on null path; tests use `NO_SERVER_TIMEOUT_MS` where relevant. **Gap:** after **Server VAD**, map **`idle_timeout_ms`** and document interaction with component idle manager — **Phase 2b** + **Phase 3**. |
| **P2** | **`input_audio_buffer.clear`** | OpenAI doc (new user input) | **Gap** | Doc: **`clear`** before a new user item when VAD off. Proxy may not emit **`clear`** on every turn boundary — **verify**; add tests + behavior or **documented waiver** (§9 **P2**). |

**Phase 0 conclusion:** **No third hidden P0** beyond **(A)** null-VAD **scheduler + close flush** (**Phase 2 done** 2026-04-04) and **(B)** **Server VAD migration** (session + idle fields, **`commit` removal**, **`response.create`** alignment — **Phase 2b**). Remaining audit items are **P1** (qualification / telemetry / docs) or **P2** (**`clear`**, 15 MiB). **Execution list:** **§9** below — follow unchecked **`[ ]`** items.

**Exit criterion met:** findings + priorities recorded; [TDD-PLAN.md §2b](./TDD-PLAN.md) updated for Phase 2 scheduler + close flush (§9 **P0** Phase 2).

---

## 5. Phase 1 — RED: new Jest cases (mock upstream)

**File:** `tests/integration/openai-proxy-integration.test.ts`.

1. **`Issue #560 / scheduler: continuous binary chunks` (mock)** — After `SettingsApplied`, send PCM chunks **every ~250 ms** until `pending` would exceed first-commit threshold **without** any inter-chunk gap **≥ 400 ms**. **Expect:** within **`firstCommitMaxWaitMs`**, mock receives **≥ 1** `input_audio_buffer.commit` **or** documented new contract. **Status:** **GREEN** with Phase 2 (`INPUT_AUDIO_COMMIT_MAX_COALESCE_MS` one-shot coalesce alongside debounce).

2. **`Issue #560 / scheduler: client close with pending audio` (mock)** — Stream or buffer **≥ min** bytes, close client **without** trailing silence. **Expect:** commit (or visible error), not silent drop. **Status:** **GREEN** with Phase 2 (`flushPendingAudioCommitOnClientClose`).

---

## 6. Phase 2 — GREEN: null-VAD bridge (short term) — **done (2026-04-04)**

**Shipped:** **`INPUT_AUDIO_COMMIT_MAX_COALESCE_MS`** (600 ms, **>** 400 ms debounce) — one-shot max-coalesce timer armed when pending first meets min bytes for the burst (not cleared on every append), so continuous **&lt; 400 ms** cadence can still commit. **`flushPendingAudioCommitOnClientClose`** — on client `close`, when `!responseInProgress`, pad to min bytes if needed, then commit + `response.create` via shared **`performAudioCommitIfEligible`**. **Tests:** full mock **`openai-proxy-integration.test.ts`** green (`--runInBand`); **Issue #414** ordering test clears **`mockReceived`** on **`open`** so shared mock state is not polluted by a prior leg’s late append (close-flush). **Qualification:** **`USE_REAL_APIS=1`** after Phase **2b** (per §9 P1), not required to close this P0 slice on mocks alone.

---

## 6b. Phase 2b — Server VAD enable (strategic) — **opt-in shipped (2026-04-04)**

1. **`mapSettingsToSessionUpdate`:** when **`agent.useOpenAIServerVad === true`**, set **`turn_detection`** via **`buildOpenAIServerVadTurnDetection(agent.idleTimeoutMs)`** (threshold / prefix / silence / **`create_response`:** true / **`interrupt_response`:** true). Default unset → **`turn_detection: null`** (unchanged).
2. **`server.ts`:** **`sessionUpdateUsesOpenAIServerVad`** after first **`session.update`**; mic path: append only (no **`commit`**, no coalesce timers, no close-flush **`commit`**). **`response.created`:** **`onResponseStarted()`** only if **`micInputUsesOpenAIServerVad && !responseInProgress`** (server-started turn vs our **`response.create`**).
3. **Tests:** mock Jest (unit + *Issue #560 Phase 2b* integration). **`USE_REAL_APIS=1`** VAD path = P1 qualification.
4. **Docs:** [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md), package [README.md](../../../packages/voice-agent-backend/scripts/openai-proxy/README.md), this file **§9**.

**Depends on:** Phase 0 sign-off and Phase 1–2 stability (or parallel if staffed).

---

## 7. Phase 3 — REFACTOR + documentation

Update [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md), [TDD-PLAN.md §2b](./TDD-PLAN.md), [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md), handoff files.

---

## 8. §4 — **Requirement:** client chunk-period observability

Extend [`test-app/src/mic-timing-debug.ts`](../../../test-app/src/mic-timing-debug.ts) (and/or **`AudioManager`**) for **inter-chunk** min/max/median and optional **bytes/chunk**; document in manual repro; unit test if non-trivial.

---

## 9. Backlog schedule (prioritized checkboxes)

**Legend:** `[ ]` = not done · `[x]` = done (date optional). **Order:** complete **P0** in phase order (1 → 2 → 2b) unless parallel staffing; **P1** after the relevant P0 slice is green; **P2** may trail P1 or run in parallel once P0 path is stable.

### Done (Phase 0)

- `[x]` **Phase 0** — Proxy completeness audit recorded in **§4** (2026-04-08).

### P0 — Null-VAD data loss + Server VAD migration

*Maps to audit rows: ordering/gating tests, audio disconnect, lifecycle close, session `server_vad` fields, idle/timeout mapping.*

- `[x]` **Phase 1 RED** — `openai-proxy-integration.test.ts` — *Issue #560 / scheduler:* (1) continuous ~250 ms 16 kHz chunks → **≥ 1** `input_audio_buffer.commit` within bounded wait; (2) client **close** with pending audio → **≥ 1** commit (no silent drop).
- `[x]` **Phase 2 GREEN** — null-VAD bridge: **`INPUT_AUDIO_COMMIT_MAX_COALESCE_MS`** + **`flushPendingAudioCommitOnClientClose`** in **`server.ts`**; full mock **`openai-proxy-integration.test.ts`** green (`--runInBand --forceExit`); `-t "Issue #560 / scheduler"` green. **2026-04-04.**
- `[x]` **Phase 2b** — `mapSettingsToSessionUpdate`: opt-in **`agent.useOpenAIServerVad`** → **`turn_detection.type: server_vad`** + VAD defaults + **`idle_timeout_ms`** from **`agent.idleTimeoutMs`** (clamped 5s–30s; `-1`/omit → `null`). **2026-04-04.**
- `[x]` **Phase 2b** — `server.ts`: when Server VAD (above), **no** proxy **`input_audio_buffer.commit`** / coalesce / close-flush for mic; **`response.created`** from upstream calls **`onResponseStarted`** only when **`!responseInProgress`** (avoids double-invoke with our **`response.create`**). **2026-04-04.**
- `[x]` **Phase 2b** — Jest: `openai-proxy.test.ts` (map + `sessionUpdateUsesOpenAIServerVad`); `openai-proxy-integration.test.ts` *Issue #560 Phase 2b* (no proxy commit under VAD). Default **`useOpenAIServerVad` unset** → existing null-VAD tests unchanged.

### P1 — Qualification, observability, doc closure

*Maps to audit: transcript/event order risk after VAD; manual repro alignment; parent TDD table.*

- `[ ]` **`USE_REAL_APIS=1`** — `npm test -- tests/integration/openai-proxy-integration.test.ts` with `OPENAI_API_KEY` after **Phase 2b** (event order / transcription path vs null-VAD).
- `[ ]` **§8** — Client chunk-period telemetry (`mic-timing-debug.ts` / `AudioManager`) + manual repro doc; unit test if non-trivial.
- `[ ]` **Phase 3** — [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md), [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) / REALTIME field map as needed, [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md), [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) / [CURRENT-STATUS.md](./CURRENT-STATUS.md) / [NEXT-STEP.md](./NEXT-STEP.md).
- `[x]` **TDD-PLAN §2b** — Rows for **continuous-stream scheduler** + **client-close flush** (Phase 2); Server VAD path rows remain for **Phase 2b**.

### P2 — Spec alignment and rare edge cases

*Maps to audit: `input_audio_buffer.clear` vs OpenAI doc; optional 15 MiB append split.*

- `[ ]` **`input_audio_buffer.clear`** — Trace null-VAD / proxy lifecycle; add tests + emit **`clear`** where required **or** record **documented waiver** (why redundant) in PROTOCOL / REALTIME map.
- `[ ]` **> 15 MiB single append** — Add split + test **or** **documented waiver** (mic path N/A); link from REALTIME / server comment if waived.

### Summary table (rollup)

| Priority | Open items (unchecked until closed) |
|----------|----------------------------------------|
| **P0** | *(none — Phase 2b opt-in landed 2026-04-04; making Server VAD the default is a product/compat follow-up.)* |
| **P1** | Real API qualification (post-2b), §8 telemetry, Phase 3 docs |
| **P2** | **`clear`** resolution, 15 MiB split or waiver |

---

## Privacy

Do not commit raw `backend-*.log` files; reference **message types** and **timings** only.

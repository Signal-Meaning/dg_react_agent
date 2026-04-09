# Agent handoff — Issue #560 (host mic + OpenAI proxy)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Purpose:** Orient a **coding agent** on a bug that **reproduces outside automation** (host mic + test-app Live + OpenAI proxy — see linked docs) but is **not** expressed as a **currently failing** test. Prior work locked several hypotheses in Jest/E2E; **reporter-visible failure persists** (**2026-04-04** retest unchanged). **Your job:** reason from **this repo** (code + existing log narratives + tests), **add RED tests** where rules allow, then fix — or **prove** the remainder is upstream/model/env with evidence in docs.

---

## 1. What the reporter sees (failure mode)

- **Context:** test-app, **Live** mode, **host microphone**, **OpenAI proxy** (`wss?://…/openai`), not Playwright-injected PCM.
- **User STT:** Nonsense or truncated text (e.g. **`.`**, **`SHELX.`**) that does **not** match spoken English; see captured log narratives in [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md).
- **Assistant behavior:** Generic or **off-language** replies when input transcript is garbage (treat as **symptom**, not primary root cause, until transcripts are clean).
- **Proxy log pattern (historical):** After **`response.done`**, long runs of **`input_audio_buffer.append`** with **no** further **`commit`** / transcription in the same session — partially addressed in code (**`onResponseEnded` → `scheduleAudioCommit`**); **manual repro still bad** after retest, so either the fix is insufficient, another path dominates, or STT/commit issues are **orthogonal**.

**Do not assume** the bug is only “partner wiring”: the same stack fails for the maintainer under the **documented host-mic scenario** (§3).

---

## 2. Why existing tests stay green (automation gap)

The codebase already has **passing** tests for:

| Layer | What is locked | Representative tests / specs |
|--------|----------------|------------------------------|
| PCM rate | 48 kHz context → **16 kHz** int16 before proxy; wrong path ~3× byte ratio | `tests/unit/audio-utils-mic-pcm-issue560.test.ts`, `tests/unit/mic-pcm-proxy-chain-issue560.test.ts` |
| Proxy commit scheduling | Second commit rescheduled after response ends | `tests/integration/openai-proxy-integration.test.ts` — *Issue #560: reschedules audio commit…* |
| Null-VAD continuous stream + disconnect | Debounce never completes on steady mic; pending PCM dropped on client close | Same file — *Issue #560 / scheduler: continuous … bounded wait*; *… client close with pending mic audio …*; **`server.ts`** max coalesce + `flushPendingAudioCommitOnClientClose` (Phase 2, 2026-04-04) |
| Client gating | Audio not sent before settings / 500 ms debounce correctly cleared | `tests/send-audio-after-settings-applied-issue560.test.tsx` |
| Worklet drift | Single generated inline worklet matches source | `tests/unit/microphone-worklet-inline-sync.test.ts` + `npm run generate:mic-worklet` |
| Resampler | Proxy 16→24 k expectations | `tests/openai-proxy-pcm-resample.test.ts` |
| OpenAI Live E2E | **Injected** audio after **`stopAudioCapture()`** — distinctive phrase → transcript | `test-app/tests/e2e/live-mode-openai-proxy.spec.js` |
| Mic path smoke (fake device) | GUM + non-empty binary WebSocket sends, even chunk sizes | `test-app/tests/e2e/live-mode-openai-proxy-mic-uplink-issue560.spec.js` |

**None of these** assert: “**OpenAI user transcript** for **host mic** in a **real browser** matches a **golden phrase**.” Playwright uses **fake media**; injected-audio E2E does not exercise **browser capture + room acoustics**. The reporter’s failure can remain real while every listed test passes — expected until a **new RED test** lands or the gap is proven out-of-repo.

Full mapping: [TDD-PLAN.md](./TDD-PLAN.md) §2b.

---

## 3. Evidence and repro (in-repo reference — for humans)

Use these when parsing **what failed**; an agent should **treat them as specifications**, not a personal runbook:

- [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md) — scenario steps (human-operated).
- [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) — message types, transcript strings, tail behavior (from captured logs; do not commit raw logs).
- [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) — checklist §D (client vs proxy vs upstream vs UI).

---

## 4. Suggested agent workflow (code + tests)

1. **Read** §3 artifacts and map claims to **symbols** (`DeepgramVoiceInteraction.sendAudioData`, `packages/voice-agent-backend/scripts/openai-proxy/server.ts`, `AudioManager`, resampler helpers). Use ripgrep / semantic search; trace control flow and constants (min commit bytes, debounce, `responseInProgress`).
2. **Align** failure narrative with §D: which layer would have to break to produce **garbage STT** vs **append-only tail** vs **missing second commit**? Cross-check against [TDD-PLAN.md](./TDD-PLAN.md) §2b rows already covered by passing tests.
3. **Exploit timing math in tests:** first-commit window (~256 ms @ 24 kHz after resample) vs phrase length — [TDD-PLAN.md](./TDD-PLAN.md) explicit gap; extend **proxy integration** or **fixtures** with a **fixed timeline** if that is the next lockable hypothesis (RED first).
4. **Add or tighten automation:** new Jest cases for proxy scheduling with **mic-shaped chunk streams**; optional Playwright telemetry hooks in `test-app/tests/e2e/helpers/mic-e2e-telemetry.js` **only** if they assert an invariant (not “run browser and look”).
5. **Run** targeted **`npm test`** / **`cd test-app && npm run test:e2e -- …`** per [TDD-PLAN.md](./TDD-PLAN.md) §7 and `.cursorrules`; use **`USE_REAL_APIS=1`** when validating proxy↔API behavior.
6. **If** code review proves upstream-only failure: record mechanism + citations in issue docs; do not patch the client to mask API behavior without product agreement.

---

## 5. Project rules (do not skip)

- **TDD:** New behavior or bug fix at a testable layer → **failing test first**, then implementation ([`.cursorrules`](../../../.cursorrules), [TDD-PLAN.md](./TDD-PLAN.md)).
- **No fabricated passes:** Do not invent proxy responses or weaken assertions to green CI.
- **Proxy / ordering fixes:** Qualify against **real** upstream where applicable (see `.cursorrules` — Release qualification, Issue #462 / #466).
- **Voice Agent API:** Package must remain compatible with [Deepgram Voice Agent API](https://developers.deepgram.com/docs/voice-agent) expectations where relevant; this bug path is **OpenAI Realtime via our proxy**, but do not break shared abstractions without cause.

---

## 6. Living doc index (this issue folder)

| Doc | Use |
|-----|-----|
| [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) | This file — start here for a new agent |
| [CURRENT-STATUS.md](./CURRENT-STATUS.md) | Short snapshot |
| [NEXT-STEP.md](./NEXT-STEP.md) | Queued steps (tagged human vs agent) |
| [TDD-PLAN.md](./TDD-PLAN.md) | Phases, §2b test matrix, commands |
| [COMMIT-SCHEDULER-TDD-PLAN.md](./COMMIT-SCHEDULER-TDD-PLAN.md) | **§4** audit (**P0–P2**), **§9** execution checklist; null-VAD (1–2), **Server VAD** (2b); hybrid **discounted** §2 |
| [TRACKING.md](./TRACKING.md) | Checklist |
| [README.md](./README.md) | Issue scope |

Related: [#561](../ISSUE-561/README.md) (Live UI), [#462](../ISSUE-462/README.md) (partner process), [#414](../ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md) (OpenAI `transcription: false` semantics).

---

## 7. Handoff state (fill in when you close or pause)

| Field | Value |
|-------|--------|
| Last known branch | `issue-560` |
| Reporter-visible repro | **Re-verify** after **§2c** proxy (first-commit + orphan pad). Last logged pre-fix: **2026-04-04** — [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md) |
| New tests (mock) | **Yes** — `openai-proxy-integration.test.ts`: *orphan tail*, *first-commit byte threshold*, *Issue #560 / scheduler* (continuous chunks + client-close flush); *Issue #414* ordering test clears shared **`mockReceived`** on **`open`** (stability with close-flush) |
| Root cause conclusion | **Partial (proxy):** §2c first commit + orphan tail; **Phase 2** null-VAD scheduler + close flush; **Phase 2b (2026-04-04)** opt-in **`useOpenAIServerVad`** (append-only mic, `server_vad` session); **semantic STT** / upstream still need human + real-API runs; qualify VAD with **`USE_REAL_APIS=1`** when keys available |

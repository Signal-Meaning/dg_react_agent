# Issue #560 — current status

**Last updated:** 2026-04-05 (isolation trace + start-options contract test)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Branch:** `issue-560`

---

## Where we are (phase)

| Phase | Status |
|-------|--------|
| **Repro (manual, local)** | **Done** — exercised during [Issue #561](../ISSUE-561/README.md) (Live mode, OpenAI proxy vs Deepgram, mic / `start()` / `startAudioCapture()` policy, idle disconnect sync). See [#561 CURRENT-STATUS](../ISSUE-561/CURRENT-STATUS.md) for bug tables and locked decisions. |
| **Isolation** | **Documented (round 1)** — see **Isolation trace** below; partner next step is to diff their wiring against this chain + `getVoiceAgentStartOptions`. |
| **Fix + tests** | **Partial** — unit tests lock **which `start()` flags** test-app uses for mic/Live (`test-app/src/live-mode/voiceAgentStartOptions.ts`). Further tests if defect is inside `src/` after partner parity check. |

---

## Problem statement (from issue scope)

1. **Voice-commerce / partner:** Reported **microphone activation regression** — compare against known-good integration after we know which layer failed.
2. **test-app:** Manual repro **available** from #561 work; use it to **stress the same paths** the partner hits while bisecting package vs app.
3. **Build:** **`npm run build`** in `test-app` (includes **`tsc -b`**) — see **Build** row below.

---

## Failing invariant (for isolation)

**Primary invariant under review:** After a **user gesture**, the integration must call `ref.start(...)` with **mode-correct flags** (OpenAI proxy URL → `agent` only, no separate transcription socket; Deepgram-direct → `agent` + `transcription`), then **`ref.startAudioCapture()`** so the **package** attaches the mic and can send uplink audio. A regression is **test-app / partner wiring** if either call is missing, reordered, or uses the wrong flags; it is **package (`src/`)** if both calls match this contract and audio still does not reach the agent (or session misbehaves internally).

---

## Isolation trace (call chain)

| Step | Location | Role |
|------|----------|------|
| 1 | `test-app/src/live-mode/LiveModeView.tsx` | **Presentational only** — no ref; `onResumeMic` / `onEndLive` are callbacks. |
| 2 | `test-app/src/App.tsx` — `enterLiveMode`, `resumeMicrophoneInLive`, `toggleMicrophone` | All mic-on paths funnel to **`startServicesAndMicrophone`**. |
| 3 | `test-app/src/App.tsx` — `startServicesAndMicrophone` | `getVoiceAgentStartOptions(proxyEndpoint)` → `await ref.start(opts)` → `await ref.startAudioCapture()`. |
| 4 | `test-app/src/live-mode/voiceAgentStartOptions.ts` | **Integration contract** (OpenAI proxy vs Deepgram) — covered by `test-app/tests/unit/voiceAgentStartOptions.test.ts`. |
| 5 | `src/components/DeepgramVoiceInteraction/index.tsx` — `start` | Connects agent (and transcription if requested) WebSockets; **does not** start recording (see comments ~3300). |
| 6 | Same file — `startAudioCapture` (~3831) | Lazy mic init + meaningful activity; **package** owns capture → uplink. |

**Round-1 conclusion:** Wrong **flags** or **skipped** `startAudioCapture` in partner code are **outside** the npm package. If the partner matches **test-app’s** sequence and flags and the bug persists, continue in **`DeepgramVoiceInteraction`** (audio pipeline, WS lifecycle).

---

## What we know

| Area | Detail |
|------|--------|
| Local manual repro | **Yes** — from #561: Live entry, proxy OpenAI vs direct Deepgram, mic enable / resume after disconnect, `ref.start(...)` + `startAudioCapture()` policy. Cross-check [ISSUE-561 TDD-PLAN](../ISSUE-561/TDD-PLAN.md) §2 (microphone / `start()` rules). |
| Symptom / invariant | See **Failing invariant** above. |
| Deliverable vs test-app | **Round 1:** Mic/Live **start flag** policy is **test-app** (now **`voiceAgentStartOptions`** + `App.tsx`). **Package** still owns post-`startAudioCapture` behavior — validate only after partner parity with this chain. |
| `tsc` / build | **`cd test-app && npm run build`** — **green** on `issue-560` (2026-04-05). If CI or another env fails, paste the first error here. |

---

## Locked decisions

*(None yet. Add only when something must not regress during #560 work.)*

---

## Artifacts

| Artifact | Location / note |
|----------|-----------------|
| E2E logs | `logs/` when using `npm run test:e2e:log` (see repo root / test-app `package.json`) |
| Start options contract | `test-app/src/live-mode/voiceAgentStartOptions.ts` + `test-app/tests/unit/voiceAgentStartOptions.test.ts` |

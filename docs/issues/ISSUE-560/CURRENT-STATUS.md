# Issue #560 — current status

**Last updated:** 2026-04-08 (**Mic / OpenAI proxy contract:** **`CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ`** (`mic-audio-contract.ts`) + **`prepareMicPcmForAgent`** (AudioContext → **16 kHz** PCM before binary uplink); **DRY worklet:** canonical **`AudioWorkletProcessor.js`** → **`microphone-worklet-inline.generated.ts`** via **`npm run generate:mic-worklet`**, guarded by **`microphone-worklet-inline-sync.test.ts`**. **Proxy:** **`onResponseEnded`** → **`scheduleAudioCommit`** (prior push). **Manual retest log** **`backend-20260408-142135`:** upstream transcript **`SHELX.`** + **Korean** assistant — see [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) follow-up section. **OTel:** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565). [NEXT-STEP.md](./NEXT-STEP.md).)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Branch:** `issue-560`

---

## Where we are (phase)

| Phase | Status |
|-------|--------|
| **Repro (manual, local)** | **Done** — exercised during [Issue #561](../ISSUE-561/README.md) (Live mode, OpenAI proxy vs Deepgram, mic / `start()` / `startAudioCapture()` policy, idle disconnect sync). See [#561 CURRENT-STATUS](../ISSUE-561/CURRENT-STATUS.md) for bug tables and locked decisions. |
| **Isolation** | **Documented (round 1 + round 2)** — see **Isolation trace** and **Uplink parity (code)** below; **not** closed: manual repro can still diverge from E2E for **room audio / timing / upstream**, but **package uplink entry** is the same for mic and injected PCM. |
| **Fix + tests** | **Mock-path green** — package **`settingsSentTimeRef`** fix + Live E2E: **`stopAudioCapture()`** on ref (Issue #560) so Playwright fake mic does not contend with **`sendAudioData`** injection on OpenAI `input_audio_buffer`; **`e2eIdleTimeoutMs`** query overrides short global `VITE_IDLE_TIMEOUT_MS` when needed (**Jest:** `test-app/tests/e2eIdleTimeoutMs.test.ts`, `tests/send-audio-after-settings-applied-issue560.test.tsx`). **Root real-API integration:** `USE_REAL_APIS=1` **`openai-proxy-integration.test.ts`** green (2026-04-08). **Playwright real-API OpenAI + Live:** `USE_REAL_APIS=1` **`openai-proxy-e2e.spec.js`** + **`live-mode-openai-proxy.spec.js`** green (2026-04-04, 18 passed / 2 skipped; serial workers via **`playwright-workers-from-env.cjs`**). **OpenAI proxy (Issue #560):** **`onResponseEnded`** reschedules **`scheduleAudioCommit`** when enough bytes are queued — fixes **stuck second commit** after a timer no-op during an active response (**`server.ts`** + Jest Issue #560 case). **Mic PCM (package `src/`):** worklet → float32 @ **AudioContext** rate → **`prepareMicPcmForAgent`** → **16 kHz** PCM16 for OpenAI proxy (**`mic-audio-contract.ts`**, **`AudioUtils`**, **`audio-utils-mic-pcm-issue560.test.ts`**). **Manual host mic:** still **noisy / wrong STT** in **`backend-20260408-142135`** after pipeline fix — see manual report **follow-up**; also verify **test-app rebuild**, **proxy** build, and **second commit** behavior — [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md). |

---

## Real mic / Live vs E2E fake-audio (hypothesis)

| Observation | Detail |
|---------------|--------|
| **Manual** | With test-app **mic** or **Live**, **Agent Response** / conversation can stay empty or wrong despite **connected**-looking state. |
| **E2E** | Playwright specs often **inject PCM** or scripted paths; **real `getUserMedia`** and room audio are a different surface. |
| **Working theory** | If **real-API** proxy integration tests **pass** with **injected/fake audio** but **manual real mic fails**, suspect **test-app wiring** (timing, VAD/transcription expectations, UI sync) or **browser capture path**, not only `start()` flags — **not** fully isolated to “partner only” until this gap is closed. |

Next: if manual “no Agent Response” persists after confirming keys and proxy health, capture **whether Live conversation lines update** while the **standalone Agent Response `<pre>`** does not — **Issue #414** intentionally skips updating that readout when the utterance is the configured greeting and the penultimate history entry is user (now covered by `agentUtteranceGreetingPolicy.test.ts`). Prefer **Live conversation** and server logs for proxy debugging.

---

## Uplink parity (code — round 2)

| Path | How audio reaches the agent socket |
|------|-------------------------------------|
| **Playwright E2E** (`audio-helpers.js` → `loadAndSendAudioSample`) | `window.deepgramRef.current.sendAudioData(chunk)` |
| **Real microphone** (`startAudioCapture`) | `AudioManager` worklet `message` with `event.type === 'data'` → same **`sendAudioData`** in `DeepgramVoiceInteraction` (repo `src/components/DeepgramVoiceInteraction/index.tsx` ~3820) |

Both paths hit the same **settings / connection / sleep** gating inside `sendAudioData`. Remaining **E2E vs manual** differences are **not** “different methods” at the package boundary; they are **capture quality**, **timing**, **401/upstream**, and **test-app debug UI** (e.g. greeting suppression above).

---

## Manual testing / backend env (same issue bucket as “confusing local repro”)

| Topic | Detail |
|--------|--------|
| **Restart backend?** | **test-app-only changes** (UI, Vite build, Playwright specs, client-side voice-provider toggle): **no** — refresh the browser / rebuild the frontend. **Restart** `npm run start` / `npm run backend` only when **`packages/voice-agent-backend`** (or proxy scripts) change, or when you change **server `.env`** and want a clean process. |
| **Canonical cwd** | `packages/voice-agent-backend` — `npm run start` or `npm run backend` runs `test-app/scripts/backend-server.js` with secrets from **`packages/voice-agent-backend/.env`** only (not `test-app/.env`). |
| **test-app** | `npm run backend` delegates to the package (`--prefix ../packages/voice-agent-backend`). |
| **OpenAI subprocess** | `scripts/openai-proxy/run.ts` loads `.env` from cwd → parent → repo root only; it **no longer** loads `test-app/.env`, so Vite/frontend env cannot override `OPENAI_API_KEY` unexpectedly. |
| **Proxy errors** | Deepgram/OpenAI proxy `log.error` second argument is an object (fixes string spread into numeric keys in console). |

---

## Problem statement (from issue scope)

1. **Voice-commerce / partner:** Reported **microphone activation regression** — compare against known-good integration after we know which layer failed.
2. **test-app:** Manual repro **available** from #561 work; use it to **stress the same paths** the partner hits while bisecting package vs app.
3. **Build:** **`npm run build`** in `test-app` (includes **`tsc -b`**) — see **Build** row below.

---

## Failing invariant (for isolation)

**Primary invariant under review:** After a **user gesture**, the integration must call `ref.start(...)` with **mode-correct flags**. **OpenAI proxy:** `agent: true` and `transcription: false` at the component API means **do not** open the **Deepgram Listen** transcription WebSocket; user speech is still transcribed on the **OpenAI Realtime** session (same proxy WebSocket). **Deepgram-direct:** `agent` + `transcription` true opens the Voice Agent path plus the separate transcription service. Then **`ref.startAudioCapture()`** attaches the mic for uplink. A regression is **test-app / partner wiring** if either call is missing, reordered, or uses the wrong flags; it is **package (`src/`)** if both calls match this contract and audio still does not reach the agent (or session misbehaves internally). See [Issue #414 COMPONENT-PROXY-INTERFACE-TDD §OpenAI](../ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md).

---

## Isolation trace (call chain)

| Step | Location | Role |
|------|----------|------|
| 1 | `test-app/src/live-mode/LiveModeView.tsx` | **Presentational only** — no ref; `onResumeMic` / `onEndLive` are callbacks. |
| 2 | `test-app/src/App.tsx` — `enterLiveMode`, `resumeMicrophoneInLive`, `toggleMicrophone` | All mic-on paths funnel to **`startServicesAndMicrophone`**. |
| 3 | `test-app/src/App.tsx` — `startServicesAndMicrophone` | `getVoiceAgentStartOptions(proxyEndpoint)` → `await ref.start(opts)` → `await ref.startAudioCapture()`. |
| 4 | `test-app/src/live-mode/voiceAgentStartOptions.ts` | **Integration contract** (OpenAI proxy vs Deepgram) — covered by `test-app/tests/unit/voiceAgentStartOptions.test.ts`. |
| 5 | `src/components/DeepgramVoiceInteraction/index.tsx` — `start` | Connects agent (and transcription if requested) WebSockets; **does not** start recording (see comments ~3300). |
| 6 | Same file — `startAudioCapture` / **`stopAudioCapture`** (~3831 / adjacent) | Lazy mic init + meaningful activity; **`stopAudioCapture`** stops uplink without closing the agent socket (Live E2E + integrators). |

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

| Decision | Rationale |
|----------|-----------|
| **Text-input `onFocus` auto-`start()`** uses **`getVoiceAgentStartOptions(proxyEndpoint)`** (same as `startServicesAndMicrophone` / Live). | Avoids Deepgram-direct + text-first flows passing **`transcription: false`** (skipping the Listen socket) while mic/Live correctly requested **`transcription: true`**. OpenAI proxy shape unchanged: still **`transcription: false`** at the component API (Realtime carries STT). |
| **PCM after settings confirmed** | **`settingsSentTimeRef = null`** when **`SettingsApplied` / `session.created`** is handled, so the 500 ms debounce does not keep blocking after the server confirms the session. |
| **[#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) Deepgram key renewal** | **Explicitly deferred until #560 is resolved** — finish OpenAI-proxy / Live qualification first; then renew key and re-run Deepgram E2E. |

---

## Artifacts

| Artifact | Location / note |
|----------|-----------------|
| E2E logs | `logs/` when using `npm run test:e2e:log` (see repo root / test-app `package.json`) |
| Live vs OpenAI E2E isolation | [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) — test 5 vs Live, pre-confirmation gate + **clear on confirmation**, `__e2eWsBinarySendCount`, **`waitForFinalUserTranscriptNormalized`** |
| Manual mic + OpenAI proxy (debug log) | [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) — local **`backend-20260408-111420.log`**, STT **`.`**, append-only tail |
| Start options contract | `test-app/src/live-mode/voiceAgentStartOptions.ts` + `test-app/tests/unit/voiceAgentStartOptions.test.ts` |
| Agent Response vs greeting (Issue #414) | `test-app/src/utils/agentUtteranceGreetingPolicy.ts` + `test-app/tests/unit/agentUtteranceGreetingPolicy.test.ts` |
| Instructions env | No `VITE_AGENT_INSTRUCTIONS` in repo — use `VITE_DEFAULT_INSTRUCTIONS` or `VITE_E2E_INSTRUCTIONS` (`instructions-loader.ts`, Instructions Status `data-testid="instructions-source-line"`). |
| Backend env template | `packages/voice-agent-backend/backend.env.example` |
| Backend liveness / readiness | **`GET /health`**, **`GET /ready`** on test-app backend (`backend-server.js`); see [ARCHITECTURE.md](../../BACKEND-PROXY/ARCHITECTURE.md) |
| Backend integration (Jest) | **`cd test-app && npm test -- backend-server-integration`** — `SKIP_DOTENV` spawn, key requirement, `/health` / `/ready`, HTTPS log |

### Tests run for recent slices (agent should re-run after local edits)

| Suite | Command (typical) | CI / agent in this session |
|-------|-------------------|----------------------------|
| test-app unit | `cd test-app && npm test -- <file>.test.ts` | Run for touched files; full `npm test` recommended before merge. |
| Package Jest | `npm test -- conversation-storage-issue406` (root) | Run when `DeepgramVoiceInteraction` / storage changes. |
| OpenAI proxy E2E + Live (real API) | `cd test-app && USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js live-mode-openai-proxy.spec.js` | Qualification slice (Issue #560 item 1). Playwright starts dev + backend unless **`E2E_USE_EXISTING_SERVER=1`**. With **`USE_REAL_APIS=1`**, config uses **`workers: 1`** (**`playwright-workers-from-env.cjs`**) so OpenAI + Live specs do not run in parallel against one backend. |
| OpenAI proxy E2E (subset) | `cd test-app && npm run test:e2e -- openai-proxy-e2e.spec.js` | Mock or real per env; same workers rule when **`USE_REAL_APIS=1`**. |
| OpenAI proxy integration (root) | `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` | **Issue #489** subset + proxy debug: `USE_REAL_APIS=1 LOG_LEVEL=debug npm test -- … -t "Issue #489 real-API: after FunctionCallResponse"`. Observations: [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md). |
| Live mode E2E | `cd test-app && npm run test:e2e -- live-mode-openai-proxy.spec.js` | **`stopAudioCapture`** before **`loadAndSendAudioSample`** (fake mic vs inject); **`e2eIdleTimeoutMs`** on URL via **`setupTestPageWithOpenAIProxy` `extraParams`**; **`waitForFinalUserTranscriptNormalized`**. |
| E2E skip policy (Jest) | `cd test-app && npm test -- openai-proxy-e2e-skip-policy` | Locks OpenAI-key-in-Playwright policy; uses **`e2e-skip-env-policy.cjs`**. |
| Playwright workers (Jest) | `cd test-app && npm test -- playwright-workers-from-env` | **`USE_REAL_APIS=1`** / **`CI`** → **`workers: 1`** in **`tests/playwright.config.mjs`**. |
| test-app backend integration | `cd test-app && npm test -- backend-server-integration` | Replaces former **`mock-proxy-server-integration`** name. |

**Honest default:** implementer runs **build + targeted Jest**; **full Playwright OpenAI/Live** is **manual/CI** when servers and `USE_REAL_APIS` match project rules.

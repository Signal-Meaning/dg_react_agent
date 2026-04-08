# TDD Plan: Issue #560 — Mic regression repro + test-app build

**Issue:** [#560 — Backlog: voice-commerce mic activation regression; test-app build](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Principle:** **Red → Green → Refactor.** Tests first where they define behavior; minimal implementation to go green. For **#560**, every **documented root cause** must be **locked by Jest** (see **§2b**); manual host-mic is **not** sufficient evidence of a fix on its own. The headless `@signal-meaning/voice-agent-react` package must stay compatible with the [Voice Agent API](https://developers.deepgram.com/docs/voice-agent). Prefer **npm scripts** from `test-app` per [.cursorrules](../../../.cursorrules).

**Process note (2026-04):** Larger UI refactors (voice provider toggle, removing duplicate panels) should still follow **tests-first for anything an E2E or unit test can lock**—e.g. update `SELECTORS` / specs **before** removing `data-testid` nodes; add or extend Jest **before** changing `getConversationHistory` behavior. Retroactive doc/test alignment is recorded in Phase B/C checkboxes below.

**Recovery (new chat):** Read [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) (investigator brief), [CURRENT-STATUS.md](./CURRENT-STATUS.md), [NEXT-STEP.md](./NEXT-STEP.md), this file, [README.md](./README.md). **Host mic repro:** [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md). **OpenAI proxy commit timing:** [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md) + **§2c** (implemented on mock path — re-qualify **`USE_REAL_APIS=1`** when keys available). **Live UI context:** [#561](../ISSUE-561/README.md). **#560** is isolation + fix in the **correct layer**.

---

## Checkbox legend

- `[ ]` — Not done.
- `[x]` — Done (tests green; update this doc when complete).

---

## 1. Goals

| Goal | Notes |
|------|--------|
| **G1** | **Isolate** mic-related failure: **`@signal-meaning/voice-agent-react`** (`src/`) vs **test-app** integration. Manual repro already exists from [#561](../ISSUE-561/README.md). |
| **G2** | Add or extend **tests** at the **layer that owns the bug** (package `tests/` vs `test-app/tests/`). For #560 mic/proxy work, each **accepted root cause** must map to **automated** tests per **§2b** (manual is supplemental only). |
| **G3** | Fix **`test-app` `npm run build`** / **`tsc -b`** until clean (may proceed in parallel). |

---

## 2. Constraints

- Do **not** weaken partner-reported scenarios: see [#462](../ISSUE-462/README.md) for voice-commerce lessons.
- **Mic / `start()` semantics** overlap [Issue #561](../ISSUE-561/README.md) Live work — **#561** carried manual repro and UI policy; **#560** decides if the remaining partner gap is **deliverable** code. Cross-link PRs and update both CURRENT-STATUS files if work splits across issues.
- E2E that need real APIs: follow repo rules (proxy, keys, `test-app` as cwd).

---

## 2b. Root cause → automated tests (closure rule for #560)

**Do not use manual host-mic runs as the only proof that a root cause is fixed.** Each **accepted root cause** below must be covered by **at least one Jest test** that would **fail** if the bug returns. Manual steps ([MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md), [#561](../ISSUE-561/README.md)) are **supplemental**: real device, room audio, and upstream variance are not reproducible in CI.

**When you identify a new root cause:** add or extend a **failing test first** (RED), then fix (GREEN). Record the mapping in this table.

| Root cause (accepted) | Symptom (manual / log) | Automated lock |
|----------------------|-------------------------|----------------|
| **PCM rate mismatch:** AudioWorklet runs at **AudioContext** Hz; sending int16 **without** downsampling to **16 kHz** makes the proxy treat time axis incorrectly | Garbage user STT (e.g. `.`, `1`, `SHELX.`) | `tests/unit/audio-utils-mic-pcm-issue560.test.ts`; **`tests/unit/mic-pcm-proxy-chain-issue560.test.ts`** (48 k → 16 k sample count, **3× buggy-path** contrast vs raw float→int16, **16→24 k** chain with `Pcm16Mono16kTo24kStreamResampler`) |
| **Stuck second commit:** debounced `scheduleAudioCommit` no-ops while `responseInProgress` and was not rescheduled | Many `append` lines, no second `commit` | `tests/integration/openai-proxy-integration.test.ts` — *Issue #560: reschedules audio commit after response ends…* |
| **`sendAudioData` gated** before settings / 500 ms | No uplink despite “mic on” | `tests/send-audio-after-settings-applied-issue560.test.tsx` |
| **Worklet source drift** (two copies of processor) | Rare divergence Blob vs disk | `tests/unit/microphone-worklet-inline-sync.test.ts`; after editing worklet run **`npm run generate:mic-worklet`** |
| **Proxy resampler** vs declared session input | Append / commit errors | `tests/openai-proxy-pcm-resample.test.ts` |
| **Orphan tail below API min (100 ms @ 24 kHz)** | Pending audio never committed after `response.output_text.done` / `response.done` when `pendingAudioBytes < OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT` | `openai-proxy-integration.test.ts` — *Issue #560: commits or schedules pending audio below API min after response ends (orphan tail)* |
| **First user commit too small (~256 ms)** | Garbage first STT (`.`, `SHELX.`) | `OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT` + `openai-proxy-integration.test.ts` — *Issue #560: first input_audio_buffer.commit only after first-commit byte threshold*; **`server.ts`** `scheduleAudioCommit` uses first vs subsequent threshold |

---

## 2c. OpenAI proxy commit timing — **implemented** (mock path; qualify real API)

**Design / rationale:** [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md).

| Step | Status | Implementation |
|------|--------|----------------|
| **1** Fix B (orphan tail) | **Done** | `rearmPendingAudioCommitAfterResponse()` in **`server.ts`**: if `0 < pendingAudioBytes < OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT`, append **silence** to upstream to reach API min, then **`scheduleAudioCommit()`**. Test: *Issue #560: … orphan tail*. |
| **2** Fix A (first commit only) | **Done** | **`openai-audio-constants.ts`:** `OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT` (= 48000, ~1 s @ 24 kHz). **`server.ts`:** `hasCompletedFirstUserAudioCommit` — first commit uses first threshold, later commits use `OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT`. Test: *Issue #560: first input_audio_buffer.commit only after first-commit byte threshold*. |
| **3** Fix C (energy gate) | **Deferred** | Only if manual host-mic still bad after re-test. |

**Regression:** full mock **`openai-proxy-integration.test.ts`** green; Issue #560 filter: `npm test -- tests/integration/openai-proxy-integration.test.ts -t "Issue #560"`. **Qualification:** run **`USE_REAL_APIS=1`** subset when `OPENAI_API_KEY` is set per [.cursorrules](../../../.cursorrules).

**Manual host-mic** remains **supplemental** confirmation ([MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md)).

**E2E vs manual “mic sounds wrong” reports:** What you keep seeing manually is **upstream STT fidelity** (garbage transcripts, wrong language, etc.). That is **not** the same as what CI’s Jest rows assert (PCM math, commit scheduling, gating). **Partial E2E lock (OpenAI proxy + Live, fake mic device):** `test-app/tests/e2e/live-mode-openai-proxy-mic-uplink-issue560.spec.js` — after `waitForSettingsApplied`, asserts **GUM resolved**, **`__e2eWsBinarySendCount > 0`**, and the first binary sends have **even** byte lengths in a sane range (int16-ish). **Deepgram proxy equivalent:** `live-mode.spec.js` (Issue #561). **Still not automated:** semantic transcript correctness on **OpenAI** from **host** mic (needs real API + stable phrase / golden text or proxy log hook); keep manual reports labeled exploratory until we add that spec.

**One-shot regression sweep (from repo root):** run **both** lines (Jest `-t` applies to every file on the command line, so keep the proxy integration filter separate).

```bash
npm test -- \
  tests/unit/audio-utils-mic-pcm-issue560.test.ts \
  tests/unit/mic-pcm-proxy-chain-issue560.test.ts \
  tests/unit/microphone-worklet-inline-sync.test.ts \
  tests/openai-proxy-pcm-resample.test.ts \
  tests/send-audio-after-settings-applied-issue560.test.tsx

npm test -- tests/integration/openai-proxy-integration.test.ts -t "Issue #560"
```

---

## 3. Phase A — Inventory

- [x] **Local manual repro** — satisfied by [#561](../ISSUE-561/README.md) work (Live, proxy, mic paths); keep using that flow while isolating.
- [x] Run `cd test-app && npm run build` — **green** on `issue-560` (2026-04-05); CI failures → note in [TRACKING.md](./TRACKING.md) or PR.
- [x] **Isolation conclusion (round 1)** — call chain: [#561](../ISSUE-561/README.md), `App.tsx` / `voiceAgentStartOptions.ts` (see [CURRENT-STATUS.md](./CURRENT-STATUS.md) pointers).
- [x] **Manual backend ergonomics** — `packages/voice-agent-backend` + `.env`; OpenAI `run.ts` does not load `test-app/.env` — [ARCHITECTURE.md](../../BACKEND-PROXY/ARCHITECTURE.md).

---

## 4. Phase B — RED: failing tests

*(Prefer the smallest contract at the failing layer.)*

- [x] **Issue #560 — proxy orphan after response ends:** **`openai-proxy-integration.test.ts`** — *… orphan tail*; **Fix B** silence pad + **`scheduleAudioCommit`** (**§2c**).
- [x] **Issue #560 — first commit byte threshold:** **`openai-proxy-integration.test.ts`** — *… first-commit byte threshold*; **`OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`** + **`server.ts`** (**§2c** Fix A).
- [x] **Build:** `npm run build` sufficient when green; no extra Jest guard needed yet.
- [x] **Package (`src/`):** **`stopAudioCapture()`** on ref (pairs with **`startAudioCapture`**); Jest in **`voice-agent-api-validation.test.tsx`** + **`approved-additions.ts`** — addresses Live E2E dual-uplink (fake mic + inject), not partner-only.
- [x] **test-app integration contract:** `test-app/tests/unit/voiceAgentStartOptions.test.ts` + `voiceAgentStartOptions.ts` (OpenAI proxy vs Deepgram `start()` flags for mic/Live + **text-input focus** on `App.tsx`).
- [x] **test-app Agent Response / greeting rule:** `test-app/tests/unit/agentUtteranceGreetingPolicy.test.ts` + `agentUtteranceGreetingPolicy.ts` (Issue #414 suppression predicate; avoids mistaking debug readout for uplink bugs).
- [x] **E2E transcript + assistant shape:** `waitForUserSpeechTranscriptSignal` + `assertMinimalAgentReplyShape` in `test-app/tests/e2e/helpers/test-helpers.js`; used by `openai-proxy-e2e.spec.js` (test 5) and `live-mode-openai-proxy.spec.js`. **`waitForUserSpeechTranscriptSignal`** also aggregates **`window.__e2eTranscriptEvents`** so OpenAI-proxy user STT is visible when Live hides the debug transcript `<pre>` (still requires real upstream transcript).
- [x] **Remove redundant user-message panel:** `SELECTORS.conversationUserRow` + `deepgram-ux-protocol.spec.js` step 6 (conversation history); dropped `data-testid="user-message"` from test-app layout.
- [x] **Issue #560 root-cause locks (package + proxy chain):** **`mic-pcm-proxy-chain-issue560.test.ts`** — 48 k → 16 k duration, **no-downsample ≈3×** byte ratio vs correct path, **16→24 k** resampler expansion; see **§2b** table.

---

## 5. Phase C — GREEN: fixes

- [x] **Refactor / lock:** `App.tsx` `startServicesAndMicrophone` uses `getVoiceAgentStartOptions` (tests green).
- [x] **Text-input focus:** `App.tsx` text `onFocus` `start()` uses `getVoiceAgentStartOptions(proxyEndpoint)` (not hardcoded `transcription: false` for all modes).
- [x] **OpenAI proxy:** **`onResponseEnded`** reschedules **`scheduleAudioCommit`** when pending PCM ≥ min commit bytes (Issue #560 append-only tail / stuck second commit) — Jest **`openai-proxy-integration`** Issue #560 case.
- [x] **OpenAI proxy — commit timing (§2c):** **Fix B** + **Fix A** (first-commit-only `OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`) in **`server.ts`** / **`openai-audio-constants.ts`** — see [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md).
- [ ] **Partner-visible fix** — **re-run manual host-mic** ([MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md)) after deploy; bogus STT may persist for **upstream/model** reasons per proposal **“What this does NOT fix.”**
- [x] **Mic PCM + worklet tests** — **`audio-utils-mic-pcm-issue560.test.ts`**, **`microphone-worklet-inline-sync.test.ts`**; **`CLIENT_MIC_PCM_FOR_OPENAI_PROXY_HZ`** + **`generate:mic-worklet`**.
- [x] Ran `test-app` tests + build for this slice (`npm test -- voiceAgentStartOptions.test.ts`, `npm run build`).
- [x] Ran `npm test -- agentUtteranceGreetingPolicy.test.ts` for greeting / Agent Response policy slice.
- [x] **Live OpenAI E2E mock path:** `live-mode-openai-proxy.spec.js` green with **`stopAudioCapture`** + **`e2eIdleTimeoutMs`**; **`test-app/tests/e2eIdleTimeoutMs.test.ts`** for URL idle resolution.
- [x] **OpenAI proxy mock Issue #487:** `openai-proxy-integration.test.ts` — post-FCR assistant signals may arrive after 2s (e.g. **`AgentAudioDone`**); 10s deadline from FCR; **`AgentStartedSpeaking`**; optional 2s observability log.
- [x] **Issue #489 real-API (subset):** same file — **`toolChoice: 'required'`** + prompt forcing **`get_current_time`** so the model does not answer conversationally without **`FunctionCallRequest`**; observations in [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md).
- [x] **E2E skip policy:** OpenAI key not required in Playwright env for **`skipIfNoProxyForBackend`**; **`e2e-skip-env-policy.cjs`** + **`openai-proxy-e2e-skip-policy.test.js`**.
- [x] **test-app backend:** **`GET /health`** / **`GET /ready`**; **`backend-server-integration.test.js`** + **`backend-server-test-utils.cjs`** (rename from mock-proxy integration).
- [x] **Playwright real-API E2E qualification:** **`USE_REAL_APIS=1`** OpenAI proxy + Live specs green; **`playwright-workers-from-env.cjs`** + **`playwright-workers-from-env.test.js`** (**`workers: 1`** when **`USE_REAL_APIS=1`** to avoid cross-spec backend contention / flaky 6b).

---

## 6. Phase D — REFACTOR

- [x] **Mic worklet DRY** — single **`AudioWorkletProcessor.js`**; **`microphone-worklet-inline.generated.ts`** + **`npm run generate:mic-worklet`** (inline sync test).
- [ ] Dedupe only **within the layer that owns the bug**; keep tests green; avoid moving logic across package/app boundary without a clear API reason.

---

## 7. Commands (reference)

```bash
cd test-app && npm run build
cd test-app && npm test
cd test-app && npm run test:e2e -- <spec>.spec.js   # targeted E2E
```

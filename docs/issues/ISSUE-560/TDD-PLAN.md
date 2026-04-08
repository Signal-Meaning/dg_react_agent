# TDD Plan: Issue #560 — Mic regression repro + test-app build

**Issue:** [#560 — Backlog: voice-commerce mic activation regression; test-app build](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Principle:** **Red → Green → Refactor.** Tests first where they define behavior; minimal implementation to go green. The headless `@signal-meaning/voice-agent-react` package must stay compatible with the [Voice Agent API](https://developers.deepgram.com/docs/voice-agent). Prefer **npm scripts** from `test-app` per [.cursorrules](../../../.cursorrules).

**Process note (2026-04):** Larger UI refactors (voice provider toggle, removing duplicate panels) should still follow **tests-first for anything an E2E or unit test can lock**—e.g. update `SELECTORS` / specs **before** removing `data-testid` nodes; add or extend Jest **before** changing `getConversationHistory` behavior. Retroactive doc/test alignment is recorded in Phase B/C checkboxes below.

**Recovery (new chat):** Read [CURRENT-STATUS.md](./CURRENT-STATUS.md), [NEXT-STEP.md](./NEXT-STEP.md), this file, [README.md](./README.md). **Repro:** manual steps live under [#561](../ISSUE-561/README.md); **#560** is isolation + fix in the **correct layer**.

---

## Checkbox legend

- `[ ]` — Not done.
- `[x]` — Done (tests green; update this doc when complete).

---

## 1. Goals

| Goal | Notes |
|------|--------|
| **G1** | **Isolate** mic-related failure: **`@signal-meaning/voice-agent-react`** (`src/`) vs **test-app** integration. Manual repro already exists from [#561](../ISSUE-561/README.md). |
| **G2** | Add or extend **tests** at the **layer that owns the bug** (package `tests/` vs `test-app/tests/`) so the regression cannot return silently. |
| **G3** | Fix **`test-app` `npm run build`** / **`tsc -b`** until clean (may proceed in parallel). |

---

## 2. Constraints

- Do **not** weaken partner-reported scenarios: see [#462](../ISSUE-462/README.md) for voice-commerce lessons.
- **Mic / `start()` semantics** overlap [Issue #561](../ISSUE-561/README.md) Live work — **#561** carried manual repro and UI policy; **#560** decides if the remaining partner gap is **deliverable** code. Cross-link PRs and update both CURRENT-STATUS files if work splits across issues.
- E2E that need real APIs: follow repo rules (proxy, keys, `test-app` as cwd).

---

## 3. Phase A — Inventory

- [x] **Local manual repro** — satisfied by [#561](../ISSUE-561/README.md) work (Live, proxy, mic paths); keep using that flow while isolating.
- [x] Run `cd test-app && npm run build` — **green** on `issue-560` (2026-04-05); failures (if any in CI) go in [CURRENT-STATUS.md](./CURRENT-STATUS.md).
- [x] **Isolation conclusion (round 1)** — call chain + boundary in [CURRENT-STATUS.md](./CURRENT-STATUS.md) §Isolation trace.
- [x] **Manual backend ergonomics** — `packages/voice-agent-backend`: `npm run start` = combined proxy; secrets in package `.env`; OpenAI `run.ts` dotenv no longer pulls `test-app/.env` (see CURRENT-STATUS §Manual testing).

---

## 4. Phase B — RED: failing tests

*(Prefer the smallest contract at the failing layer.)*

- [x] **Build:** `npm run build` sufficient when green; no extra Jest guard needed yet.
- [x] **Package (`src/`):** **`stopAudioCapture()`** on ref (pairs with **`startAudioCapture`**); Jest in **`voice-agent-api-validation.test.tsx`** + **`approved-additions.ts`** — addresses Live E2E dual-uplink (fake mic + inject), not partner-only.
- [x] **test-app integration contract:** `test-app/tests/unit/voiceAgentStartOptions.test.ts` + `voiceAgentStartOptions.ts` (OpenAI proxy vs Deepgram `start()` flags for mic/Live + **text-input focus** on `App.tsx`).
- [x] **test-app Agent Response / greeting rule:** `test-app/tests/unit/agentUtteranceGreetingPolicy.test.ts` + `agentUtteranceGreetingPolicy.ts` (Issue #414 suppression predicate; avoids mistaking debug readout for uplink bugs).
- [x] **E2E transcript + assistant shape:** `waitForUserSpeechTranscriptSignal` + `assertMinimalAgentReplyShape` in `test-app/tests/e2e/helpers/test-helpers.js`; used by `openai-proxy-e2e.spec.js` (test 5) and `live-mode-openai-proxy.spec.js`. **`waitForUserSpeechTranscriptSignal`** also aggregates **`window.__e2eTranscriptEvents`** so OpenAI-proxy user STT is visible when Live hides the debug transcript `<pre>` (still requires real upstream transcript).
- [x] **Remove redundant user-message panel:** `SELECTORS.conversationUserRow` + `deepgram-ux-protocol.spec.js` step 6 (conversation history); dropped `data-testid="user-message"` from test-app layout.

---

## 5. Phase C — GREEN: fixes

- [x] **Refactor / lock:** `App.tsx` `startServicesAndMicrophone` uses `getVoiceAgentStartOptions` (tests green).
- [x] **Text-input focus:** `App.tsx` text `onFocus` `start()` uses `getVoiceAgentStartOptions(proxyEndpoint)` (not hardcoded `transcription: false` for all modes).
- [ ] **Partner-visible fix** — pending parity check; may be **`src/`** or **docs for integrators** once root cause is confirmed.
- [x] Ran `test-app` tests + build for this slice (`npm test -- voiceAgentStartOptions.test.ts`, `npm run build`).
- [x] Ran `npm test -- agentUtteranceGreetingPolicy.test.ts` for greeting / Agent Response policy slice.
- [x] **Live OpenAI E2E mock path:** `live-mode-openai-proxy.spec.js` green with **`stopAudioCapture`** + **`e2eIdleTimeoutMs`**; **`test-app/tests/e2eIdleTimeoutMs.test.ts`** for URL idle resolution.
- [x] **OpenAI proxy mock Issue #487:** `openai-proxy-integration.test.ts` — post-FCR assistant signals may arrive after 2s (e.g. **`AgentAudioDone`**); 10s deadline from FCR; **`AgentStartedSpeaking`**; optional 2s observability log.
- [x] **Issue #489 real-API (subset):** same file — **`toolChoice: 'required'`** + prompt forcing **`get_current_time`** so the model does not answer conversationally without **`FunctionCallRequest`**; observations in [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md).

---

## 6. Phase D — REFACTOR

- [ ] Dedupe only **within the layer that owns the bug**; keep tests green; avoid moving logic across package/app boundary without a clear API reason.

---

## 7. Commands (reference)

```bash
cd test-app && npm run build
cd test-app && npm test
cd test-app && npm run test:e2e -- <spec>.spec.js   # targeted E2E
```

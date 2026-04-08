# Issue #560 — tracking

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Living docs:** [CURRENT-STATUS.md](./CURRENT-STATUS.md) · [NEXT-STEP.md](./NEXT-STEP.md)

| Item | Status |
|------|--------|
| Branch `issue-560` | Created from `issue-561` |
| Local manual repro (test-app / Live / proxy paths) | **Done** — via [#561](../ISSUE-561/README.md) |
| **Isolation trace (round 1)** | **Done** — [CURRENT-STATUS.md](./CURRENT-STATUS.md) §Isolation trace |
| `test-app` `npm run build` / `tsc -b` | **Green** locally (2026-04-05); record CI failures in CURRENT-STATUS if any |
| Unit lock: `getVoiceAgentStartOptions` | **Done** — `test-app/tests/unit/voiceAgentStartOptions.test.ts` |
| Backend: package `.env` + `npm run start`; OpenAI `run.ts` skips `test-app/.env` | **Done** — [CURRENT-STATUS.md](./CURRENT-STATUS.md) §Manual testing |
| Code trace: E2E `sendAudioData` vs mic → same `sendAudioData` (round 2) | **Done** — [CURRENT-STATUS.md](./CURRENT-STATUS.md) §Uplink parity |
| Unit lock: `agentUtteranceGreetingPolicy` (Issue #414 / Agent Response readout) | **Done** — `test-app/tests/unit/agentUtteranceGreetingPolicy.test.ts` |
| Text-input focus uses `getVoiceAgentStartOptions` (align with mic/Live) | **Done** — `App.tsx` + `voiceAgentStartOptions.test.ts` |
| Live OpenAI E2E isolation + mock-path green | **Done** — [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md); **`stopAudioCapture`** before inject + **`e2eIdleTimeoutMs`**; `live-mode-openai-proxy.spec.js` passes with mock/proxy |
| Package: **`stopAudioCapture`** ref API (Issue #560) | **Done** — `DeepgramVoiceInteraction` + types + API docs + Jest validation |
| test-app: **`e2eIdleTimeoutMs`** URL idle override | **Done** — `e2eIdleTimeoutMs.ts` + `App.tsx` + unit test |
| Real-API re-qualify (OpenAI proxy E2E + Live, `USE_REAL_APIS=1`) | **Done (2026-04-04)** — `openai-proxy-e2e.spec.js` + `live-mode-openai-proxy.spec.js`: 18 passed, 2 skipped; **`playwright-workers-from-env.cjs`** forces serial workers for real-API runs — [NEXT-STEP.md](./NEXT-STEP.md); [#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) still deferred for Deepgram |
| Manual mic + OpenAI proxy (host audio) | **Failing (2026-04-08)** — debug log analysis: [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) (`backend-20260408-111420.log`) |
| `USE_REAL_APIS=1` **`openai-proxy-integration.test.ts`** | **Green (2026-04-08)** — 20 executed, all passed ~73s (mock-only tests skipped when `USE_REAL_APIS=1`). **Issue #489** path uses **`toolChoice: 'required'`** + prompt; [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md). CI still runs mock-only cases without real APIs. |
| E2E skip: OpenAI key backend-only + **`e2e-skip-env-policy.cjs`** | **Done** — **`test-helpers.js`** delegates; Jest **`openai-proxy-e2e-skip-policy.test.js`** |
| Backend **`/health`** + **`/ready`** + integration rename | **Done** — **`backend-server.js`**; **`backend-server-integration.test.js`** + **`tests/helpers/backend-server-test-utils.cjs`** (replaces **`mock-proxy-server-integration`**) |
| Fix merged / issue closed on GitHub | Not started |

Notes: After each slice, edit **CURRENT-STATUS**, **NEXT-STEP**, and checkboxes in **TDD-PLAN**.

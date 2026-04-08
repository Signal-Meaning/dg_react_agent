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
| Real-API re-qualify (OpenAI proxy E2E test 5 + Live, `USE_REAL_APIS=1`) | **Next** — [NEXT-STEP.md](./NEXT-STEP.md); [#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) still deferred for Deepgram |
| `USE_REAL_APIS=1` **`openai-proxy-integration.test.ts`** | **Green (2026-04-08)** — 20 executed, all passed ~73s (mock-only tests skipped when `USE_REAL_APIS=1`). **Issue #489** path uses **`toolChoice: 'required'`** + prompt; [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md). CI still runs mock-only cases without real APIs. |
| Fix merged / issue closed on GitHub | Not started |

Notes: After each slice, edit **CURRENT-STATUS**, **NEXT-STEP**, and checkboxes in **TDD-PLAN**.

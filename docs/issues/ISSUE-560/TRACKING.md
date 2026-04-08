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
| Live OpenAI E2E isolation (test shape vs test 5, PCM assert, 650ms gate) | **Done** — [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md); transcript step still red in agent run — next: proxy debug logs |
| Internal: manual confirmation + sharper tests (no voice-commerce until concrete ask) | **Next** — [NEXT-STEP.md](./NEXT-STEP.md); Deepgram manual blocked by [#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) until key renewed |
| Fix merged / issue closed on GitHub | Not started |

Notes: After each slice, edit **CURRENT-STATUS**, **NEXT-STEP**, and checkboxes in **TDD-PLAN**.

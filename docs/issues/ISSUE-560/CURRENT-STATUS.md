# Issue #560 — current status

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent) · **Branch:** `issue-560` · **Next:** [NEXT-STEP.md](./NEXT-STEP.md)

---

## Snapshot

- **Package:** Mic uplink is **16 kHz** int16 before the agent socket (`prepareMicPcmForAgent`, `mic-audio-contract.ts`); worklet is **single source** → `npm run generate:mic-worklet` + `microphone-worklet-inline-sync.test.ts`.
- **Proxy:** Second-commit path rescheduled after response ends (`onResponseEnded` → `scheduleAudioCommit`); covered in `openai-proxy-integration.test.ts` (Issue #560 case).
- **Automated:** §2b Jest locks in [TDD-PLAN.md](./TDD-PLAN.md); OpenAI Live inject path in `live-mode-openai-proxy.spec.js`; **mic → binary socket** (fake device) in `live-mode-openai-proxy-mic-uplink-issue560.spec.js`. **Not** locked: **semantic STT** from a **real** mic (manual / future real-API transcript spec).
- **Manual gap:** Latest logged repro still showed bad upstream STT after pipeline fixes — see [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md).

---

## Where to read more

| Topic | Doc / code |
|--------|------------|
| Root cause → tests | [TDD-PLAN.md](./TDD-PLAN.md) §2b |
| Live E2E, dual uplink, idle timeout | [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) |
| `start()` / `startAudioCapture` contract | `test-app/src/live-mode/voiceAgentStartOptions.ts`, `voiceAgentStartOptions.test.ts` |
| Call chain (App → ref) | [Issue #561](../ISSUE-561/README.md), `App.tsx` / `LiveModeView.tsx` |
| Backend env, `/health`, `/ready` | `packages/voice-agent-backend`, [ARCHITECTURE.md](../../BACKEND-PROXY/ARCHITECTURE.md) |
| OpenAI component API (transcription flag) | [Issue #414 COMPONENT-PROXY-INTERFACE-TDD](../ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md) |

# Issue #560 — current status

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent) · **Branch:** `issue-560` · **Handoff:** [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) · **Next:** [NEXT-STEP.md](./NEXT-STEP.md)

---

## Snapshot

- **Package:** Mic uplink is **16 kHz** int16 before the agent socket (`prepareMicPcmForAgent`, `mic-audio-contract.ts`); worklet is **single source** → `npm run generate:mic-worklet` + `microphone-worklet-inline-sync.test.ts`.
- **Proxy:** **§2c commit timing** — first user commit waits on **`OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`** (~1 s @ 24 kHz); subsequent commits use 100 ms min; **orphan** tail (pending below API min after response ends) → **silence pad** + `scheduleAudioCommit`. [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md); tests: `openai-proxy-integration.test.ts` `-t "Issue #560"`. Earlier: second-commit reschedule when pending ≥ min.
- **Proxy audit + schedule (2026-04-08):** [COMMIT-SCHEDULER-TDD-PLAN.md](./COMMIT-SCHEDULER-TDD-PLAN.md) **Phase 0** (**§4** table: **P0–P2** per row). **Execution:** **§9** line-item checkboxes; rollup also [TDD-PLAN.md](./TDD-PLAN.md) **§2d**. **P0:** null-VAD scheduler + close flush; Server VAD migration. **P1:** real-API qualification, chunk telemetry, docs. **P2:** **`input_audio_buffer.clear`**, 15 MiB append (or waivers).
- **Automated:** §2b Jest locks in [TDD-PLAN.md](./TDD-PLAN.md); OpenAI Live inject path in `live-mode-openai-proxy.spec.js`; **mic → binary socket** (fake device) in `live-mode-openai-proxy-mic-uplink-issue560.spec.js`. **Real API (2026-04-04):** `USE_REAL_APIS=1` `openai-proxy-integration.test.ts` — **20 passed** (mock-only tests, including Issue #560, skipped). **Not** locked: **semantic STT** from a **real** mic (manual / future real-API transcript spec).
- **Manual gap:** Re-run host-mic after **§2c** proxy deploy; steps: [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md). Prior log/analysis: [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md). **2026-04-04** retest (pre-§2c): same observables — update [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md) retest table after next human run.

---

## Where to read more

| Topic | Doc / code |
|--------|------------|
| Next agent / investigation brief | [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) |
| Root cause → tests | [TDD-PLAN.md](./TDD-PLAN.md) §2b / **§2c** |
| Commit timing (first commit + orphan tail) | [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md) |
| Live E2E, dual uplink, idle timeout | [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) |
| `start()` / `startAudioCapture` contract | `test-app/src/live-mode/voiceAgentStartOptions.ts`, `voiceAgentStartOptions.test.ts` |
| Call chain (App → ref) | [Issue #561](../ISSUE-561/README.md), `App.tsx` / `LiveModeView.tsx` |
| Host mic repro (step-by-step) | [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md) |
| Backend env, `/health`, `/ready` | `packages/voice-agent-backend`, [ARCHITECTURE.md](../../BACKEND-PROXY/ARCHITECTURE.md) |
| OpenAI component API (transcription flag) | [Issue #414 COMPONENT-PROXY-INTERFACE-TDD](../ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md) |

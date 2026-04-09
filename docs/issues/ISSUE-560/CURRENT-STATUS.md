# Issue #560 — current status

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560) — **closed 2026-04-08** · **Handoff:** [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) · **Next:** [NEXT-STEP.md](./NEXT-STEP.md)

---

## Snapshot

**Closure:** In-repo work for mic path, OpenAI proxy commit behavior, and test-app **`npm run build`** is **merged to `main`**. Follow-ups that stay open elsewhere: **OTel** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565); **spoken STT** on a real host mic remains **manual** (see [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md)).

- **Package:** Mic uplink is **16 kHz** int16 before the agent socket (`prepareMicPcmForAgent`, `mic-audio-contract.ts`); worklet is **single source** → `npm run generate:mic-worklet` + `microphone-worklet-inline-sync.test.ts`.
- **Proxy:** **§2c commit timing** — first user commit waits on **`OPENAI_MIN_AUDIO_BYTES_FOR_FIRST_COMMIT`** (~1 s @ 24 kHz); subsequent commits use 100 ms min; **orphan** tail (pending below API min after response ends) → **silence pad** + `scheduleAudioCommit`. [COMMIT-TIMING-PROPOSAL.md](./COMMIT-TIMING-PROPOSAL.md); tests: `openai-proxy-integration.test.ts` `-t "Issue #560"`. Earlier: second-commit reschedule when pending ≥ min.
- **Proxy audit + schedule:** [COMMIT-SCHEDULER-TDD-PLAN.md](./COMMIT-SCHEDULER-TDD-PLAN.md) **§4** / **§9**; [TDD-PLAN.md](./TDD-PLAN.md) **§2d** / **§2b**. **Phase 2 GREEN (2026-04-04):** max coalesce + client-close flush (manual-commit / null-VAD mocks). **Phase 2b (2026-04-04) + product default (2026-04):** **`mapSettingsToSessionUpdate`** defaults to OpenAI **`server_vad`** + mic **append-only** (no proxy **`commit`**); **`useOpenAIManualAudioCommit`** only for Jest. Upstream **`response.created`** sets **`responseInProgress`** when we did not send **`response.create`**. Mock: full **`openai-proxy-integration.test.ts`** green **`--runInBand --forceExit`**; *Issue #414* ordering test clears **`mockReceived`** on **`open`**. **Optional later:** **`USE_REAL_APIS=1`** VAD-path spot checks; Phase **3** doc sweep in [COMMIT-SCHEDULER-TDD-PLAN.md](./COMMIT-SCHEDULER-TDD-PLAN.md) §7.
- **Automated:** §2b Jest locks in [TDD-PLAN.md](./TDD-PLAN.md); OpenAI Live inject path in `live-mode-openai-proxy.spec.js`; **mic → binary socket** (fake device) in `live-mode-openai-proxy-mic-uplink-issue560.spec.js`. **Real API (2026-04-04):** `USE_REAL_APIS=1` `openai-proxy-integration.test.ts` — **20 passed** (mock-only tests, including Issue #560, skipped). **Not** locked: **semantic STT** from a **real** mic (manual / future real-API transcript spec).
- **Manual gap (optional):** Host-mic spoken STT — [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md). Prior log/analysis: [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md). Update the repro **retest** table when someone reruns after **§2c** + default Server VAD on **`main`**.

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

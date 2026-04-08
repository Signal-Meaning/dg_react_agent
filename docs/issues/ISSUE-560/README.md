# Issue #560 — Backlog: voice-commerce mic regression + test-app build

**GitHub:** [#560 — Backlog: voice-commerce mic activation regression — repro in test-app; test-app build (tsc) failures](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Labels:** bug, audio, voice-agent, testing, priority: medium

**Branch:** `issue-560` (work here; merge via PR when ready)

---

## What this issue is

Track **partner-reported microphone activation regression** (voice-commerce), **test-app `npm run build` / `tsc -b` failures**, and—now that **local manual repro** exists from [Issue #561](../ISSUE-561/README.md)—**where the defect actually lives**.

**Current focus:** **Isolate the defect in our deliverable** (`@signal-meaning/voice-agent-react`, repo `src/`) versus **test-app–only** wiring, UI, or env. Repro steps and Live/proxy context live with #561; #560 is the place to decide “package bug vs integration bug” and fix or qualify accordingly.

Use the **GitHub issue** for checkboxes and discussion; use this folder for stable repo-local notes, TDD plans, and command snippets as work proceeds.

---

## Local docs

| Doc | Purpose |
|-----|---------|
| [CURRENT-STATUS.md](./CURRENT-STATUS.md) | Short snapshot + pointers. **Update after each slice.** |
| [NEXT-STEP.md](./NEXT-STEP.md) | Next actions only. **Update after each slice.** |
| [TDD-PLAN.md](./TDD-PLAN.md) | TDD phases: inventory, RED/GREEN at **correct layer**, `tsc`/build. |
| [TRACKING.md](./TRACKING.md) | Checklist and status while implementing. |
| [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md) | Real-API **`AgentAudioDone`** after function-call integration test + **`LOG_LEVEL=debug`** notes. |
| [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md) | Host mic manual repro vs Playwright: bogus STT (**`.`**), **append** without further **commit**, UI transcript mismatch. |

**Code artifacts (test-app contracts):** `voiceAgentStartOptions.ts` — maps `proxyEndpoint` to `start()` options for mic / Live (`voiceAgentStartOptions.test.ts`). **`agentUtteranceGreetingPolicy.ts`** — Issue #414 Agent Response readout (`agentUtteranceGreetingPolicy.test.ts`). **`e2eIdleTimeoutMs.ts`** — URL override for agent idle in E2E vs short global `VITE_IDLE_TIMEOUT_MS`. **Package ref `stopAudioCapture()`** — stops mic without closing the agent socket (Live E2E: stop fake mic before **`sendAudioData`** inject). **`e2e-skip-env-policy.cjs`** — single source for “real vs placeholder” API keys in Playwright skip logic (used by **`test-helpers.js`**). **`playwright-workers-from-env.cjs`** — **`workers: 1`** when **`USE_REAL_APIS=1`** or **`CI`** (real-API E2E + Live qualification; Jest **`playwright-workers-from-env.test.js`**). **`backend-server-integration.test.js`** + **`backend-server-test-utils.cjs`** — spawn **`backend-server.js`**, assert **`/health`** / **`/ready`**.

**Local combined proxy (Deepgram + OpenAI + `/function-call`):** from `packages/voice-agent-backend`, run **`npm run start`** (or `npm run backend`); API keys in **`packages/voice-agent-backend/.env`** — [ARCHITECTURE.md](../../BACKEND-PROXY/ARCHITECTURE.md).

---

## Related references

- [Issue #544](../ISSUE-544/README.md) — user-initiated `start()`, idle timeout, E2E context.
- [Issue #462](../ISSUE-462/README.md) — voice-commerce process lessons (partner scenarios).
- [Issue #561](../ISSUE-561/README.md) — Live mode UI and **local manual repro** paths; #560 isolates whether remaining gap is the **package** vs **test-app**.

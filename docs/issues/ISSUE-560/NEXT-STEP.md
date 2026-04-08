# Issue #560 — next step

**Last updated:** 2026-04-04 (**OpenAI proxy real-API Playwright qualification done:** **`USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js live-mode-openai-proxy.spec.js`** — 18 passed, 2 skipped; config forces **`workers: 1`** via **`playwright-workers-from-env.cjs`** so Live + OpenAI files do not contend on the shared backend. [ISSUE-489-INTEGRATION-OBSERVATIONS.md](./ISSUE-489-INTEGRATION-OBSERVATIONS.md).)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

> After each meaningful slice, update **this file** and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)**.

---

## Partner / voice-commerce

**Do not** pull in the voice-commerce team until there is **something specific** we need from them (e.g. a protocol detail only they can confirm, or a joint retest after we ship a fix). Right now the defect is **reproducible in-repo** (test-app, mic / Live, proxy); we have **our own failures** to fix and qualify first.

**Live OpenAI E2E isolation:** [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) — includes **`settingsSentTimeRef`** clear, **`stopAudioCapture`** before inject (dual uplink: fake mic + **`sendAudioData`**), **`e2eIdleTimeoutMs`**, **`waitForFinalUserTranscriptNormalized`**, distinctive sample. If real-API transcript fails with PCM OK, use **§D** + proxy debug (not only the pre-fix hypothesis).

---

## Immediate next step (do this first)

Context: [CURRENT-STATUS.md](./CURRENT-STATUS.md).

| # | Item | Human-only? |
|---|------|-------------|
| ~~1~~ | ~~**Re-qualify OpenAI proxy (real APIs):** (a) Root **`USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`** — done 2026-04-08 (20 passed). (b) **`test-app`**: **`USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js live-mode-openai-proxy.spec.js`** — **done 2026-04-04** (18 passed, 2 skipped; Playwright starts dev + backend unless **`E2E_USE_EXISTING_SERVER=1`**). **`OPENAI_API_KEY`** only in **`packages/voice-agent-backend/.env`**. Optional **`curl http://127.0.0.1:8080/ready`**.~~ | ~~**Partial**~~ |
| 1 | **If transcript still fails** with PCM delta passing (real API): use isolation doc **§D** and proxy logs (`append` / `commit` / transcription events). | **Partial** |
| 2 | **[#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) (Deepgram key):** **Deferred** until **#560 is resolved** — do not block #560 on renewal; re-run Deepgram E2E after #560 close + key refresh. | **No** (ops) |
| ~~4~~ | ~~Text-input focus~~ — **Done:** `getVoiceAgentStartOptions` in `App.tsx`; tests in `voiceAgentStartOptions.test.ts`. | **No** |
| ~~5~~ | ~~500 ms gate after SettingsApplied~~ — **Done:** `settingsSentTimeRef` cleared on confirmation; Jest `send-audio-after-settings-applied-issue560.test.tsx`. | **No** |

---

## Proposed next (after OpenAI real-API E2E is green or narrowed)

1. **CI / merge:** Ensure Playwright OpenAI slice (or full suite per project policy) runs on a branch with real-API qualification noted in PR.
2. **Deepgram VAD / interim specs:** Re-run after **#560** is done and **#564** is addressed (key renewal), not before.
3. **Optional:** Add a short PR note linking **Issue #560** + isolation doc so reviewers know E2E expectations changed (strict transcript phrase, no `hello` regex).

---

## When you finish a step

1. Check boxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md).
3. Replace the **Immediate next step** table above.

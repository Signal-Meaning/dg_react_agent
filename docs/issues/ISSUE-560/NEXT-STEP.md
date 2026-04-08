# Issue #560 — next step

**Last updated:** 2026-04-06 (package PCM gate fix + E2E alignment committed; **re-qualify** OpenAI proxy E2E next)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

> After each meaningful slice, update **this file** and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)**.

---

## Partner / voice-commerce

**Do not** pull in the voice-commerce team until there is **something specific** we need from them (e.g. a protocol detail only they can confirm, or a joint retest after we ship a fix). Right now the defect is **reproducible in-repo** (test-app, mic / Live, proxy); we have **our own failures** to fix and qualify first.

**Live OpenAI E2E isolation:** [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) — updated for **`settingsSentTimeRef`** clear on **`SettingsApplied` / `session.created`**, **no** arbitrary post-settings sleep for that gate, **`waitForFinalUserTranscriptNormalized`**, and distinctive-phrase audio. **Prior** observation (PCM delta OK, transcript empty) was **before** that package fix — **re-run** specs and, if needed, **`LOG_LEVEL=debug`** on the proxy to confirm append/commit and `input_audio_transcription`.

---

## Immediate next step (do this first)

Context: [CURRENT-STATUS.md](./CURRENT-STATUS.md).

| # | Item | Human-only? |
|---|------|-------------|
| 1 | **Re-qualify OpenAI proxy E2E (real APIs):** From `test-app`, run **`npm run test:e2e -- openai-proxy-e2e.spec.js`** (at least test 5) and **`live-mode-openai-proxy.spec.js`** with dev + backend and valid keys. Confirms the **settings-time clear** + strict transcript waiter + Live flow. | **Partial** (keys / servers) |
| 2 | **If transcript still fails** with PCM delta passing: use isolation doc **§D** and proxy logs (`append` / `commit` / transcription events). | **Partial** |
| 3 | **Deepgram:** Renew key per [#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) before relying on Deepgram proxy or direct-Deepgram E2E. | **No** (ops) |
| ~~4~~ | ~~Text-input focus~~ — **Done:** `getVoiceAgentStartOptions` in `App.tsx`; tests in `voiceAgentStartOptions.test.ts`. | **No** |
| ~~5~~ | ~~500 ms gate after SettingsApplied~~ — **Done:** `settingsSentTimeRef` cleared on confirmation; Jest `send-audio-after-settings-applied-issue560.test.tsx`. | **No** |

---

## Proposed next (after step 1 is green or narrowed)

1. **CI / merge:** Ensure Playwright OpenAI slice (or full suite per project policy) runs on a branch with real-API qualification noted in PR.
2. **Deepgram VAD / interim specs:** Already aligned on **`__e2eTranscriptEvents`** and shared setup helpers; watch for flake when [#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564) is resolved and re-run **`deepgram-interim-transcript-validation.spec.js`** / **`deepgram-vad-transcript-analysis.spec.js`**.
3. **Optional:** Add a short PR note linking **Issue #560** + isolation doc so reviewers know E2E expectations changed (strict transcript phrase, no `hello` regex).

---

## When you finish a step

1. Check boxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md).
3. Replace the **Immediate next step** table above.

# Issue #560 — next step

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent)

**Policy:** Do not loop in voice-commerce until we need something only they can provide. Repro and fixes stay in-repo first.

**Detail elsewhere:** [CURRENT-STATUS.md](./CURRENT-STATUS.md) (snapshot), [TDD-PLAN.md](./TDD-PLAN.md) (phases, test mapping), [TRACKING.md](./TRACKING.md), [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) (Live + inject vs mic).

---

## Do this next

**Step tags:** Every numbered step must show **`(human)`** if it needs manual work (real mic, browser, vendor console, secrets you paste) or **`(agent)`** if an autonomous agent can do it end-to-end (edit repo, run scripted tests/builds, no live audio). Use **both** inline when one step mixes both (e.g. you renew a key, then the agent runs E2E).

1. **(human)** **Manual host mic (OpenAI proxy):** Rebuild test-app after `src/` mic changes; run backend with debug logs; confirm **second+** `input_audio_buffer.commit` on a long utterance; compare STT to baseline in [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md). Edit **`AudioWorkletProcessor.js`** only with **`npm run generate:mic-worklet`**.
2. **(human)** **[#564](https://github.com/Signal-Meaning/dg_react_agent/issues/564):** Deepgram key — deferred until #560 is closed; then refresh key in the provider. **(agent)** Re-run Deepgram E2E after the new key is in env (e.g. `cd test-app && npm run test:e2e:deepgram` per project docs).

---

## After a slice ships

Update [TDD-PLAN.md](./TDD-PLAN.md) / [TRACKING.md](./TRACKING.md); refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md). **OTel follow-up:** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565).

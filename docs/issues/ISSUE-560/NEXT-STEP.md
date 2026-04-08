# Issue #560 — next step

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent)

**Policy:** Do not loop in voice-commerce until we need something only they can provide. Repro and fixes stay in-repo first.

**Detail elsewhere:** [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) (next investigator), [CURRENT-STATUS.md](./CURRENT-STATUS.md) (snapshot), [TDD-PLAN.md](./TDD-PLAN.md) (phases, test mapping), [TRACKING.md](./TRACKING.md), [LIVE-MODE-OPENAI-E2E-ISOLATION.md](./LIVE-MODE-OPENAI-E2E-ISOLATION.md) (Live + inject vs mic).

---

## Do this next

**Step tags:** Every numbered step must show **`(human)`** if it needs manual work (real mic, browser, vendor console, secrets you paste) or **`(agent)`** if an autonomous agent can do it end-to-end (edit repo, run scripted tests/builds, no live audio). Use **both** inline when one step mixes both (e.g. you renew a key, then the agent runs E2E).

1. **(human)** **Manual host mic (OpenAI proxy):** After pulling **§2c** proxy changes, follow [MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md](./MANUAL-REPRO-HOST-MIC-OPENAI-PROXY.md). Expect first `input_audio_buffer.commit` with **≥ ~48k** pending bytes @ 24 kHz in debug logs; compare STT to [MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md](./MANUAL-MIC-OPENAI-PROXY-REPORT-2026-04-08.md). Update the repro doc **retest** table.
2. ~~**(agent)** **`USE_REAL_APIS=1`** — `npm test -- tests/integration/openai-proxy-integration.test.ts` (with `OPENAI_API_KEY`)~~ **Done (2026-04-04):** 20 passed; Issue #560 cases remain mock-only (skipped under real API).

---

## After a slice ships

Update [TDD-PLAN.md](./TDD-PLAN.md) / [TRACKING.md](./TRACKING.md); refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md). **OTel follow-up:** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565).

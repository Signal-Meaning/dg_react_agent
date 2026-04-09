# Issue #561 — Refactor: Start → Live mode (voice-first UI)

**Status:** **Closed (2026-04-09)** — Live entry, full-screen Live UX, conversation history, mic/session semantics, and reported proxy/UI bugs addressed on **`main`**. Optional polish (agent visual Phase 2, idle+resume E2E hardening, Phase D dedupe) can be new issues if needed.

**GitHub:** [#561 — Refactor: Start → Live mode (voice-first, simplified UI for on-the-go / hands-free)](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

**Labels:** refactor, enhancement, ui-component, voice-agent, priority: medium

---

## What this issue is

Rewire the test-app **Live** entry control so it enters **Live** mode (ChatGPT **Voice mode**–style): simplified, glanceable UI for **on-the-go / mostly hands-free** use (e.g. vehicle). Test-app scope: visualize **voice activity** and **agent activity** (including **thinking / tool-calling** when signals exist), optional **agent visual**, and **conversation history** in Live.

This folder remains the **history** of decisions, tests, and artifacts for that rollout.

## Local docs

| Doc | Purpose |
|-----|---------|
| [CURRENT-STATUS.md](./CURRENT-STATUS.md) | **Rolling snapshot:** TDD phase, locked decisions, artifacts, blockers. **Update after each slice.** |
| [NEXT-STEP.md](./NEXT-STEP.md) | **Single queue head:** immediate next action; **update after each slice.** |
| [TDD-PLAN.md](./TDD-PLAN.md) | **TDD plan:** RED/GREEN/REFACTOR phases, product rules, unit + E2E scope, commands. |
| [DESIGN-LIVE-AGENT-VISUAL.md](./DESIGN-LIVE-AGENT-VISUAL.md) | **Design proposal:** waveform / mouth visual, phases, tech options. |
| [TRACKING.md](./TRACKING.md) | Checklist and status while implementing. |

---

## Related

- [Issue #560](../ISSUE-560/README.md) — **Closed (2026-04-08).** Mic/proxy/build work shipped on **`main`**; optional human host-mic STT repro remains in that folder.

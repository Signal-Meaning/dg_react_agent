# Issue #561 — next step

**Last updated:** 2026-04-08 (`issue-561` fast-forwarded to **`main`**, including **closed** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560))

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

> **Maintenance:** After each meaningful slice of work, update **this file** (what to do next) and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)** (where we are, decisions, artifacts).

**Who is “next step” for?** This list is a **shared engineering queue** for whoever implements #561 next—you, another contributor, or an AI agent in a properly configured workspace. It is **not** “only the human” or “only the agent.”

**Human-only** below means: steps that **require your credentials, your network, your ears, or a server you start locally** in a way our automation does not assume. An agent can still do **code fixes and tests** once the failure mode is known.

---

## Immediate next step (do this first)

| # | Item | Human-only? |
|---|------|-------------|
| 1 | **Bug 1 follow-up:** `live-mode-openai-proxy.spec.js` qualifies **Live + OpenAI proxy + PCM → assistant** in **`live-conversation-history`**. If issues persist **only** with a **real mic**, trace **capture / VAD / levels** (human listening + backend logs). | **Human-only** for “does my physical mic work in this browser?” **Not** human-only for the injected-audio E2E (runs in automation when proxy + keys + fixtures exist). |
| 2 | **Agent visual Phase 2:** Replace the Phase-1 lip + bars with **SVG lip** motion per [DESIGN-LIVE-AGENT-VISUAL.md](./DESIGN-LIVE-AGENT-VISUAL.md) (smoothed energy from `agentOutputActive` or future RMS). | **No** (repo-only). Optional **visual sign-off** in browser is human. |
| 3 | **E2E:** **Idle disconnect + resume** assertion (`live-session-phase`, resume control) — [TDD-PLAN.md](./TDD-PLAN.md) §4.1 — keep conditional skip documented if CI lacks backend. | **Partially:** writing the spec is **no**. A **full real-API run** is **human-only** if CI has no backend (you run `npm run dev` / backend per project rules). |

---

## Done recently

- **2026-04-04:** **Live** button + **`live-entry-button`**; full-screen **`live-mode-screen`**; labeled status rows; **`live-conversation-history`**; **`LiveAgentVisual`** placeholder + **design doc**; **`shouldClearMicOnAgentDisconnect`** + App sync for mic / declarative capture / `isRecording` on agent **`closed`/`error`**.
- **2026-04-05:** *(prior)* `functionCallInFlight` → Live **tool** row; `enterLiveMode`, shared `startServicesAndMicrophone`, E2E smoke.

---

## When you finish a step

1. Mark checkboxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md) (phase table, artifacts table, bug table).
3. Replace the **Immediate next step** section above with the new first action.

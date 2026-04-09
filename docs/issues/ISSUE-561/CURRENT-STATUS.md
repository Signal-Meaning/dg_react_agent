# Issue #561 — current status

**Last updated:** 2026-04-09 — **Issue closed on GitHub**; **`issue-561` merged into `main`** (fast-forward). Includes **closed** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560) proxy/mic/build work.

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561) — **closed 2026-04-09**

---

## Closure (scope met)

**Shipped for #561:** **Live** entry (`live-entry-button`), full-screen **`live-mode-screen`**, labeled mic/agent/session activity, **`live-conversation-history`**, tool-calling row when in flight, **`LiveAgentVisual`** placeholder + [DESIGN-LIVE-AGENT-VISUAL.md](./DESIGN-LIVE-AGENT-VISUAL.md), mic clear on agent **`closed`/`error`**, OpenAI Live + injected-audio E2E. Partner bugs 1–3 in the table below are **addressed or qualified** in-tree; **real host-mic** acoustic/STT remains optional human follow-up (with **#560** proxy path on `main`).

**Not required to close:** Phase **D** refactor; **SVG** agent visual Phase 2; extended **idle disconnect + resume** E2E — track as follow-up work if desired.

---

## Partner / manual report — bugs (2026-04-04)

| ID | Report | Status in tree |
|----|--------|----------------|
| **Bug 1** | OpenAI **proxy** path: after granting mic and entering Live (or using mic), session/Settings look healthy and idle timeout behaves, but **no clear evidence of voice → assistant → visible replies**. Expect assistant responses. | **Fixed / qualified (wire path):** `data-testid="has-sent-settings"` lived only under **`debug-main-layout`**, which **unmounts in Live**, so tooling and mental model could not rely on “Settings applied” while Live was open. **Change:** a single **visually hidden** `has-sent-settings` sentinel stays on **`voice-agent`** always. **E2E:** `live-mode-openai-proxy.spec.js` enters **Live**, waits for the sentinel, **injects** the same PCM path as `openai-proxy-e2e` test 5, and asserts an **assistant** row in **`live-conversation-history`** — **green** against real proxy in CI/local when keys/backend match. **Proxy/mic pipeline (#560, on `main`):** commit timing (first commit + orphan tail), scheduler, default **Server VAD**, PCM contract — see [ISSUE-560](../ISSUE-560/README.md). **Still human-only to confirm:** real **microphone + room speech** if the symptom was acoustic / STT-specific rather than UI/observability. |
| **Bug 2** | After **idle timeout** disconnect, the **microphone** control did not reflect that the session was gone (still looked “enabled”). **Resume microphone** in Live should align the same way. | **Addressed:** On agent `connectionState` **`closed`** or **`error`**, the app clears **`micEnabled`**, **`declarativeStartAudioCapture`**, and **`isRecording`** so debug **Enable Mic** and Live **Resume microphone** semantics match a dead session. Policy helper: `shouldClearMicOnAgentDisconnect` + unit tests. |
| **Bug 3** | Status showed **`idle` / `idle` / `disconnected`** with controls **mid-screen**; why twice **idle**? Should layout be bottom/centered? | **Addressed:** The two **idle** values were **mic (voice) phase** vs **agent presentation** without labels — now **Mic activity**, **Assistant activity**, **Session**. Layout: **full-screen** `live-mode-screen`; stack **mouth visual → conversation history → activity rows → footer** (buttons directly under that output block). |

---

## Where we are in the TDD

| Phase | Status | Notes |
|-------|--------|--------|
| **A** — Unit (`test-app/tests/unit/`) | **Extended** | Added `syncMicFromAgentConnection.test.ts`; `LiveModeView` tests for labels, `live-agent-visual`, `live-conversation-history`, `live-mode-footer`. |
| **B** — E2E | **Smoke + OpenAI Live** | `live-mode.spec.js` (**live-entry-button**, mic telemetry). **`live-mode-openai-proxy.spec.js`** — OpenAI proxy + Live + injected audio → assistant in history (Bug 1 path). |
| **C** — GREEN (App + `LiveModeView`) | **Done (issue scope)** | Full-screen Live, **`agentOutputActive`**, conversation feed, mic sync on disconnect, **`LiveAgentVisual`** placeholder. |
| **D** — REFACTOR | **Optional follow-up** | Dedupe start+mic — not blocking closure. |

**Branch:** Work landed on **`main`**; historical branch **`issue-561`** was fast-forwarded and merged.

---

## Locked product decisions (keep tests and UI aligned)

1. **Microphone on by default in Live mode**  
   Entering Live runs the same **`ref.start(...)`** policy as the existing mic button (OpenAI proxy → agent-only; Deepgram-direct → agent + transcription), then **`ref.startAudioCapture()`** (or declarative equivalent). Live mode must **not** use the broken non-proxy pattern `start({ userInitiated: true })` without `agent` / `transcription` flags.

2. **Idle timeout behavior is retained**  
   No relaxation of idle disconnect semantics as part of #561; component and proxy idle rules stay as today unless a **separate** issue changes them.

3. **When the session stops while the user is still “in Live”** (e.g. idle disconnect, server close)  
   - The UI must make **stopped / disconnected** state **observable** (stable `data-testid` + clear copy for glanceable use).  
   - The user must have a **dedicated way to continue in Live mode** by **reactivating the microphone** (re-run connect + capture policy as needed), without forcing them back to the full debug layout first.

4. **Explicit exit**  
   **Stop / Leave Live** still leaves Live mode and returns to the normal test-app layout (teardown rule must match [TDD-PLAN.md](./TDD-PLAN.md) §2 once chosen).

5. **Live entry control**  
   The primary control is labeled **Live** (not **Start**); stable selector **`data-testid="live-entry-button"`**.

---

## Artifacts (update as you add them)

| Artifact | Path / link |
|----------|-------------|
| TDD plan | [TDD-PLAN.md](./TDD-PLAN.md) |
| Agent visual design | [DESIGN-LIVE-AGENT-VISUAL.md](./DESIGN-LIVE-AGENT-VISUAL.md) |
| Next action | [NEXT-STEP.md](./NEXT-STEP.md) |
| Unit tests | `live-mode-presentation.test.ts`, `LiveModeView.test.tsx`, `syncMicFromAgentConnection.test.ts` |
| Presentation helpers | `test-app/src/live-mode/liveModePresentation.ts` |
| Mic / disconnect policy | `test-app/src/live-mode/syncMicFromAgentConnection.ts` |
| Live shell | `test-app/src/live-mode/LiveModeView.tsx`, `LiveAgentVisual.tsx` |
| `data-testid` (Live) | `live-mode-screen`, `live-mode-root`, `live-mode-main`, `live-voice-state`, `live-agent-state`, `live-session-phase`, `live-activity-status`, `live-conversation-history`, `live-conversation-message-*`, `live-agent-visual`, `live-agent-visual-bar-*`, `live-mode-footer`, `live-end-live-button`, `live-resume-mic-button` |
| Debug entry | `live-entry-button` (was `start-button`) |
| E2E specs | `test-app/tests/e2e/live-mode.spec.js`, `test-app/tests/e2e/live-mode-openai-proxy.spec.js` |

---

## Blockers / open questions

- **Real mic vs injected PCM:** If Live still fails **only** with a physical mic, compare **`PW_ENABLE_AUDIO`**, OS input level, and proxy logs for `input_audio_buffer.append` while speaking; injected-audio E2E proves **component + proxy + history** for the same session shape.

**Build hygiene (on `main`, Issue #544 / #560):** `DeepgramVoiceInteractionHandle.start` includes optional `userInitiated` in `src/types/index.ts`. Test-app: `vite.config.ts` `https` spread + `ViteDevServer` plugin typing; `session-manager-integration.test.tsx` strict types. **#560 closed 2026-04-08** — full notes in [ISSUE-560](../ISSUE-560/README.md).

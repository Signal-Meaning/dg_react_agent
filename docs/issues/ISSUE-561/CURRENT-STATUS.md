# Issue #561 — current status

**Last updated:** 2026-04-05 (`functionCallInFlight` → Live **tool** row)

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

---

## Where we are in the TDD

| Phase | Status | Notes |
|-------|--------|--------|
| **A** — Unit (`test-app/tests/unit/`) | **Complete** | `live-mode-presentation.test.ts`, `LiveModeView.test.tsx`, `liveModePresentation.ts`, `LiveModeView.tsx` — all **GREEN**. |
| **B** — E2E (`live-mode.spec.js`) | **Smoke added** | Structure + Start/End flow (needs backend for test 2). |
| **C** — GREEN (App + `LiveModeView`) | **In progress** | Above + **`functionCallInFlight`** / wrapped **`sendResponse`** for **`tool`** in Live during function calls. |
| **D** — REFACTOR | **Not started** | — |

**Branch:** `issue-561` — feature work in progress; push when ready.

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

---

## Artifacts (update as you add them)

| Artifact | Path / link |
|----------|-------------|
| TDD plan | [TDD-PLAN.md](./TDD-PLAN.md) |
| Next action | [NEXT-STEP.md](./NEXT-STEP.md) |
| Unit tests | `test-app/tests/unit/live-mode-presentation.test.ts` |
| Presentation helpers | `test-app/src/live-mode/liveModePresentation.ts` — `getLiveAgentPresentation`, `getLiveSessionPhase` |
| Live shell | `test-app/src/live-mode/LiveModeView.tsx` |
| `data-testid` (Live) | `live-mode-root`, `live-voice-state`, `live-agent-state`, `live-session-phase`, `live-end-live-button`, `live-resume-mic-button` |
| E2E spec | `test-app/tests/e2e/live-mode.spec.js` |
| `data-testid` inventory | *(document in NEXT-STEP or here when stable)* |

---

## Blockers / open questions

- **None recorded.**  
  If E2E for idle-disconnect + mic resume is too flaky in CI, document skips and run conditions in `live-mode.spec.js` and note here.

**Build hygiene (2026-04-05, unblocks test-app `npm run build`):** `DeepgramVoiceInteractionHandle.start` now includes optional `userInitiated` in `src/types/index.ts` (matches implementation, Issue #544). Test-app: `vite.config.ts` `https` spread + `ViteDevServer` plugin typing; `session-manager-integration.test.tsx` strict types. See also [#560](../ISSUE-560/README.md).

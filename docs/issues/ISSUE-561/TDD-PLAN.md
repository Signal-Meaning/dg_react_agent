# TDD Plan: Issue #561 — Live mode (Start rewire, voice-first test-app UI)

**Issue:** [#561 — Refactor: Start → Live mode](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

**Principle:** **Red → Green → Refactor.** Write failing tests that encode the product rules below, then implement the smallest change to go green. The **headless** `@signal-meaning/voice-agent-react` component must remain API-compatible with the [Voice Agent API](https://developers.deepgram.com/docs/voice-agent); test-app changes are the default surface for this effort.

**Recovery (new chat):** Read [CURRENT-STATUS.md](./CURRENT-STATUS.md), [NEXT-STEP.md](./NEXT-STEP.md), this file, and [README.md](./README.md). Implement in order within each phase. Prefer **npm scripts** from repo root and `test-app` per [.cursorrules](../../../.cursorrules).

---

## Checkbox legend

- `[ ]` — Not done.
- `[x]` — Done (tests green; update this doc when complete).

---

## 1. Goals, scope, and constraints

### 1.1 Product goals

- **Start** enters **Live mode**: a **simplified, glanceable** UI (ChatGPT **Voice mode**–style) aimed at **on-the-go / mostly hands-free** use (e.g. vehicle).
- Live mode should **surface**:
  - **User / voice activity** (speaking vs idle, using existing app or component signals).
  - **Agent activity**: listening / speaking / **thinking** / **tool-calling** (and completion where observable), using existing callbacks and `AgentState` (or equivalent) already wired in `test-app/src/App.tsx`.
- **Stop** (or a dedicated **Leave Live** control) exits Live mode and returns to the **full developer / debug** layout (or a documented default), without surprising teardown unless that is explicitly desired (document choice in implementation notes).

### 1.2 Technical scope

| In scope | Out of scope (unless split to a follow-up issue) |
|----------|--------------------------------------------------|
| `test-app` routing or view-mode state, new presentational components, `data-testid` contracts for E2E | Automotive certification, IVI platform SDKs |
| Wiring **correct** `start()` / `startAudioCapture()` sequence for “go live” (align with [#560](../ISSUE-560/README.md) / non-proxy `start({ userInitiated })` footgun) | Changing Deepgram Voice Agent wire protocol |
| Unit tests under `test-app/tests/unit/` for pure logic / small components | Rewriting the entire debug dashboard |

### 1.3 Constraints

- **Do not** break published **handle** or **props** contracts on the headless component for the sake of the demo; if new signals are **required**, add them via a **separate, explicitly scoped** API change with its own tests in `tests/` (package root).
- **E2E** from **`test-app`** only (see [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md)).

---

## 2. Product rules (executable specifications)

These are the behaviors tests should lock:

1. **Enter Live mode:** From the default test-app view, a user action bound to **Start** sets `liveMode === true` (or equivalent) and shows the **Live** shell (large targets, minimal chrome).
2. **Session wiring (mic on by default in Live):** Entering Live mode performs a **documented** sequence: **`ref.start(...)`** using the **same** OpenAI-proxy vs Deepgram-direct flags as the **mic button** in `App.tsx` (agent-only vs agent+transcription, including `userInitiated` where required for idle—see #544 / #560), **then** **`ref.startAudioCapture()`** (or declarative equivalent). **Tests must fail** if Live skips connection, skips mic capture on entry, or uses the broken **`start({ userInitiated: true })`-only** pattern on non-proxy.
3. **Voice activity visibility:** While in Live mode, when the app receives **user-started-speaking** / **user-stopped-speaking** (or the signals you wire), the Live UI reflects **listening** vs **not listening** in a way E2E can assert via `data-testid` (e.g. `live-voice-state`).
4. **Agent activity visibility:** While in Live mode, agent **idle / speaking / thinking** (and **function call in progress** if distinguishable from existing `onFunctionCallRequest` / state) is reflected with stable `data-testid`s (e.g. `live-agent-state`, `live-tool-status`).
5. **Exit Live mode (explicit):** **Stop** or **Leave Live** clears Live mode UI and returns to the full layout; connection teardown matches an explicit rule (e.g. `stop()` on exit—**document in [CURRENT-STATUS.md](./CURRENT-STATUS.md)** when chosen), and E2E asserts the transition.
6. **Idle timeout retained; session end observable; resume via mic:** **Do not** weaken idle disconnect behavior for #561. If the session ends **while the user remains in Live** (idle disconnect, connection close, etc.), the Live UI must show an **observable** **stopped / disconnected** state (stable `data-testid`, glanceable copy). The user must have a **clear control to continue in Live mode** by **reactivating the microphone** (re-run `start` / `startAudioCapture` as needed per the same proxy/direct rules). Tests should cover this path where feasible (E2E may be conditional/skip in CI—document in spec).

---

## 3. Phase A — RED: unit tests (test-app)

**Location:** `test-app/tests/unit/` (new files as needed).

### 3.1 Live mode state machine or shell (choose one approach)

**Option A — Pure reducer/helpers:** Export a small module, e.g. `liveModeSession.ts`, with functions:

- `describeLiveAgentPresentation(agentState, extras)` → string or enum for UI/E2E.
- Optional: `shouldAutoStartMic(liveMode, settings)` for policy.

**Tests:**

- [x] **RED/GREEN:** `live-mode-presentation.test.ts` — table-driven expectations: given `AgentState` + “function call pending,” expect **`tool`** or passthrough state; **`getLiveSessionPhase`** for `active` / `mic_off` / `disconnected` (Issue #561 resume-mic semantics).
- [ ] **RED:** If auto-mic policy is encoded in the helper, tests for **OpenAI proxy vs not** and “user explicitly disabled mic” if applicable (optional — may live in shared `startLiveSession` helper in Phase C).

**Done when:** Tests fail on `main` (or current branch) before Live UI exists.

### 3.2 Presentational component (optional but recommended)

If `LiveModeView` is a separate component:

- [ ] **RED:** `LiveModeView.test.tsx` (RTL) — renders **voice** and **agent** regions; assert `data-testid` presence and text/aria from **props** (no real WebSocket).

**Done when:** Component tests fail until `LiveModeView` exists.

---

## 4. Phase B — RED: E2E contracts (Playwright)

**Location:** `test-app/tests/e2e/live-mode.spec.js` (new).

**Setup:** Reuse patterns from [microphone-helpers.js](../../../test-app/tests/e2e/helpers/microphone-helpers.js) and [test-helpers](../../../test-app/tests/e2e/helpers/test-helpers.js); **do not** start servers from automation—document “user runs `npm run dev` / backend” where real APIs are needed.

### 4.1 Smoke (mock-friendly where possible)

- [ ] **RED:** `live-mode.spec.js` — **Enter Live:** click Start (or the control that replaces it), expect `data-testid="live-mode-root"` (or agreed id) **visible**; expect `data-testid="debug-main-layout"` (or agreed id for dense UI) **hidden** when Live is active.
- [ ] **RED:** **Exit Live:** click Stop / Leave Live; expect Live root **hidden** and debug layout **visible** again.
- [ ] **RED (may skip / real API):** After idle or forced disconnect while Live, expect **`live-session-state`** (or agreed id) shows **stopped**; after **resume mic** control, expect session/capture path active again without leaving Live shell.

### 4.2 Activity affordances (may require real API or staged mocks—document in spec)

- [ ] **RED:** After Live + mic path (or mocked audio), assert `live-voice-state` transitions when the app already exposes user speaking (may be `test.skip` until env stable; **prefer** conditional skip with comment referencing #561).
- [ ] **RED:** Assert `live-agent-state` shows **thinking** when `agentState === 'thinking'` is driven by proxy/component (OpenAI proxy E2E subset if that is the only reliable path—align with [.cursorrules](../../../.cursorrules) real-API guidance for partner-visible behavior).

**Done when:** New spec exists; at minimum **enter/exit** tests are non-skipped and fail until UI is wired.

---

## 5. Phase C — GREEN: implementation (test-app)

Order suggestions (adjust if tests demand otherwise):

1. [ ] Add **Live mode state** (`useState` / URL query `?live=1`—pick one; **URL** helps E2E deep-links and vehicle bookmarking).
2. [ ] Extract **`LiveModeView`** (props: voice snapshot, agent snapshot, tool snapshot, **live session / connection** snapshot, primary actions: **end Live**, **resume mic** when session stopped, optional mute).
3. [ ] Rewire **Start** to set Live mode and run **shared start + `startAudioCapture()`** (mic **on** by default in Live—see §2).
4. [ ] Map existing `App.tsx` state (`userStartedSpeaking`, `agentState`, function-call handler state, connection / idle / error) into Live view props.
5. [ ] Ensure **Stop** / exit behavior matches §2.5 and E2E; ensure **§2.6** observable stopped state + **resume mic** while still in Live.

**Done when:** All Phase A–B tests pass (GREEN).

---

## 6. Phase D — REFACTOR

- [ ] Deduplicate **start + optional mic** logic between **mic button** and **Live Start** (shared async helper in `App.tsx` or small module under `test-app/src/`).
- [ ] Trim duplicate **logs** in Live path; keep **security** redaction rules unchanged.
- [ ] Update [README.md](./README.md) **Local docs** table, [TRACKING.md](./TRACKING.md), [CURRENT-STATUS.md](./CURRENT-STATUS.md), and [NEXT-STEP.md](./NEXT-STEP.md) with spec file names and `data-testid` inventory.

**Done when:** Tests still green; no behavior change without a new RED test.

---

## 7. Validation commands

```bash
# Root — package tests if you touched shared code (unlikely in first slice)
npm test

# test-app unit
cd test-app && npm test -- tests/unit/live-mode-presentation.test.ts

# test-app E2E (targeted)
cd test-app && npm run test:e2e -- live-mode.spec.js
```

For OpenAI-proxy–specific agent states, follow project guidance: run with real backend/API when qualifying behavior partners care about.

---

## 8. References

- [Issue #561 README](./README.md)
- [Issue #560](../ISSUE-560/README.md) — Start/mic / build backlog
- [Issue #544](../ISSUE-544/README.md) — `userInitiated`, idle timeout
- `test-app/src/App.tsx` — current `startInteraction`, `toggleMicrophone`, callbacks

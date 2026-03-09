# TDD Plan: Issue #346 – Idle timeout E2E test failures (4 tests)

**Status:** Direct-mode fix deferred to [**#503**](https://github.com/Signal-Meaning/dg_react_agent/issues/503) (backlog). Proxy mode 15/15 pass; diagnostics and isolation documented here.

**Parent:** [GitHub Issue #346](https://github.com/Signal-Meaning/dg_react_agent/issues/346)  
**Context:** `docs/issues/ISSUE-345/` – Backend proxy validation; 4 idle-timeout E2E tests failing in **direct mode** (component-level, not proxy-specific).

---

## Overview

This document is the **Test-Driven Development** plan for fixing the **four failing E2E tests** in direct (Deepgram) mode related to idle timeout behavior. All work follows: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:** All four specs pass in direct mode: greeting-idle-timeout, idle-timeout-behavior, idle-timeout-during-agent-speech, text-idle-timeout-suspended-audio.

---

## Failing tests (scope)

| # | Spec / test area | Description |
|---|------------------|-------------|
| 1 | **greeting-idle-timeout** | Idle timeout after greeting (e.g. Issue #139); scales with `window.__idleTimeoutMs` (1s or 10s). |
| 2 | **idle-timeout-behavior** | Idle timeout behavior in various scenarios (reconnection, active conversation). |
| 3 | **idle-timeout-during-agent-speech** | Agent speech should not trigger idle timeout (connection should stay open during agent speech). |
| 4 | **text-idle-timeout-suspended-audio** | Text input with suspended AudioContext; idle timeout behavior when audio is suspended. |

**Reference specs:**

- `test-app/tests/e2e/greeting-idle-timeout.spec.js` (or `deepgram-greeting-idle-timeout`)
- `test-app/tests/e2e/idle-timeout-behavior.spec.js`
- `test-app/tests/e2e/idle-timeout-during-agent-speech.spec.js`
- `test-app/tests/e2e/text-idle-timeout-suspended-audio.spec.js`

**Note:** These failures are **direct mode** (Deepgram); proxy mode had 100% pass rate in Issue #345 validation. Root cause is component-level idle timeout behavior, not proxy.

**Requirement (VAD parity):** The **component** must expose the same VAD-related callbacks/state in direct mode as in proxy mode, and/or the **test-app** must wire and render them the same way in both modes, so that E2E tests can observe UserStartedSpeaking, UtteranceEnd, and UserStoppedSpeaking via the same UI elements in direct and proxy mode.

---

## Current state (baseline)

- **Issue #345:** Direct mode ~91% pass rate; 4 failures all idle-timeout related. Proxy mode 47/47 passing.
- **IDLE-TIMEOUT-TEST-ANALYSIS.md:** Documents that greeting-idle-timeout, idle-timeout-behavior, idle-timeout-during-agent-speech, and text-idle-timeout-suspended-audio were fixed/consolidated and reported as passing in some runs; current branch may still show failures in direct mode.
- **Possible causes:** Timing (idle timeout firing too early or too late), AudioContext not initialized in test environment, connection setup or VAD differences in direct mode, or component idle timeout logic not aligned with test expectations.

### Run result: proxy mode (2026-03-08)

A full run of the four specs with **proxy mode** (default `USE_PROXY_MODE=true`) from test-app completed successfully:

| Result | Detail |
|--------|--------|
| **Outcome** | **15 passed** (exit code 0) |
| **Duration** | ~3.9 minutes |
| **Specs** | `deepgram-greeting-idle-timeout.spec.js`, `idle-timeout-behavior.spec.js`, `idle-timeout-during-agent-speech.spec.js`, `text-idle-timeout-suspended-audio.spec.js` |

**Per-spec highlights:**

- **deepgram-greeting-idle-timeout:** Idle timeout after greeting (Issue #139) passed; connection closed within tolerance of `__idleTimeoutMs`; reconnect-after-timeout and second timeout after agent response passed.
- **idle-timeout-behavior:** Microphone activation after timeout, active conversation continuity, VAD/USER_STOPPED_SPEAKING restart, startAudioCapture() reset, and IdleTimeoutService behavior tests passed.
- **idle-timeout-during-agent-speech:** Connection remained active during 20s agent response; "BUG NOT REPRODUCED" (connection did not drop during agent speech).
- **text-idle-timeout-suspended-audio:** Idle timeout after text interaction and AudioContext resumption on focus passed.

### Run result: direct mode (2026-03-09)

Direct mode run completed: **11 passed, 4 failed** (6.4m), exit code 1. Logs show: `baseURL: ...?connectionMode=direct`, `proxy endpoints: none (direct mode)`, `E2E direct mode: USE_PROXY_MODE=false → connectionMode=direct`.

**4 failures (direct mode only):**

| # | Spec | Test | Exact error |
|---|------|------|-------------|
| 1 | idle-timeout-behavior.spec.js:276 | should not timeout during active conversation after UtteranceEnd | `expect(eventsDetected).toBeGreaterThan(0)` — Expected > 0, Received 0. Test waits for VAD events (`UserStartedSpeaking`, `UtteranceEnd`) via `waitForVADEvents`; in direct mode none were detected. |
| 2 | idle-timeout-behavior.spec.js:374 | should handle conversation with realistic timing and padding | Same: `expect(eventsDetected).toBeGreaterThan(0)` — Expected > 0, Received 0. `waitForVADEvents` returned 0. |
| 3 | idle-timeout-behavior.spec.js:981 | should restart timeout after USER_STOPPED_SPEAKING when agent is idle (Issue #262/#430) | Same: `expect(eventsDetected).toBeGreaterThan(0)` — Expected > 0, Received 0. `waitForVADEvents(page, ['UserStartedSpeaking'], 10000)` returned 0. |
| 4 | idle-timeout-during-agent-speech.spec.js:94 | @flaky should NOT timeout while agent is actively speaking | **TimeoutError:** `page.waitForFunction` 30000ms exceeded. Condition: `[data-testid="agent-response"]` text length > 100. |

**Why the exact errors weren’t in the doc before:** They were present in the terminal run log; the TDD update only referred to “see run log for stack” instead of copying them. They are now extracted and recorded above.

**Next steps (no relaxation without inspection):**

1. ~~**Add diagnostics on failure**~~ **Done (2026-03):** Helper `getIdleTimeoutDiagnostics(page, { userMessageSent? })` in `test-app/tests/e2e/helpers/test-helpers.js` captures `connectionStatus`, `agentResponseLength`, `agentResponsePreview`, and `vad: { userStartedSpeaking, utteranceEnd, userStoppedSpeaking }`. On failure, tests attach JSON to the Playwright report:
   - **idle-timeout-during-agent-speech.spec.js:** On timeout waiting for agent response >100 chars, attaches `idle-timeout-during-agent-speech-failure.json` (includes `userMessageSent`).
   - **idle-timeout-behavior.spec.js** (all three failing tests): Before `expect(eventsDetected).toBeGreaterThan(0)`, attaches `idle-timeout-vad-failure-*.json` with `eventsDetected`, `sampleSent` (where applicable), and the same connection/agent/VAD snapshot. Re-run direct-mode E2E and inspect these attachments to decide fix vs. relaxation.
2. **Failures #1–#3:** Root cause is **no VAD events detected** in direct mode (`eventsDetected === 0`). Use the new attachments to see whether VAD elements are present (e.g. `vad.userStartedSpeaking` / `utteranceEnd`), connection state, and agent response; then fix test or component so VAD is observable in direct mode or adjust how the test asserts.

**How direct mode is controlled (so test logs show it):** When `USE_PROXY_MODE=false`, the Playwright config sets baseURL with `?connectionMode=direct`, proxy endpoint env vars to empty, starts only the dev server (no backend), and logs "E2E direct mode" and "proxy endpoints: none (direct mode)". Use the `test:e2e:direct` script (see “How to reproduce” below). No frontend or backend restart needed; the app connects directly to Deepgram using `VITE_DEEPGRAM_*` env vars.

**Targeted runs:** Use `--grep` with `npm run test:e2e:direct` to run a subset of tests when verifying fixes.

**Isolation — which idle-timeout tests pass vs fail (direct mode):**

| Spec | Pass | Fail | What’s different about the failures |
|------|------|------|-------------------------------------|
| deepgram-greeting-idle-timeout | 3/3 | 0 | — |
| idle-timeout-behavior | 5–6 of 9 (1 flaky) | 3 | The **3 that fail** are the only ones that send **audio** and then assert **VAD DOM** (`waitForVADEvents` → `expect(eventsDetected).toBeGreaterThan(0)`). The passing tests use text input, mic button, or timeout polling and do not depend on the app showing UserStartedSpeaking/UtteranceEnd. One other test (“agent state transitions to idle”) is flaky in direct mode. |
| idle-timeout-during-agent-speech | 0 | 1 | Waits for agent response text length >100 within 30s; in direct mode that condition is never met (no or late response). |
| text-idle-timeout-suspended-audio | 2/2 | 0 | — |

**Conclusion:** In direct mode, **VAD-related UI is not updated** when the user speaks via audio (or not in time for the test). So the component or test-app does not expose/render the same VAD state in direct mode as in proxy mode. The single agent-speech failure is a separate issue (agent response never reaches >100 chars in 30s). Fix: ensure component exposes same VAD callbacks/state in direct mode and/or test-app renders them the same way (see Requirement above).

**Note (2026-03):** A direct-mode run via `USE_PROXY_MODE=false npx playwright test ...` failed with **Playwright browser executable not found** (`chromium_headless_shell` missing at `.playwright-browsers/...`), not due to network or app. Ensure browsers are installed: `npm run playwright:install-browsers`. Then run the direct-mode command from your machine. If direct mode passes, the issue may be resolved; if not, use Phase 1–2 to isolate and fix.

---

## Phase 1: RED – Reproduce and isolate

### 1.1 Reproduce failures

1. From **test-app**, run direct-mode E2E for the four specs (no proxy, or Deepgram direct):
   - e.g. `npm run test:e2e -- greeting-idle-timeout.spec.js idle-timeout-behavior.spec.js idle-timeout-during-agent-speech.spec.js text-idle-timeout-suspended-audio.spec.js`
2. Confirm **RED**: which tests fail and with what assertion or error (timeout, wrong state, connection closed unexpectedly, etc.).
3. Document exact failure messages and environment (direct vs proxy, env vars).

### 1.2 Categorize failures

| Spec | Observed cause (from run) | Data to collect before changing tests |
|------|---------------------------|----------------------------------------|
| greeting-idle-timeout | (Passes in direct mode in last run.) | — |
| idle-timeout-behavior (#1–#3) | **VAD events never detected:** `waitForVADEvents` returns 0 (no `UserStartedSpeaking` / `UtteranceEnd` DOM). Direct mode may not render VAD testids or timing differs. | On failure: user message sent, agent response text, presence of `[data-testid="user-started-speaking"]` etc., connection state |
| idle-timeout-during-agent-speech (#4) | **Agent response** never reached >100 chars within 30s (or element/selector differs). | On failure: current agent response text length and content, so we can decide fix vs. threshold change |
| text-idle-timeout-suspended-audio | (Passes in direct mode in last run.) | — |

### 1.3 Add or extend unit tests (if applicable)

- If component idle timeout logic is testable in isolation (e.g. IdleTimeoutService or hook), add **failing** unit tests that describe correct behavior: e.g. “idle timer does not fire while agent is speaking,” “idle timer fires N ms after greeting when no user activity.”
- Run → **RED**.

---

## Phase 2: GREEN – Fix implementation or tests

**Principle:** Do not relax timeouts or thresholds (e.g. 30s, >100 chars) without first adding diagnostics that log or report user/assistant text and relevant state on failure; inspect that output to decide the fix.

### 2.1 Fix component behavior (if bug)

- If the component fires idle timeout during agent speech or too early after greeting, adjust idle timeout logic (e.g. pause during agent speech, or start timer only after greeting delivered).
- If the component does not expose or respect `idleTimeoutMs` in direct mode, align with test expectations.

### 2.2 Fix test environment (if needed)

- If tests fail due to AudioContext not initialized or connection setup: use shared helpers (e.g. `waitForAgentGreeting()`, `waitForIdleTimeout()`, `monitorConnectionStatus()` from IDLE-TIMEOUT-TEST-ANALYSIS.md); ensure direct mode uses same connection and DOM waits as passing proxy runs.

### 2.3 Fix test expectations (if wrong)

- If the test expects “connection stays open for 15s after agent finishes” but correct behavior is “timeout after ~10s idle,” update the test expectation to match the intended product behavior and document.

### 2.4 Run full set

- Run the four specs in direct mode → **GREEN**.
- Re-run relevant E2E suite to avoid regressions.

---

## Phase 3: REFACTOR

- Share setup and helpers across the four specs where possible (e.g. `waitForAgentGreeting`, `waitForIdleTimeout`, connection setup).
- Document in `test-app/tests/e2e/IDLE-TIMEOUT-TEST-ANALYSIS.md` or README: direct vs proxy, any env vars (e.g. `__idleTimeoutMs`), and how to run only idle-timeout tests.

---

## Deliverables

| Deliverable | Status |
|-------------|--------|
| Failures reproduced and categorized | Proxy: N/A (15 passed). Direct: run from test-app (see below). |
| Root cause identified (component vs test vs env) | Pending if direct-mode run fails |
| Unit tests for idle timeout behavior (if applicable) | RED → GREEN (if needed) |
| Four E2E specs passing in proxy mode | ✅ **GREEN** (15 passed, 2026-03-08) |
| Four E2E specs passing in direct mode | ❌ **4 failed**, 11 passed (2026-03-09). See "Run result: direct mode" for the 4 failing tests. |
| Docs and refactor | REFACTOR (after direct-mode result) |

### How to reproduce (from test-app)

```bash
cd test-app
# Direct mode – USE_PROXY_MODE=false; config sets baseURL with ?connectionMode=direct, no proxy env, only dev server. Logs show "E2E direct mode" and "proxy endpoints: none (direct mode)".
npm run test:e2e:direct -- deepgram-greeting-idle-timeout.spec.js idle-timeout-behavior.spec.js idle-timeout-during-agent-speech.spec.js text-idle-timeout-suspended-audio.spec.js

# Proxy mode (to compare) – USE_PROXY_MODE=true; config sets proxy endpoints and starts backend.
npm run test:e2e -- deepgram-greeting-idle-timeout.spec.js idle-timeout-behavior.spec.js idle-timeout-during-agent-speech.spec.js text-idle-timeout-suspended-audio.spec.js
```

---

## References

- **Issue #345:** `docs/issues/ISSUE-345/ISSUE-345-VALIDATION-REPORT.md`, `docs/issues/ISSUE-345/ISSUE-345-BACKEND-PROXY-VALIDATION.md`
- **Idle timeout analysis:** `test-app/tests/e2e/IDLE-TIMEOUT-TEST-ANALYSIS.md`
- **E2E README:** `test-app/tests/e2e/README.md` – deepgram-greeting-idle-timeout, grep patterns
- **Skipped E2E:** `docs/issues/SKIPPED-E2E-TESTS.md` – Issue #346 referenced

# TDD Plan: Issue #346 – Idle timeout E2E test failures (4 tests)

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

**Next step:** Run the same four specs in **direct mode** to confirm whether the original Issue #346 failures (reported in direct mode) still occur. Use the script that does not override `USE_PROXY_MODE` (so the app connects directly to Deepgram, not via proxy). No frontend or backend restart needed for direct mode; the app uses `VITE_DEEPGRAM_*` and connects to Deepgram’s WebSocket.

**How direct mode is controlled (so test logs show it):** When `USE_PROXY_MODE=false`, the Playwright config sets baseURL with `?connectionMode=direct`, proxy endpoint env vars to empty, starts only the dev server (no backend), and logs "E2E direct mode" and "proxy endpoints: none (direct mode)". Use the `test:e2e:direct` script (see “How to reproduce” below). No frontend or backend restart needed; the app connects directly to Deepgram using `VITE_DEEPGRAM_*` env vars.

**Note (2026-03):** A direct-mode run via `USE_PROXY_MODE=false npx playwright test ...` failed with **Playwright browser executable not found** (`chromium_headless_shell` missing at `.playwright-browsers/...`), not due to network or app. Ensure browsers are installed: `npm run playwright:install-browsers`. Then run the direct-mode command from your machine. If direct mode passes, the issue may be resolved; if not, use Phase 1–2 to isolate and fix.

---

## Phase 1: RED – Reproduce and isolate

### 1.1 Reproduce failures

1. From **test-app**, run direct-mode E2E for the four specs (no proxy, or Deepgram direct):
   - e.g. `npm run test:e2e -- greeting-idle-timeout.spec.js idle-timeout-behavior.spec.js idle-timeout-during-agent-speech.spec.js text-idle-timeout-suspended-audio.spec.js`
2. Confirm **RED**: which tests fail and with what assertion or error (timeout, wrong state, connection closed unexpectedly, etc.).
3. Document exact failure messages and environment (direct vs proxy, env vars).

### 1.2 Categorize failures

| Spec | Likely cause (hypothesis) | Data to collect |
|------|---------------------------|------------------|
| greeting-idle-timeout | Timer fires before/after greeting; or connection closed before assertion | Greeting DOM visibility, `__idleTimeoutMs`, close event timing |
| idle-timeout-behavior | Reconnection or “active conversation” path not keeping connection alive as expected | Which scenario fails; connection state at failure |
| idle-timeout-during-agent-speech | Idle timer not paused during agent speech | Agent speech detection; timer pause/resume logs |
| text-idle-timeout-suspended-audio | AudioContext suspended in test; component or test expectation wrong | AudioContext state; whether timeout should fire when audio suspended |

### 1.3 Add or extend unit tests (if applicable)

- If component idle timeout logic is testable in isolation (e.g. IdleTimeoutService or hook), add **failing** unit tests that describe correct behavior: e.g. “idle timer does not fire while agent is speaking,” “idle timer fires N ms after greeting when no user activity.”
- Run → **RED**.

---

## Phase 2: GREEN – Fix implementation or tests

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
| Four E2E specs passing in direct mode | Pending: run with `USE_PROXY_MODE=false` |
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

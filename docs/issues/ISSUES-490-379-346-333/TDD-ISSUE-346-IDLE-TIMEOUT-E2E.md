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
| Failures reproduced and categorized | Run from test-app (see below) |
| Root cause identified (component vs test vs env) | Pending reproduction |
| Unit tests for idle timeout behavior (if applicable) | RED → GREEN (if needed) |
| Four E2E specs passing in direct mode | GREEN (after fix) |
| Docs and refactor | REFACTOR |

### How to reproduce (from test-app)

```bash
cd test-app
# Direct mode (Deepgram, no proxy) – Issue #346 failures were in direct mode
USE_PROXY_MODE=false npm run test:e2e -- deepgram-greeting-idle-timeout.spec.js idle-timeout-behavior.spec.js idle-timeout-during-agent-speech.spec.js text-idle-timeout-suspended-audio.spec.js

# Proxy mode (to compare)
npm run test:e2e -- deepgram-greeting-idle-timeout.spec.js idle-timeout-behavior.spec.js idle-timeout-during-agent-speech.spec.js text-idle-timeout-suspended-audio.spec.js
```

---

## References

- **Issue #345:** `docs/issues/ISSUE-345/ISSUE-345-VALIDATION-REPORT.md`, `docs/issues/ISSUE-345/ISSUE-345-BACKEND-PROXY-VALIDATION.md`
- **Idle timeout analysis:** `test-app/tests/e2e/IDLE-TIMEOUT-TEST-ANALYSIS.md`
- **E2E README:** `test-app/tests/e2e/README.md` – deepgram-greeting-idle-timeout, grep patterns
- **Skipped E2E:** `docs/issues/SKIPPED-E2E-TESTS.md` – Issue #346 referenced

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

**Run results and isolation:** See [DIRECT-MODE-RESULTS.md](./DIRECT-MODE-RESULTS.md) for proxy/direct run outcomes, the 4 direct-mode failure details, isolation table, and diagnostics notes. **Next steps:** Diagnostics on failure are in place (2026-03). Re-run direct-mode E2E and inspect attached JSON. **How direct mode is controlled:** When `USE_PROXY_MODE=false`, use `test:e2e:direct` (see "How to reproduce" below). **Targeted runs:** Use `--grep` with `npm run test:e2e:direct`. **Merge/close note:** When closing or deferring #346, add a comment linking to #503 (e.g. "Direct-mode fix tracked in #503").

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

- **Run results (direct/proxy):** [DIRECT-MODE-RESULTS.md](./DIRECT-MODE-RESULTS.md)
- **Issue #345:** `docs/issues/ISSUE-345/ISSUE-345-VALIDATION-REPORT.md`, `docs/issues/ISSUE-345/ISSUE-345-BACKEND-PROXY-VALIDATION.md`
- **Idle timeout analysis:** `test-app/tests/e2e/IDLE-TIMEOUT-TEST-ANALYSIS.md`
- **E2E README:** `test-app/tests/e2e/README.md` – deepgram-greeting-idle-timeout, grep patterns
- **Skipped E2E:** `docs/issues/SKIPPED-E2E-TESTS.md` – Issue #346 referenced

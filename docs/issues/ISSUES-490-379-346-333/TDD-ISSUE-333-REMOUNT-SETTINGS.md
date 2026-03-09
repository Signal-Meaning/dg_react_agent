# TDD Plan: Issue #333 – Settings not sent on new connection after remount

**Parent:** [GitHub Issue #333](https://github.com/Signal-Meaning/dg_react_agent/issues/333)  
**Context:** `tests/agent-options-remount-behavior.test.tsx` – one test **skipped**; after remount with different `agentOptions`, new connection should send Settings with new options.

---

## Overview

This document is the **Test-Driven Development** plan for fixing the behavior so that when the component is **remounted with different `agentOptions`** and a **new connection** is established, the component sends **Settings with the new options**. All work follows: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:** Unskip the remount test and make it pass: remount with different agentOptions → connect → Settings must be sent and must include the new options (e.g. functions).

---

## Requirement

| # | Item | Description |
|---|------|-------------|
| 1 | Settings after remount | After remount with different `agentOptions`, when a new connection is established, the component must send a Settings message with the **new** options (e.g. with functions if `remountOptions` include functions). |

---

## Current state (baseline)

- **Test:** `tests/agent-options-remount-behavior.test.tsx` – test *"should verify component remounts with different agentOptions correctly"* is **skipped** with `test.skip` and comment referencing Issue #333.
- **Scenario:** First render with `initialOptions` (no functions) → connect → stop (close connection) → unmount → remount with `remountOptions` (with functions) → connect again. Expected: Settings sent after second connect include functions. Actual: Settings not sent or not with new options (test fails, so skipped).
- **Related:** Issue #318 (useEffect dependency), Issue #276 (Strict Mode remount), Issue #399 (no re-send when agentOptions changes on same connection). #333 is specifically about **new connection after remount** with different options.

---

## Phase 1: RED – Unskip and confirm failure

### 1.1 Unskip the test

**Location:** `tests/agent-options-remount-behavior.test.tsx`.

1. Change `test.skip` to `test` for *"should verify component remounts with different agentOptions correctly"*.
2. Run: `npm test -- tests/agent-options-remount-behavior.test.tsx` (or full suite).
3. Confirm **RED**: e.g. `capturedSettings.length` is 0, or Settings do not contain the remount options (e.g. functions).

### 1.2 Optional: narrow with a smaller test

- If useful, add a focused unit test that mocks remount + connect and asserts “sendJSON was called with a Settings message whose agent options match the remount options.” Run → **RED**.

---

## Phase 2: GREEN – Implementation

### 2.1 Root cause

- **Likely causes:** (a) After remount, `agentOptionsRef.current` is not set to the new options before `sendAgentSettings` runs on connect; (b) `sendAgentSettings` is not called on the new connection after remount; (c) global or ref state (e.g. `hasSentSettingsRef`, `globalSettingsSent`) prevents sending Settings on the new connection because they are not reset on unmount/remount.
- **Investigation:** Trace connect flow after remount: when does the new instance call `sendAgentSettings`? When does it read `agentOptionsRef.current`? Is that ref updated after remount before the first send?

### 2.2 Fix

- Ensure that when the component mounts (including after remount), on the **first** connection it sends Settings using the **current** `agentOptions` (the ones passed on that mount). Options:
  - Reset “has sent Settings” state when the component unmounts or when the instance is new, so that the new instance always sends Settings on its first connection.
  - Ensure `agentOptionsRef.current` is set from props (e.g. in useEffect or layout effect) before any connection logic runs so that when `sendAgentSettings` runs on connect, it sees the remount options.
- Make the minimal change so that the skipped test passes.

### 2.3 Run test

- Run `tests/agent-options-remount-behavior.test.tsx` → **GREEN**.
- Run full Jest suite to avoid regressions (especially other remount and Settings tests).

---

## Phase 3: REFACTOR

- Remove the skip and any temporary comments; add a brief comment referencing Issue #333 and the expected behavior.
- If the fix touches the same code as Issue #490 (component-owned context), align with that refactor (e.g. component builds Settings from current options on first send after mount).

---

## Deliverables

| Deliverable | Status |
|-------------|--------|
| Test unskipped and failing (RED) | Done |
| Root cause identified | N/A – test passed when unskipped |
| Fix: Settings sent on new connection after remount with new options | ✅ GREEN (existing behavior correct) |
| Full suite still passing; no regressions | ✅ GREEN |
| Refactor and docs | Test unskipped; comment retained for Issue #333 |

**Resolution:** The test was unskipped in this PR. The component already sends Settings on new connection after remount with different `agentOptions`; all three tests in `agent-options-remount-behavior.test.tsx` pass.

---

## References

- **Skipped test:** `tests/agent-options-remount-behavior.test.tsx` – `test.skip('should verify component remounts with different agentOptions correctly', ...)`
- **Issue #331 (Jest test fixes):** `docs/issues/ISSUE-331-JEST-TEST-FIXES.md` – documents 27 passing, 1 skipped (Issue #333)
- **Related issues:** #318 (useEffect / agentOptions change), #276 (Strict Mode remount), #399 (no re-send on same connection when options change)
- **Component:** `src/components/DeepgramVoiceInteraction/index.tsx` – `sendAgentSettings`, `agentOptionsRef`, connection lifecycle

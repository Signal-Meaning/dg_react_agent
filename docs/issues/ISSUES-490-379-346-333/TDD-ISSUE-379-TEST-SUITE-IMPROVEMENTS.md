# TDD Plan: Issue #379 – Component team test suite improvements

**Parent:** [GitHub Issue #379](https://github.com/Signal-Meaning/dg_react_agent/issues/379)  
**Context:** Voice-commerce / component team recommendations for test suite improvements.

---

## Overview

This document is the **Test-Driven Development** plan for adding recommended test capabilities: **Settings message structure verification**, **WebSocket capture**, **functions verification**, and **improved diagnostics**. All work follows: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:** Tests can reliably assert Settings shape, outbound WebSocket messages, presence of functions in Settings, and clearer diagnostics for debugging failures.

---

## Requirements (from issue scope)

| # | Item | Description |
|---|------|-------------|
| 1 | Settings message structure verification | Tests can assert that the Settings message has the expected structure (e.g. `agent.context`, `agent.instructions`, `agent.tools` / functions). |
| 2 | WebSocket capture | Tests can capture and inspect WebSocket messages sent by the component (e.g. Settings, InjectUserMessage) for assertions. |
| 3 | Functions verification | Tests can verify that function definitions are included in Settings when function calling is enabled. |
| 4 | Improved diagnostics | Clearer failure output or diagnostic hooks (e.g. last Settings sent, last N WebSocket messages) to debug test failures. |

---

## Current state (baseline)

- **Settings verification:** Some E2E tests use `window` variables or WebSocket capture when available; proxy mode may not expose the same capture (see Issue #329 – WebSocket capture optional/fallback).
- **WebSocket capture:** `installWebSocketCapture()` and similar exist in test-app E2E helpers; behavior and availability vary by mode (direct vs proxy).
- **Functions in Settings:** Assertions exist in remount and function-calling tests (e.g. `findSettingsWithFunctions`, `assertSettingsWithFunctions` in component-test-helpers); E2E may rely on backend behavior or window vars.
- **Diagnostics:** Failure context in Playwright (e.g. `error-context.md`), proxy/agent logs; no single standard for “last Settings” or “last N messages” in all environments.

---

## Phase 1: RED – Define test contracts

### 1.1 Settings message structure verification

**Location:** Unit: `tests/utils/component-test-helpers.tsx` or new `tests/settings-structure-verification.test.ts`; E2E: shared helper or spec helpers.

1. **Write failing tests** that:
   - After sending Settings, assert the payload has expected shape: e.g. `agent` present, `agent.context` optional but when present is `{ messages: [...] }`, `agent.instructions` string, `agent.tools` or equivalent when functions are supplied.
   - Cover cases: no context, with context, with functions, with instructions only.
2. Run → **RED** if helpers or assertions are missing or incomplete.

### 1.2 WebSocket capture

**Location:** `test-app/tests/e2e/helpers/` and/or `tests/utils/` (component tests).

1. **Write failing tests** that:
   - Rely on a documented “capture” API (e.g. `installWebSocketCapture()` or `getCapturedSentMessages()`) to assert that at least one Settings message was sent and optionally that its shape matches expectations.
   - Document when capture is available (direct vs proxy) and fallback (e.g. window vars) when not.
2. Run → **RED** where capture is missing or not exposed in the test environment.

### 1.3 Functions verification

**Location:** Unit and E2E.

1. **Write failing tests** that:
   - Enable function calling (e.g. pass agentOptions with `functions` or test-app equivalent).
   - After connection/Settings sent, assert that at least one Settings message includes the expected function definitions (by name or schema).
2. Run → **RED** until helpers and wiring exist.

### 1.4 Diagnostics

**Location:** Test-app or test helpers.

1. **Define contract:** When a test fails, how can we expose “last Settings” or “last N WebSocket messages” for debugging?
2. **Write failing tests** that:
   - Trigger a scenario that sends Settings.
   - Assert that a diagnostic hook (e.g. `window.__lastSettings` or a getter in the test) returns the expected shape when available.
3. Run → **RED** until hooks are implemented.

---

## Phase 2: GREEN – Implementation

### 2.1 Settings structure

- Add or extend helpers: `assertSettingsStructure(settings)` (and optionally `getLastSettings()` from capture or window).
- Use in existing tests that send Settings; ensure structure assertions pass.

### 2.2 WebSocket capture

- Ensure `installWebSocketCapture()` (or equivalent) is documented and used in E2E specs that need it; implement or fix fallback for proxy mode (e.g. window vars, or proxy-side capture if applicable).
- Component tests: continue using mock WebSocketManager and captured sends; ensure capture is consistent.

### 2.3 Functions in Settings

- Reuse or add `findSettingsWithFunctions` / `assertSettingsWithFunctions` in component tests; in E2E, add or reuse helpers that assert functions in Settings (via capture or window).
- Run unit and E2E → **GREEN**.

### 2.4 Diagnostics

- Add minimal diagnostic hooks (e.g. in test-app: set `window.__lastSettings` when Settings are sent when a test flag is set; or expose via existing `__e2e*` vars).
- Ensure at least one test reads and asserts on the diagnostic so the path is tested.

---

## Phase 3: REFACTOR

- Centralize Settings verification in one place (e.g. `test-app/tests/e2e/helpers/settings-helpers.js` and component-test-helpers).
- Document in test-app E2E README: when to use WebSocket capture vs window vars; how to enable diagnostics.
- Remove duplicate or ad-hoc assertions in favor of shared helpers.

---

## Deliverables

| Deliverable | Status |
|-------------|--------|
| Settings structure verification (unit + E2E) | ✅ RED → GREEN |
| WebSocket capture documented and used; fallback for proxy | ✅ Documented in E2E README |
| Functions-in-Settings verification (unit + E2E) | ✅ Existing + assertSettingsStructure(requireFunctions) |
| Diagnostic hooks for last Settings / messages | ✅ getLastSettingsFromCapture, assertSettingsStructureE2E |
| Docs and refactor | ✅ E2E README section; shared helpers |

**Implemented:** `assertSettingsStructure` and `AssertSettingsStructureOptions` in component-test-helpers; `tests/settings-structure-verification-379.test.tsx`; E2E `getLastSettingsFromCapture`, `assertSettingsStructureE2E` in test-helpers.js; E2E test in context-retention-agent-usage.spec.js; E2E README section "WebSocket capture and Settings verification (Issue #379)".

---

## References

- **Issue #329 (proxy WebSocket capture):** `docs/issues/ISSUE-329-PROXY-MODE-TEST-FIXES.md` – WebSocket capture optional/fallback in proxy mode.
- **Component test helpers:** `tests/utils/component-test-helpers.tsx` – `createSettingsCapture`, `findSettingsWithFunctions`, `assertSettingsWithFunctions`.
- **E2E helpers:** `test-app/tests/e2e/helpers/test-helpers.js` – `installWebSocketCapture`, WebSocket capture usage.
- **Voice-commerce / Issue #379:** Discovered in voice-commerce; recommendations for Settings verification, WebSocket capture, functions in Settings.

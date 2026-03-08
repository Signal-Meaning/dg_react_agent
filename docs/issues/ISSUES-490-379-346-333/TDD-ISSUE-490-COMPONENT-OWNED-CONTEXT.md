# TDD Plan: Issue #490 – Component-owned agent context for Settings

**Parent:** [GitHub Issue #490](https://github.com/Signal-Meaning/dg_react_agent/issues/490)  
**Reference:** `docs/issues/ISSUE-490/REFACTOR-CONTEXT-OWNERSHIP.md`

---

## Overview

This document is the **Test-Driven Development** plan for the refactor that makes the **component** responsible for building and updating `agent.context` when sending Settings, while publishing it so the app can persist and restore it. All work follows the project rule: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:** Single source of truth for context in the component; reconnect robustness; simpler app contract (persist/restore only). API compatibility with Voice Agent API v1 is preserved.

---

## Requirements (from REFACTOR-CONTEXT-OWNERSHIP)

| # | Item | Description |
|---|------|-------------|
| 1 | Component builds `agent.context` | Component builds `agent.context` from its own conversation history when sending Settings (and optionally from a “restored” prop from the app). |
| 2 | Component publishes context | Publish the context (or full options used for that Settings message) via a callback so the app can persist it. |
| 3 | Component accepts restored context | Accept optional “restored” context from the app (e.g. after reload/failure) and use it when building the next Settings if in-memory history is empty or not yet restored. |
| 4 | App persists/restores only | App persists when component publishes; restores by passing back via e.g. `restoredAgentContext`; no requirement to implement `getAgentOptions` for context timing. |

---

## Current state (baseline)

- **App** builds `agent.context` via `getContextForSettings(conversationForDisplay, getRefHistory)` and supplies it at send time via **`getAgentOptions(getConversationHistory)`**.
- **Component** calls `getAgentOptions?.(() => conversationHistoryRef.current)` inside `sendAgentSettings()` and uses the returned options (including context) for the Settings message.
- **Problem:** On reconnect, `getAgentOptions` can see empty app state or empty component ref, so Settings are sent **without** context and session is not retained (see Issue #489, test 9/9a).

**Relevant code:**

- App: `test-app/src/App.tsx` – `getAgentOptions`, `memoizedAgentOptions`, `conversationForDisplay`
- Context helper: `test-app/src/utils/context-for-settings.ts` – `getContextForSettings`
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` – `sendAgentSettings()`, `conversationHistoryRef`

---

## Phase 1: RED – Tests first

### 1.1 Unit tests (already added per ISSUE-490 §5a)

**Location:** `tests/component-owned-context-490.test.tsx` (or equivalent).

Write or confirm failing tests that:

1. **Publish callback:** When the component sends Settings, `onAgentOptionsUsedForSettings` (or equivalent) is called with the options used for that Settings message.
2. **Restored context used:** When in-memory history is empty (first connect or on reconnect), Settings use `restoredAgentContext` when provided.
3. **Component builds from history:** When no `getAgentOptions` and no `restoredAgentContext`, the component builds `agent.context` from `conversationHistoryRef.current`.

Run tests → **RED** until implementation exists.

### 1.2 Types

**Location:** `src/types/index.ts`.

- Add `restoredAgentContext?: AgentOptions['context']`.
- Add `onAgentOptionsUsedForSettings?: (options: AgentOptions) => void`.

### 1.3 E2E test

**Location:** `test-app/tests/e2e/context-retention-agent-usage.spec.js`.

- Test: "Issue #490: when app provides restoredAgentContext, Settings on reconnect include it".
- Use `window.__e2eRestoredAgentContext`; test-app passes it as `restoredAgentContext`.
- Assert last Settings include the restored messages.

**Test-app:** `test-app/src/App.tsx` – pass `restoredAgentContext={(window as TestWindow).__e2eRestoredAgentContext}` for E2E.

Run E2E → **RED** until component uses restored context and sends it in Settings on reconnect.

---

## Phase 2: GREEN – Implementation

### 2.1 Component changes

1. In `sendAgentSettings()`:
   - Build `agent.context` from `conversationHistoryRef.current` (and from `restoredAgentContext` / `restoredAgentOptions` when provided and when in-memory history is empty or not yet restored).
   - After building the Settings payload, call `onAgentOptionsUsedForSettings?.(options)` (or equivalent) so the app can persist.
2. Use the same logic for first connect and reconnect; prefer: fromHistory ?? fromApp ?? fromRestored, with ref fallback only when needed for backward compatibility.

### 2.2 Migration / backward compatibility

- Consider keeping `getAgentOptions` as an optional override so existing integrators are not broken; default path = component-owned context + publish/restore.

### 2.3 Run tests

- Unit tests → **GREEN**.
- E2E 9/9a and context-retention tests → **GREEN** (or document known flakiness and add waits/assertions as in Issue #489).

---

## Phase 3: REFACTOR

- Extract context-building into a single helper (e.g. `buildAgentContextForSettings()`).
- Ensure all send-Settings paths use the same source of truth.
- Update JSDoc and types to document component-owned context and persist/restore contract.
- Remove or reduce any temporary diagnostics added for 9/9a (see Issue #489).

---

## Deliverables

| Deliverable | Status |
|-------------|--------|
| Unit tests for publish, restored, and build-from-history | ✅ GREEN (component-owned-context-490.test.tsx) |
| Types: `restoredAgentContext`, `onAgentOptionsUsedForSettings` | ✅ Done |
| E2E: restored context on reconnect | ✅ Test exists in context-retention-agent-usage.spec.js |
| Component builds and publishes context; accepts restored | ✅ Implemented (useSettingsContext, sendAgentSettings) |
| Docs and refactor | Done |

---

## References

- **Issue #489 (context on reconnect):** `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md`, `docs/issues/ISSUE-489/TDD-PLAN-9A-CONTEXT-ON-RECONNECT.md`
- **Voice Agent API:** https://developers.deepgram.com/docs/voice-agent and v1 migration guide
- **Context helper (test-app):** `test-app/src/utils/context-for-settings.ts` (move or mirror into component as needed)
- **useSettingsContext:** `src/hooks/useSettingsContext.ts`

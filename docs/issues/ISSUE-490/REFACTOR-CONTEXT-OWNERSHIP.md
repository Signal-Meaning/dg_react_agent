# Issue #490: Refactor – Component-owned agent context for Settings

**GitHub:** [Signal-Meaning/dg_react_agent#490](https://github.com/Signal-Meaning/dg_react_agent/issues/490)  
**Status:** Backlog  
**Labels:** refactor

This document describes the refactoring to make the **component** responsible for building and updating `agent.context` when sending Settings, while publishing it so the app can persist and restore it (e.g. after failure or reload).

---

## 1. Goal

- **Single source of truth:** The component already holds the canonical conversation history used for the Voice Agent protocol. It should also own the construction of `agent.context` for the Settings message.
- **Reconnect robustness:** The app persists the context (or options) the component publishes; after failure/reload the app passes it back so the component can send it on the next Settings, without relying on `getAgentOptions` timing.
- **Simpler app contract:** The app no longer has to implement `getAgentOptions` so that context is non-empty at the exact moment the component sends Settings on reconnect.

---

## 2. Current behavior (pre-refactor)

- **App** builds `agent.context` via `getContextForSettings(conversationForDisplay, getRefHistory)` and supplies it at send time via **`getAgentOptions(getConversationHistory)`**.
- **Component** calls `getAgentOptions?.(() => conversationHistoryRef.current)` inside `sendAgentSettings()` and uses the returned options (including context) for the Settings message.
- **Problem:** On reconnect, the component’s call to `getAgentOptions` can see empty app state (`conversationForDisplay`) or an empty component ref, so Settings are sent **without** context and session is not retained (see Issue #489, test 9/9a).

Relevant code today:

- App: `test-app/src/App.tsx` – `getAgentOptions`, `memoizedAgentOptions`, `conversationForDisplay`
- Context helper: `test-app/src/utils/context-for-settings.ts` – `getContextForSettings`
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` – `sendAgentSettings()`, `conversationHistoryRef`

---

## 3. Proposed design

### 3.1 Component responsibilities

- **Build `agent.context`** from its own conversation history when sending Settings (and optionally from a “restored” prop supplied by the app).
- **Publish** the context (or the full options used for that Settings message) via a callback so the app can persist it.
- **Accept** an optional “restored” context (or options) from the app, e.g. after reload/failure, and use it when building the next Settings if in-memory history is empty or not yet restored.

### 3.2 App responsibilities

- **Persist** the context (or options) when the component publishes it (e.g. `localStorage`, app state).
- **Restore** after reload/failure by passing the persisted value back (e.g. `restoredAgentContext` or `restoredAgentOptions`).
- **Optionally** supply instructions, functions, and other agent options; only “context for Settings” is owned and published by the component.

### 3.3 API shape (conceptual)

- **New callback (component → app):** e.g. `onAgentOptionsUsedForSettings?(options: AgentOptions)` or `onContextForPersistence?(context: AgentOptions['context'])` so the app can save what was sent.
- **New prop (app → component):** e.g. `restoredAgentContext?: AgentOptions['context']` or `restoredAgentOptions?: AgentOptions` so the component can use persisted context when building the next Settings (e.g. on reconnect after reload).

Exact names and types to be decided at implementation time; the important part is the direction of data: component builds and publishes, app persists and restores.

---

## 4. Benefits

| Benefit | Description |
|--------|-------------|
| Single source of truth | No sync bugs between app `conversationForDisplay` and component `conversationHistoryRef`; component uses its own history (and optional restored prop) for context. |
| Reconnect robustness | Persisted context is available after failure/reload; component can send it without depending on `getAgentOptions` returning non-empty context at the right time. |
| Simpler app contract | App implements “persist when component publishes” and “pass back restored context”; no need to implement `getAgentOptions` with correct timing for reconnect. |
| API compatibility | Voice Agent API is unchanged; only who builds `agent.context` (component vs app) changes. Stays compatible with Voice Agent API v1. |

---

## 5. Implementation notes (when picked up)

- **Component:** In `sendAgentSettings()`, build `agent.context` from `conversationHistoryRef.current` (and from `restoredAgentContext` / `restoredAgentOptions` when provided and when in-memory history is empty or not yet restored). After building the Settings payload, call `onAgentOptionsUsedForSettings?.(options)` or equivalent so the app can persist.
- **App:** In the test-app (and docs), persist the value received from the callback; on load or when detecting “reconnect after failure,” pass it back via the new prop. Other apps can do the same or keep using `getAgentOptions` if we retain it for backward compatibility during a transition.
- **Migration:** Consider keeping `getAgentOptions` as an optional override (“app can still supply options including context”) so existing integrators are not broken; the default path would be component-owned context + publish/restore.
- **Tests:** E2E test 9/9a (and any context-retention tests) should be updated or added to assert that (1) component builds context on reconnect, and (2) when the app restores context, the next Settings include it.

---

## 5a. Tests added (TDD – RED first)

The following tests were added first and currently **fail** until the component implements the refactor:

- **Unit:** `tests/component-owned-context-490.test.tsx`
  - `onAgentOptionsUsedForSettings` is called with the options used when sending Settings.
  - `restoredAgentContext` is used in Settings when in-memory history is empty (first connect and on reconnect).
  - Component builds `agent.context` from `conversationHistoryRef` when no `getAgentOptions` and no `restoredAgentContext`.
- **E2E:** `test-app/tests/e2e/context-retention-agent-usage.spec.js` – test "Issue #490: when app provides restoredAgentContext, Settings on reconnect include it". Uses `window.__e2eRestoredAgentContext`; test-app passes it as `restoredAgentContext`; asserts last Settings include restored messages.
- **Types:** `src/types/index.ts` – added `restoredAgentContext?: AgentOptions['context']` and `onAgentOptionsUsedForSettings?: (options: AgentOptions) => void`.
- **Test-app:** `test-app/src/App.tsx` – passes `restoredAgentContext={(window as TestWindow).__e2eRestoredAgentContext}` for E2E.

### Follow-up: E2E 9/9a and context-retention

After implementation, openai-proxy-e2e test 9a (“Settings on reconnect include context”) and sometimes test 9 can still fail in full-suite or CI when the component sends Settings without context. The component now prefers `fromHistory ?? fromApp ?? fromRestored` and falls back to `agentOptionsRef.current?.context` when `getAgentOptions` returns no context. If both are empty (e.g. conversation state not yet synced to the component or app), Settings go out without context. E2E changes made to reduce flakiness: 500ms wait before disconnect, wait for conversation DOM (≥4 messages), and robust `hasContext` for `agent.context` as `{ messages: [...] }`. See Issue #489 doc for full trace. TTS diagnostic failure (openai-proxy-tts-diagnostic) is separate (binary/playback) and may be environment-dependent.

---

## 6. References

- **Issue #489 (E2E / context on reconnect):** `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md`
- **Voice Agent API:** https://developers.deepgram.com/docs/voice-agent and v1 migration guide
- **Current context helper:** `test-app/src/utils/context-for-settings.ts` (can be moved or mirrored into the component package as needed)

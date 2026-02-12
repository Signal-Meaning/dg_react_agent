# Issue #429 — Resolution plan: Expose agentManagerRef / disableIdleTimeoutResets (handle API parity)

**Branch:** `davidrmcgee/issue429`

---

## Goal

Expose the same ref/handle shape for **both** Deepgram and OpenAI proxy paths so that the app can access the agent manager and call **disableIdleTimeoutResets** / **enableIdleTimeoutResets** for idle-timeout management (e.g. during "thinking" activity). No behavioral difference between providers for this API.

---

## Current state

- **WebSocketManager** (`src/utils/websocket/WebSocketManager.ts`) already implements **disableIdleTimeoutResets()** and **enableIdleTimeoutResets()** (lines 734, 746).
- **DeepgramVoiceInteraction** uses a single **agentManagerRef** (line 294) and **createAgentManager()** for both Deepgram and OpenAI proxy; the same **WebSocketManager** instance is used in both cases.
- The component’s **useImperativeHandle** (around line 3685) does **not** expose **agentManagerRef** or any **agentManager** / **getAgentManager** accessor. So the public ref handle does not provide a way to get the agent manager, and the app’s `component.agentManager.disableIdleTimeoutResets` is undefined for **all** consumers (Deepgram and OpenAI). The issue reports that it “works for Deepgram” — likely the app is using an undocumented or internal access path for Deepgram; regardless, the fix is to expose the same API for both paths.

---

## Root cause

The **DeepgramVoiceInteractionHandle** (and the object returned by **useImperativeHandle**) does not expose the agent manager. Therefore:

- **agentManagerRef** (or equivalent) is not available on the ref.
- The manager’s **disableIdleTimeoutResets** / **enableIdleTimeoutResets** are not reachable from the handle.

Fixing this by exposing the agent manager from the handle (for both Deepgram and OpenAI) resolves the parity gap.

---

## Location of change

### 1. Component: expose agent manager on the ref handle

**File:** `src/components/DeepgramVoiceInteraction/index.tsx`

**Place:** In the **useImperativeHandle** callback (around lines 3685–3722), add one of:

- **Option A — getter:**  
  `getAgentManager: () => agentManagerRef.current`  
  So the app calls: `ref.current.getAgentManager()?.disableIdleTimeoutResets()`.

- **Option B — ref:**  
  `agentManagerRef: agentManagerRef`  
  So the app calls: `ref.current.agentManagerRef.current?.disableIdleTimeoutResets()`.

**Recommendation:** Prefer **Option A** (`getAgentManager`) so the handle stays a plain object of methods/values and the app does not need to know about React ref shape. Document that the return value may be `null` before connection or after stop.

### 2. Types: extend DeepgramVoiceInteractionHandle

**File:** `src/types/index.ts`

**Place:** In **DeepgramVoiceInteractionHandle** (around line 409), add:

- Either:
  - `getAgentManager: () => WebSocketManager | null;`
- Or:
  - `agentManagerRef: React.RefObject<WebSocketManager | null>;`

(Use the same option as in the component.) If using **getAgentManager**, document that it returns the current agent (WebSocket) manager, and that the manager exposes **disableIdleTimeoutResets** and **enableIdleTimeoutResets** for idle-timeout coordination (e.g. during “thinking” or function calls). See Issue #373.

### 3. WebSocketManager

No change required. **disableIdleTimeoutResets** and **enableIdleTimeoutResets** already exist on **WebSocketManager** and are used by the component internally; they only need to be reachable from the ref handle.

---

## TDD workflow (mandatory)

1. **RED — Tests first**
   - **Unit test:** In the component’s test suite, add a test that:
     - Renders the component with a ref.
     - Calls `ref.current.getAgentManager()` (or accesses `ref.current.agentManagerRef.current`) before start → expects `null` (or equivalent).
     - Calls `ref.current.start()` (or equivalent) so that an agent manager is created.
     - Calls `ref.current.getAgentManager()` (or equivalent) → expects a non-null object with `disableIdleTimeoutResets` and `enableIdleTimeoutResets` as functions.
     - Calls `ref.current.getAgentManager()?.disableIdleTimeoutResets()` and `ref.current.getAgentManager()?.enableIdleTimeoutResets()` and asserts they do not throw.
   - Add a test that the same handle shape is available when using **provider = openai** (proxy path) once the agent manager is created (e.g. after start with agent options that use proxy).
   - Run tests and confirm they **fail** before implementation.

2. **GREEN — Implement**
   - In **DeepgramVoiceInteraction**, add **getAgentManager** (or **agentManagerRef**) to the object passed to **useImperativeHandle**.
   - In **DeepgramVoiceInteractionHandle**, add the corresponding property and JSDoc.
   - Re-run tests and confirm they pass.

3. **REFACTOR**
   - Ensure type exports and any API docs (e.g. **docs/API-REFERENCE.md**) mention **getAgentManager** / **agentManagerRef** and the idle-timeout methods on the manager.

4. **Re-run**
   - Full unit and integration tests; confirm no regressions and that both Deepgram and OpenAI proxy paths expose the same handle shape.

---

## Acceptance criteria

- [x] The ref handle exposes the agent manager (via **getAgentManager()** or **agentManagerRef**) for both Deepgram and OpenAI proxy paths.
- [x] The returned manager has **disableIdleTimeoutResets** and **enableIdleTimeoutResets** callable (same **WebSocketManager** as used internally).
- [x] **DeepgramVoiceInteractionHandle** is updated to include the new property; types are accurate.
- [x] Unit test(s) cover: handle exposes manager after start; manager has idle-timeout methods; same behavior for proxy path when manager exists.
- [x] No new linter/type errors; existing tests remain green.

---

## Out of scope for this issue

- Changing OpenAI backend protocol or idle-timeout semantics.
- Adding new idle-timeout behavior; only **exposing** the existing **WebSocketManager** API on the ref handle.
- Issue #428 (onSettingsApplied on session.created) — separate branch/PR.

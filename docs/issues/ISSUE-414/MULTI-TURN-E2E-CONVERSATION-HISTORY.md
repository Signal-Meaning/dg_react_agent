# Multi-turn E2E: conversation history display failure

**Context:** E2E test *"3. Multi-turn – sequential messages, second agent response appears"* in `test-app/tests/e2e/openai-proxy-e2e.spec.js` expects the conversation history to show **2 user + 3 assistant** messages (greeting + two agent responses). Observed: only **1 user + 1 assistant** (greeting + first user message). The second user message and both agent replies never appear in the displayed conversation history, even though the test passes the checks for first and second agent response text (so responses are received elsewhere, e.g. `agent-response`).

---

## Root cause

**Stale state when syncing from the component ref inside callbacks.**

1. **Component flow** (DeepgramVoiceInteraction, on `ConversationText`):
   - Appends the new message with `setConversationHistory((prev) => [...prev, { role, content, timestamp }])`.
   - Then calls `onAgentUtterance?.(response)` or `onUserMessage?.(response)` in the same synchronous turn.

2. **Test-app sync:**  
   The test-app updates the displayed history by calling `setConversationForDisplay(deepgramRef.current?.getConversationHistory() ?? [])` from inside `handleAgentUtterance` and `handleUserMessage`.

3. **Problem:**  
   `getConversationHistory()` is implemented as `() => conversationHistory` (component state). React state updates are asynchronous. When the parent runs `getConversationHistory()` from inside the callback, the component has just called `setConversationHistory` but has not re-rendered yet, so `conversationHistory` is still the **previous** value. The test-app therefore always reads history **without** the message that just triggered the callback.

4. **Why some messages appear:**  
   The greeting and first user message can appear because:
   - The test-app also syncs on send (lines ~790–793): it merges the sent user message into display when `fromRef.length` is not greater, so the first user message is added there.
   - An initial delayed sync (300 ms after mount) may capture the greeting after the first re-render.
   Later messages (second user echo, first and second assistant responses) are only ever read via the callbacks, so they are always one step behind and never show up.

**Summary:** The test-app’s use of `getConversationHistory()` from inside `onAgentUtterance` / `onUserMessage` runs in the same tick as the component’s `setConversationHistory`; the ref returns stale state, so the UI misses the latest message on every sync.

---

## Recommended fixes (choose one)

1. **Component: pass updated history in the callback (preferred)**  
   When calling `onAgentUtterance` / `onUserMessage`, pass the **new** history (e.g. `[...conversationHistory, newEntry]`) as an optional second argument, or add a separate callback like `onConversationHistoryUpdated(history)`. The test-app then uses that value instead of calling `getConversationHistory()` from the ref.

2. **Component: keep latest history in a ref**  
   In the component, update a ref (e.g. `conversationHistoryRef.current = nextHistory`) synchronously when appending, and expose `getConversationHistory: () => conversationHistoryRef.current ?? []`. Then when the parent calls it from the callback, it gets the just-appended message.

3. **Test-app: defer read**  
   In `handleAgentUtterance` / `handleUserMessage`, defer reading from the ref to the next tick, e.g. `setTimeout(() => { setConversationForDisplay(deepgramRef.current?.getConversationHistory() ?? []); }, 0);`. This allows React to commit the state update before the read. Works but is fragile (timing-dependent) and not ideal for a reference app.

---

## Test expectation (current)

The multi-turn test expects **2 user, 3 assistant** in `[data-testid="conversation-history"]` (two user messages, one greeting + two agent responses). Until the above fix is applied, this assertion will continue to fail when the displayed history is driven by the ref in the callbacks. The test correctly encodes the intended protocol behavior; the failure is due to the stale-state sync, not the test design.

---

## References

- Component: `src/components/DeepgramVoiceInteraction/index.tsx` — ConversationText handler (~2210–2248), ref API `getConversationHistory: () => conversationHistory` (~3678).
- Test-app: `test-app/src/App.tsx` — `handleAgentUtterance`, `handleUserMessage`, send path (~790–793), initial sync (~131).
- E2E: `test-app/tests/e2e/openai-proxy-e2e.spec.js` — test 3 "Multi-turn – sequential messages, second agent response appears".
- Protocol: [OPENAI-PROTOCOL-E2E.md](../../../test-app/tests/e2e/OPENAI-PROTOCOL-E2E.md) — conversation history reflects ConversationText (user/assistant).

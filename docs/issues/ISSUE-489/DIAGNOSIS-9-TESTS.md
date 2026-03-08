# Diagnosis: 9a, 9b, and 9 (Repro) E2E Failures

**Goal:** Explain why 9a/9b/9 still fail after the 9a code fix, and give a crystal-clear path to green (test fix + optional lower-level tests).

---

## 1. Code path (what actually runs)

- **Only one place** sends the Settings message: `sendAgentSettings()` in the component, which calls `agentManagerRef.current.sendJSON(settingsMessage)`.
- **Every time** `sendAgentSettings()` runs it:
  1. Preloads / syncs from storage into `lastPersistedHistoryForReconnectRef` when needed.
  2. Calls **`getContextForSend()`** (from `useSettingsContext`).
  3. **`getContextForSend()` always calls the app’s `getAgentOptions(getter)`** (in `useSettingsContext.ts` around line 115).
  4. Uses `effectiveContext` (and ref fallback if hook returned empty) to build `currentAgentOptions` and `settingsMessage`.
  5. Sends that message.

So in code, **props are used**: the component **does** call `getAgentOptions` whenever it sends Settings (first connection or reconnect). There is no second code path that sends Settings without going through `getContextForSend` / `getAgentOptions`.

---

## 2. Why 9b fails: test order (counter reset too late)

**Observed:** 9b sees `callCount` = 0 after reconnect and fails.

**Cause:** The test resets `__getAgentOptionsCallCount` to 0 **after** the action that triggers reconnect.

**Exact order in 9b today:**

1. Disconnect.
2. Set storage + `__e2eRestoredAgentContext` / `__appLastKnownConversation`.
3. **`textInput.focus()`** → component auto-connects on focus → new WebSocket → `'connected'` → `sendAgentSettings()` → **`getAgentOptions()` runs** → counter becomes **1**.
4. `await page.waitForTimeout(300)`.
5. **`window.__getAgentOptionsCallCount = 0`** → counter is reset to **0**.
6. `sendMessageAndWaitForResponse('What famous people lived there?')` → message is sent on the **already open** connection → no new connection → no second `sendAgentSettings()` → counter stays **0**.

So the reconnect (and the only call to `getAgentOptions` for the second Settings) happens at step 3; the test then zeroes that out at step 5 and asserts on the zeroed value.

**Fix for 9b:** Reset the counter **before** the action that triggers reconnect (before `textInput.focus()`), so the call that builds the second Settings is the one that increments the count. Then assert `callCount >= 1` after `sendMessageAndWaitForResponse`.

---

## 3. Why 9a can still fail: when the second Settings is sent and what it contains

- Reconnect is triggered by **focus** (same as 9b). So the **second** Settings is sent when the test focuses the text input, not when it sends the message.
- 9a resets `__getAgentOptionsCallCount` at line 519 **before** `sendMessageAndWaitForResponse`, so it also resets **after** focus (and thus after the second Settings was already sent and `getAgentOptions` already called).
- So **`__lastGetAgentOptionsDebug`** can be from either:
  - The **first** connection (first Settings), or  
  - The **second** connection (second Settings), depending on timing.

If the debug shows `contextMsgCount: 3` but the **last Settings in the capture** has no context, then either:

- The “last” debug is from the **first** connection, and the **second** Settings was built without calling `getAgentOptions` (e.g. different code path), or  
- The second Settings was built with context but something (serialization / capture) is wrong.

We’ve already established there is only one send path and it always calls `getAgentOptions`. So the remaining possibility is **ordering/timing**: the “last” call the test sees might not be the call that built the last Settings (e.g. if the second connection’s `sendAgentSettings` runs in a way that doesn’t update the same `window.__lastGetAgentOptionsDebug` the test reads, or the test reads before that update). Fixing 9b’s order (reset **before** focus) makes “after reconnect” unambiguously mean “after the focus that triggers reconnect,” and 9a can use the same ordering so that any debug/count it reads is clearly for the reconnect send.

**Recommendation for 9a:** Use the same order as the fixed 9b: reset any counters/debug **before** the action that triggers reconnect (before `textInput.focus()`), then trigger reconnect (focus), then send the message and assert on the **last** Settings and, if needed, on `getAgentOptions` having been called (e.g. count ≥ 1). That way “last Settings” and “last getAgentOptions call” refer to the same reconnect.

---

## 4. Why 9 (Repro) fails: Settings were sent with context; upstream returned greeting

- 9 (Repro) logs: **“Settings on reconnect: context present (3 items)”** and **“Context was sent but upstream returned greeting.”**
- So on the **client/app side**, the second Settings **did** include context. The failure is that the **reply** to “What famous people lived there?” is still the greeting.

So for 9:

- **Were the Settings sent?** Yes, and with context.
- **Why is the greeting returned?** That is **upstream** (proxy or API): session not retained, or proxy not forwarding context correctly, or API ignoring context. Not a bug in the component’s “do we send context?” logic.

With the test-order fix, 9a and 9b pass—so we consistently send context on reconnect. Test 9 (Repro) remains blocked on **upstream**: the proxy or OpenAI Realtime API must forward and use `agent.context` so the API returns a contextual reply instead of the greeting.

### 4.1. What the DOM conversation shows when 9 fails

When the test fails, the **conversation history in the DOM** (captured in order for review) often shows only **4 messages**: 1 assistant (the greeting), 3 user. The two assistant replies (Paris answer, "Sorry what was that?" reply) are **missing**. That implies:

- The component only ever received **ConversationText** for: greeting, user echo 1, user echo 2, user echo 3 (and then the duplicate greeting as the "response").
- So **ConversationText for the two substantive assistant turns was not received** (or not sent by the proxy/API). The context we sent on reconnect therefore had **3 items** = greeting + 2 user messages, with **no assistant replies**. The API then had no prior assistant content in context and returned the greeting again.

The test now logs a **diagnostic** when this pattern is detected (context sent, greeting returned, only 1 assistant message in DOM), so runs point to this incomplete-context explanation.

---

## 5. Summary table

| Test | What’s wrong | Fix |
|------|----------------|-----|
| **9a** | Reconnect happens on **focus**; assertion/capture order can make “last” Settings vs “last” getAgentOptions refer to different sends. | Reset counters/debug **before** focus; trigger reconnect (focus); then send message and assert on last Settings and, if used, getAgentOptions count. Same order as fixed 9b. |
| **9b** | Counter is reset **after** focus, so the reconnect call to `getAgentOptions` is zeroed out before the assertion. | Reset `__getAgentOptionsCallCount` **before** `textInput.focus()`, then focus, then send message, then assert `callCount >= 1`. |
| **9 (Repro)** | Context **was** sent (3 items). Failure is **upstream** returning greeting despite context. | No component change. Blocked on proxy/API: they must forward and use agent.context so the API returns a contextual reply, not the greeting. |

---

## 6. Lower-level tests (optional but recommended)

To lock in behavior without relying on E2E timing:

1. **Unit (e.g. Jest)**  
   - In `useSettingsContext` (or a small wrapper), assert that when `getContextForSend()` is called with refs/storage set to a known history, the returned `effectiveContext` has the expected messages and that the provided `getAgentOptions` is invoked (e.g. mock that increments a counter).  
   - Ensures: “when we build context for send, we call getAgentOptions and can get context.”

2. **Integration (Jest + mock WebSocket / manager)**  
   - Render the component with a mock that records every `sendJSON` payload.  
   - Simulate: connect → disconnect → reconnect (e.g. fire a “connected” event again).  
   - Assert: exactly two Settings messages; the **second** payload has `agent.context.messages` length ≥ 1 and the mock `getAgentOptions` was called for that second send.  
   - Ensures: “on reconnect, we send a second Settings and it includes context, and we call getAgentOptions when building it.”

3. **E2E**  
   - After the test-order fix, 9a and 9b become the E2E guarantee that in the real app, on reconnect, the second Settings includes context and `getAgentOptions` is called.

---

## 7. Code references

- Settings sent only here: `DeepgramVoiceInteraction/index.tsx` → `sendAgentSettings()` → `agentManagerRef.current.sendJSON(settingsMessage)` (around line 2212).
- `getAgentOptions` used by Settings: `sendAgentSettings()` → `getContextForSend()` (`useSettingsContext`) → `getAgentOptions(...)` in `useSettingsContext.ts` (around line 115).
- Reconnect trigger in tests: `textInput.focus()` (auto-connect on focus).
- 9b reset today: `openai-proxy-e2e.spec.js` around line 625, **after** focus (around 620–621).

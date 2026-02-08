# Repro: Stale response after reload and connection error

## Observed bug

1. Have a conversation:
   - assistant: Hello! How can I assist you today?
   - user: What is the capital of France?
   - assistant: The capital of France is Paris. (or longer)
   - user: Sorry, what was that?
   - assistant: The capital of France is Paris.
2. Reload the page.
3. Place cursor in the Text Input (connection starts, then **connection closes with error** – e.g. WebSocket code=1005, OpenAI “server had an error”).
4. Send: **What famous people lived there?**
5. **Observed (bug):** assistant responds with **The capital of France is Paris.** instead of answering the new question.

## Failing test (TDD)

**Spec:** `test-app/tests/e2e/openai-proxy-e2e.spec.js` – test **9. Repro – after reload and connection close, new message must not get stale response**.

- Runs the conversation above, then reload, then connect and disconnect (to simulate “connection closed” before send), then sends “What famous people lived there?”.
- **Assertion:** The agent response must NOT be the stale one-liner “The capital of France is Paris.”
- When the bug occurs (stale response), this test fails (red). Fix the cause (context/UI/upstream) until the test passes (green).

The test may pass when the bug does not reproduce (e.g. no upstream error, or correct response). Run with real APIs repeatedly to hit the failure:  
`E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e -g "9. Repro"`

## Why we see the greeting

Two separate things are going on:

1. **The test is not reconnecting to the same session (at the proxy).** Session state **is** retained by the component/test-app (e.g. conversation history restored from localStorage and sent in the first `session.update` after reload). The **proxy** does not retain session state across client reconnects: each new client WebSocket is a new connection, so `hasForwardedSessionUpdate` is false and the proxy has no notion that this is a “continuation” of a previous session. It sends `session.update` to upstream, gets `session.updated`, then sends the **greeting** to the client. So from the proxy’s perspective every new connection gets the greeting, even when the client has sent restored context in that first `session.update`.

2. **Greeting is not suppressed on “reconnection”.** The component’s “Reconnection detected – skipping greeting” only applies to **Deepgram** (when a `Welcome` message is received and `isNewConnectionRef.current` is false). The OpenAI proxy does not send `Welcome`; it sends `SettingsApplied` then `ConversationText` (greeting). So for the proxy there is no “skip greeting on reconnection” path. Every new connection gets the greeting, and the test-app shows it in the **agent-response** bubble. When the user then sends “What famous people lived there?”, we either never replace that bubble with the real reply (timing/ordering) or the reply is the wrong one.

So: **we are not reconnecting to the same session** (reload = new connection), and **greeting is not suppressed** on this new connection (no logic to skip it when the client has restored context). A fix could be: (a) proxy skips sending greeting to the client when the client sent context (treat as continuation), or (b) component/test-app do not set the greeting as the “agent response” when we have restored conversation context.

## Other suspected causes

- **Restored context:** After reload, conversation is restored from localStorage; the component may send that context in Settings so the proxy has it, but we still send and show the greeting.
- **Stale UI:** The `agent-response` element shows the greeting (first assistant message after connect) and may not be updated by the real reply in time or at all.
- **Upstream:** OpenAI may return a cached or wrong response when the session had an error and the client reconnects.

Investigate and fix so test 9 stays green.

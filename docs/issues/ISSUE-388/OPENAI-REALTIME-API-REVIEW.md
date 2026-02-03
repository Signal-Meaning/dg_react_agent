# Issue #388: OpenAI Realtime API review — proxy implementation gaps

This document summarizes the OpenAI Realtime API documentation (WebSocket guide, server events, client events, realtime conversations) and identifies likely proxy implementation gaps that could cause the upstream to close with code 1000 shortly after the first text message.

**References (as of 2026-02):**

- [Realtime API with WebSocket](https://platform.openai.com/docs/guides/realtime-websocket)
- [Realtime conversations](https://platform.openai.com/docs/guides/realtime-conversations)
- [Client events](https://platform.openai.com/docs/api-reference/realtime-client-events) (session.update, conversation.item.create, response.create)
- [Server events](https://platform.openai.com/docs/api-reference/realtime-server-events) (session.created, conversation.item.added, response.done)

---

## 1. Event order: conversation.item.create then response.create

**What the docs say:**  
Realtime conversations guide, “Text inputs and outputs”:

- “Create a new text conversation item using the **conversation.item.create** client event.”
- “**After adding the user message to the conversation**, send the **response.create** event to initiate a response from the model.”

The server events table lists, in order:

- **Client:** conversation.item.create → response.create  
- **Server:** conversation.item.added → conversation.item.done → response.created → … → response.done  

So the intended flow is: client sends conversation.item.create; server adds the item (conversation.item.added / conversation.item.done); **then** client sends response.create.

**What our proxy does:**  
In `scripts/openai-proxy/server.ts`, on `InjectUserMessage` we send:

1. `conversation.item.create` (mapped from InjectUserMessage)
2. `response.create`  
**immediately**, without waiting for any upstream event.

We do **not** wait for `conversation.item.added` or `conversation.item.done` before sending `response.create`.

**Gap:** We may be sending `response.create` before the server has added the item to the conversation. The API may require the new user message to be in the conversation before a response is created. Violating that could lead to an error or invalid state and the server closing the connection (e.g. with code 1000).

**Recommendation:**  
Change the proxy so that for **InjectUserMessage** (text-only) it:

1. Sends `conversation.item.create`.
2. Waits for upstream `conversation.item.added` or `conversation.item.done` (for that item or the next in sequence).
3. Then sends `response.create`.

That aligns with “after adding the user message to the conversation” and the documented server event order.

---

## 2. Session lifecycle and close code 1000

**What the docs say:**  

- **Session duration:** “The maximum duration of a Realtime session is **60 minutes**.” Sessions have an `expires_at` in `session.created`.
- **Close behavior:** The WebSocket and server-events docs do **not** specify when OpenAI sends WebSocket close code 1000 (normal closure). So we don’t have an explicit “they close when X” rule; it’s consistent with normal closure after an error or after the server decides to end the session.

A closure ~2.7–3 s after the first message is too fast for the 60-minute limit. So the cause is likely not session expiry but something triggered by the first user message (e.g. invalid event order or state as in §1).

---

## 3. Keep-alive and ping/pong

**What the docs say:**  
The Realtime WebSocket and conversations docs do **not** describe a keep-alive or ping/pong requirement. So there is no documented OpenAI-specific keep-alive for the Realtime WebSocket.

**What we do:**  
We do not send WebSocket ping frames or any application-level keep-alive.

**Conclusion:**  
Idle timeouts on proxies/load balancers (e.g. 30–120 s) can still close connections; adding a standard WebSocket ping (or application-level heartbeat) may help in some deployments but is not something the Realtime docs require. The ~2.7 s close is more likely due to event ordering / state (§1) than keep-alive.

---

## 4. Session configuration (session.update)

**What we send:**  
`mapSettingsToSessionUpdate` sends `session.update` with:

- `type: 'realtime'`
- `model` (from Settings or default `gpt-realtime`)
- `instructions` (from Settings prompt)
- `tools` (if present)

We do **not** set:

- `output_modalities` (docs say text is default; we also send `response.create`, so this is likely fine).
- `turn_detection` (default is server VAD; for text-only we are not using VAD and we explicitly send `response.create`, which is correct per the “text inputs” flow).
- `voice` (we intentionally omit it due to API issues; doc says it can be set once before any audio output).

So session.update is unlikely to be the primary cause of the early close; the main suspect remains event order (§1).

---

## 5. Summary: most likely fix

| Area              | Doc behavior / requirement                         | Our behavior                          | Likely gap? |
|-------------------|-----------------------------------------------------|----------------------------------------|------------|
| Event order       | “After adding the user message” then response.create; server sends item.added/done first. | We send item.create and response.create back-to-back. | **Yes** — we don’t wait for item.added/done. |
| Session duration  | 60 min max; expires_at.                             | N/A.                                  | No (close is ~2.7 s). |
| Keep-alive        | Not documented.                                    | No ping/heartbeat.                    | Optional for other timeouts. |
| session.update    | type, instructions, tools, etc.                     | We send those; omit voice.             | Unlikely. |

**Recommended change:**  
Implement “wait for conversation item added before response.create” in the proxy for the InjectUserMessage (text) path: after sending `conversation.item.create`, buffer upstream messages until we see `conversation.item.added` or `conversation.item.done` that corresponds to the new user item, then send `response.create`. Optionally add WebSocket ping for long-lived connections. Re-run the canary E2E test (agent response after first text message) to confirm the connection stays open and the test passes.

---

## 6. TDD: failing tests (red)

- **Integration (failing):** `tests/integration/openai-proxy-integration.test.ts` — test **"Issue #388: sends response.create only after receiving conversation.item.added from upstream for InjectUserMessage"**. The mock upstream sends `conversation.item.added` 100 ms after receiving `conversation.item.create`; the test asserts that `response.create` is received by the mock at least 50 ms after `conversation.item.create` (i.e. after the proxy has received `conversation.item.added`). **Current result: RED** (delay is 0; proxy sends both immediately).
- **Unit (contract):** `tests/openai-proxy.test.ts` — describe **"Issue #388: proxy event order"** tests a helper `maySendResponseCreateAfterInjectUserMessage(upstreamTypesReceived)`: it must return false until the list includes `conversation.item.added` or `conversation.item.done`. Use equivalent logic in the proxy server to turn the integration test green.

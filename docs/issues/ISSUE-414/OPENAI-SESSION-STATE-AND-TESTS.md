# Issue #414: OpenAI session state, component flow, and tests

**Purpose:** Align with the OpenAI Realtime API spec for session vs conversation state, document how the component passes state to the OpenAI proxy (vs Deepgram), identify tests that ensure we follow the spec, and note what is missing.

---

## 1. OpenAI API: session vs conversation (per API docs)

From [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime-conversations) and [Client events](https://platform.openai.com/docs/api-reference/realtime-client-events):

- **Session** is per WebSocket connection. The server sends `session.created` when the connection is ready; the client updates configuration with **`session.update`** (instructions, model, tools, voice, audio config). The server replies with **`session.updated`**. Session does **not** carry conversation history.
- **Conversation** is the ordered list of items (messages, function calls, etc.) in the current session. History is populated by the client using **`conversation.item.create`** — "Add a new Item to the Conversation's context… can be used both to **populate a 'history' of the conversation** and to add new items mid-stream." User messages use `input_text`; assistant messages use `output_text`.

So per OpenAI:

- **Session** = config only (no state across connections).
- **Conversation** = context/history, provided via `conversation.item.create` (after session is configured).
- **Order:** `session.update` → wait for `session.updated` → then send `conversation.item.create` for each prior message (and for new user messages).

OpenAI does not specify a "session ID" for reconnecting to the same server-side session; each WebSocket is a new session. So "same session" continuity is achieved by the **client** sending full state (conversation history) on each new connection.

---

## 2. Deepgram vs OpenAI: how the component passes state

| | Deepgram (direct) | OpenAI (via proxy) |
|--|-------------------|-------------------|
| **Backend model** | Stateless per connection; component sends **entire state** in one place. | Same: each connection is a new upstream session; **conversation** state is not in session, it is sent as items. |
| **Where state goes** | **Settings** includes `agent.context.messages` (conversation history). Deepgram accepts it in Settings. | **Settings** includes the same `agent.context.messages`. Proxy does **not** put context in `session.update` (per OpenAI spec). Proxy stores context and, **after** `session.updated`, sends each message as **`conversation.item.create`** to upstream. |
| **Component behavior** | Single protocol: one **Settings** message with optional `agent.context`. | **Same** protocol: component sends the same Settings (including `agent.context`) to the proxy. No separate "OpenAI path" in the component. |
| **Greeting** | When context is present, component omits greeting (Issue #234). | Same: when `agent.context.messages.length > 0`, component omits greeting. Proxy never sends greeting as `conversation.item.create` (assistant) to upstream (OpenAI rejects client-created assistant items). |

So: the component **does** pass state to the OpenAI proxy in the way the API expects — full conversation context in the first message (Settings), which the proxy then translates into `session.update` (config only) plus `conversation.item.create` (history) after `session.updated`. The difference is **where** that state is expressed on the wire (Deepgram: inside Settings; OpenAI: session.update + conversation.item.create), which is handled entirely by the proxy.

---

## 3. Component flow (summary)

1. **Component** builds one **Settings** message from `agentOptions` (instructions, functions, **context** from e.g. `conversationHistory` / `conversationStorage`, and optionally greeting when context is empty).
2. **On connect**, component sends Settings first (same for Deepgram and proxy).
3. **Proxy** on Settings:
   - Maps Settings → **session.update** (no context in session).
   - Stores **context** and **greeting**; on **session.updated** sends each context message as **conversation.item.create** (user → `input_text`, assistant → `output_text`), then sends **SettingsApplied** and greeting as **ConversationText** to client only (no greeting item to upstream).
4. **Test-app** passes **context** via `agentOptions.context` from `conversationForDisplay`, which is synced from the component’s conversation history (and optionally from callbacks with updated history). So when the user reconnects after reload, the app can send restored history **if** that state is available before the first Settings (see gaps below).

---

## 4. Tests that ensure OpenAI spec behavior

### 4.1 Unit tests (`tests/openai-proxy.test.ts`)

- **Settings → session.update:** Instructions, model, tools from Settings map to `session.update`; no context in session.
- **Context → conversation.item.create:** User message → `input_text`; assistant message → `output_text`.
- **session.updated → SettingsApplied.**
- **InjectUserMessage → conversation.item.create** (user, `input_text`).
- **FunctionCallResponse → conversation.item.create** (function_call_output).

### 4.2 Integration tests (`tests/integration/openai-proxy-integration.test.ts`)

- **Settings → session.update, session.updated → SettingsApplied** (wire contract).
- **Context only after session.updated:** "sends Settings.agent.context.messages as conversation.item.create to upstream" with **mockEnforceSessionBeforeContext**: mock delays `session.updated`; proxy must not send any `conversation.item.create` before `session.updated` (protocol error if it does).
- **Order:** "Protocol: client message queue order (session.update then conversation.item.create)" — upstream receives `session.update` then `conversation.item.create` (e.g. for InjectUserMessage).
- **session.created** does not trigger SettingsApplied or context/greeting injection; only **session.updated** does.
- **Greeting** is sent to client as ConversationText only; no greeting as `conversation.item.create` to upstream.
- **Context + greeting:** Only context items sent to upstream; greeting is text-only to client.
- **Duplicate Settings:** Only first Settings causes `session.update`; duplicate gets SettingsApplied only, no second `session.update`.
- **response.create** only after item confirmation (e.g. conversation.item.added) for InjectUserMessage; same item id counted once.

### 4.3 E2E tests (`test-app/tests/e2e/`)

- **openai-proxy-e2e.spec.js:** Basic flow, reconnection with context (test 7), repro after reload (test 9).
- **context-retention-with-function-calling.spec.js:** Reconnect with context in Settings; asserts context present in captured Settings and greeting not included when context exists.
- **context-retention-agent-usage.spec.js:** Agent uses context after reconnect.

These tests ensure: (1) context is sent in Settings when reconnecting, (2) proxy sends context as `conversation.item.create` after `session.updated`, (3) ordering and wire contract match the proxy protocol doc and OpenAI’s session/conversation model.

---

## 5. What is missing or to clarify

### 5.1 "Same session" and proxy accommodation

- **OpenAI:** No server-side "reconnect to same session by ID"; each WebSocket is a new session. So "same session" means: the **component** (or app) retains and resends full state; the **proxy** applies it correctly (session.update + conversation.item.create after session.updated). The proxy **does** accommodate that: it does not need to "keep" session state across client reconnects; it just must translate the client’s first Settings (with context) into the correct OpenAI sequence. That is already implemented.
- **Optional enhancement:** If in the future the proxy wanted to support a **server-side** notion of "same session" (e.g. session ID in Settings, proxy reusing or reattaching to an upstream session), that would be an extension. Today, "same session" is client-driven: component passes full state, proxy forwards it per spec.

### 5.2 Greeting on reload

- After a full page reload, the **first** connection may send Settings **before** restored conversation is available in the app (e.g. `conversationForDisplay` is still empty because it’s synced from the component ref after a 300ms timeout and/or after storage restore). So the first Settings can have **no context** and **include greeting**. The proxy then sends greeting; the user sees it. Fix options: (1) Ensure context is restored and set (e.g. from storage) **before** the first Settings (e.g. delay connect until restore completes), or (2) Proxy: when Settings contains non-empty context, treat as continuation and do not send greeting (currently component already omits greeting when context exists; the race is app-side restoration timing).

### 5.3 Optional: `previous_item_id` (OpenAI API)

- The OpenAI client event **conversation.item.create** supports optional **previous_item_id** for explicit ordering. We currently send context items in array order without it; the proxy sends them in sequence after `session.updated`, which preserves order. If we ever need to insert items mid-conversation or rely on server-side ordering guarantees, we could add tests and support for **previous_item_id** using IDs from upstream (e.g. from `conversation.item.added`).

### 5.4 Explicit test: "component sends context in Settings for proxy"

- Integration tests assert proxy behavior (context in Settings → conversation.item.create after session.updated). We have E2E tests that assert context in captured Settings after reconnect. A dedicated unit or integration test that **only** checks "when component sends Settings with agent.context.messages, proxy receives them and forwards as conversation.item.create after session.updated" is already covered by the existing integration test "sends Settings.agent.context.messages as conversation.item.create to upstream". No new test strictly required unless we want a component-level test that builds Settings (as the component does) and sends to a mock proxy and asserts the mock receives the expected upstream events.

---

## 6. References

- OpenAI Realtime: [Realtime conversations](https://platform.openai.com/docs/guides/realtime-conversations), [Client events](https://platform.openai.com/docs/api-reference/realtime-client-events) (session.update, conversation.item.create).
- Proxy protocol: `scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md`.
- Protocol test gaps: `docs/issues/ISSUE-414/PROTOCOL-TEST-GAPS.md`.
- Component Settings (context, greeting): `src/components/DeepgramVoiceInteraction/index.tsx` (`sendAgentSettings`), Issue #234 (omit greeting when context present).
- Translator: `scripts/openai-proxy/translator.ts` (mapSettingsToSessionUpdate, mapContextMessageToConversationItemCreate); `scripts/openai-proxy/server.ts` (context after session.updated, no greeting to upstream).

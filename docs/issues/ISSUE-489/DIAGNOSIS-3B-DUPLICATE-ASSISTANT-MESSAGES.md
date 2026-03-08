# Diagnosis: Test 3b – Duplicate Assistant Messages (5 instead of 3)

**Observed:** After reconnect, the DOM shows 5 assistant messages instead of 3. Expected: greeting + r1 (Paris) + r2 (“What did I just say?”). Actual order:

1. assistant: Hello! How can I assist you today?
2. user: What is the capital of France?
3. assistant: The capital of France is Paris. […]
4. assistant: Hello! How can I assist you today?  ← **duplicate**
5. assistant: The capital of France is Paris. […]  ← **duplicate**
6. user: What did I just say?

So the **greeting** and **r1 (Paris)** each appear twice. Below is the cause, traced through the proxy.

---

## Cause 1: We send the greeting again on reconnect (proxy)

**Where:** `server.ts` – when we handle `session.updated`, we send the greeting to the client if `storedGreeting` is set.

**Flow:**

1. On **reconnect**, the client sends **Settings** with `agent.context.messages = [greeting, user1, r1]` and typically `agent.greeting` set to the same greeting string.
2. We set `storedGreeting = settings.agent?.greeting` (same line as we handle context).
3. When **session.updated** arrives, we send `SettingsApplied` to the client, then inject context items into the API, then:

   ```ts
   if (storedGreeting) {
     clientWs.send(JSON.stringify(mapGreetingToConversationText(storedGreeting)));
     // ...
   }
   ```

4. The client **already has** that greeting in its conversation history (it was in context). So we send the same greeting again → **first duplicate greeting**.

**Conclusion:** On reconnect we should not send `storedGreeting` to the client when we also sent context that already includes that greeting. The client’s history already has it.

---

## Cause 2: We forward the API’s echo of the context items (proxy)

**Where:** We inject context into the API, then we forward every `conversation.item.*` (created/added/done) as ConversationText to the client.

**Flow:**

1. On reconnect, Settings includes `agent.context.messages = [greeting, user1, r1]`.
2. We push one `conversation.item.create` per context message (so **three** items: greeting, user1, r1) into `pendingContextItems`.
3. On **session.updated** we send those three creates to the API (lines 467–469).
4. The API adds those items to the conversation and, per its protocol, emits **conversation.item.added** or **conversation.item.done** for each (it reflects the conversation state).
5. For each of those events we call `mapConversationItemAddedToConversationText` and, if we get a ConversationText, we send it to the client (lines 661–698).
6. The client **already had** those messages before disconnect (they are the same context we just sent). So we send:
   - ConversationText for the **greeting** again → **second duplicate greeting**
   - ConversationText for **r1 (Paris)** again → **duplicate r1**
   - ConversationText for **user1** again → duplicate user (test only asserts assistant count, but the same mechanism applies).

**Conclusion:** The API is echoing the context items we injected. We treat those echoes like any other conversation.item and forward them as ConversationText. We should not send ConversationText to the client for items that are just the API’s echo of the context we sent on this connection (i.e. we need to treat “context replay” differently from “new” assistant/user messages).

---

## Summary

| Duplicate | Source | Mechanism |
|-----------|--------|-----------|
| Extra greeting #1 | Proxy | We send `storedGreeting` to the client on `session.updated` even when context already contains that greeting (reconnect). |
| Extra greeting #2 | API echo | We inject context including the greeting via `conversation.item.create`; API sends `conversation.item.*` for it; we map and send as ConversationText. |
| Extra r1 (Paris) | API echo | We inject r1 via `conversation.item.create`; API sends `conversation.item.*` for it; we map and send as ConversationText. |

So the duplication is not “the API sends duplicates”; it is:

1. **We** send the greeting again on reconnect when we have context that already includes it.
2. **We** forward the API’s echo of the context items (greeting, user1, r1) as ConversationText, even though the client already has those messages.

---

## Fix applied (do not inject context as items)

We should **not** inject prior-session context as normal user/assistant conversation items. The proxy was changed to:

1. **Pass context in session instructions only**  
   `mapSettingsToSessionUpdate` now uses `buildInstructionsWithContext(settings)`: when `Settings.agent.context.messages` is present, the prior conversation is appended to the session `instructions` (e.g. “Previous conversation:\nuser: …\nassistant: …”). The model receives context via the system prompt, not via `conversation.item.create`.

2. **Stop sending conversation.item.create for context**  
   The proxy no longer pushes context messages into `pendingContextItems` or sends them to the API after `session.updated`. So the API never receives those items and never echoes them back → no duplicate ConversationText from context replay.

3. **When context was sent, do not send greeting again**  
   If the last Settings included `agent.context.messages`, the proxy sets `hadContextInLastSettings`. On `session.updated` it does not send the greeting to the client (they already have it in history).

Result: no duplicate greeting from our side, and no API echo of context items, so the client should see exactly 3 assistant messages (greeting + r1 + r2) in test 3b.

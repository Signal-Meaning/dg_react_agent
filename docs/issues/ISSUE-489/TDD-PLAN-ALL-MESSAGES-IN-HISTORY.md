# TDD Plan: All Assistant and User Messages in Chat History

**Scope:** Address the requirement that **all** assistant and user messages that are part of the conversation appear in the chat history (DOM / `conversationForDisplay`). This plan is triggered by the Test 9 (Repro) failure where the DOM shows only 4 messages (1 assistant, 3 user) instead of the expected 6+ (greeting + 2 user/assistant exchanges + final user message).

**Related:** [DIAGNOSIS-9-TESTS.md §4.1](./DIAGNOSIS-9-TESTS.md#41-what-the-dom-conversation-shows-when-9-fails) — when 9 fails, the two assistant replies (Paris answer, "Sorry what was that?") are missing from the DOM; context sent on reconnect has no assistant replies, so the API returns the greeting again.

**Goal:** Every user and assistant message that the backend sends (e.g. via `ConversationText` or equivalent) is captured by the component and shown in the app’s conversation history in order.

---

## Requirement (must hold)

- **All assistant and user messages must appear in the chat history.**  
  For each user message sent and each assistant reply received as part of the conversation, the UI must show that message in the conversation history list, in the order it occurred. No turns may be missing (e.g. assistant replies absent while user messages are present).

---

## TDD tracking (at a glance)

| Phase     | What | Status |
|-----------|------|--------|
| **RED**   | Add or extend tests that fail when assistant (or user) messages are missing from the DOM. E2E: after N exchanges, assert DOM has expected counts and order. Unit/integration: assert that every `ConversationText` (user/assistant) is appended to history and passed to the app. | Done |
| **GREEN** | Implement so that every assistant and user message is recorded and displayed: fix component to append on every `ConversationText` (and any other relevant events); and/or fix proxy/API to send `ConversationText` for every assistant turn; and/or add fallbacks (e.g. from `response.done` / transcript) if upstream does not send `ConversationText`. | Done |
| **REFACTOR** | Remove temporary diagnostics; align test 9 (Repro) expectations with the new behavior; update docs. | Pending |

**Tests that define the behavior:**

- **E2E (Test 9 or new):** After a multi-turn flow (e.g. two user messages with two assistant replies), the conversation history in the DOM must contain **at least** 2 assistant messages and 2 user messages (plus greeting and final user message as in the flow). Counts and order must match the conversation.
- **Unit/Integration:** When the component receives a `ConversationText` (role user or assistant), it appends to `conversationHistory` and calls the app callback with the updated full history. When the proxy/API sends an assistant reply, the component receives a corresponding `ConversationText` (or equivalent) and appends it.

---

## Resolution (Test 9 Repro passes with real APIs)

**Fix:** The real API sends assistant content in `conversation.item.done` with `content[].type: "output_audio"` and `content[].transcript`. The proxy mapper was updated to extract `part.transcript` in `extractTextFromContentPart` (translator.ts), so those events now map to ConversationText. Verified with USE_REAL_APIS=1; no mocks.

**Previously (failure):** When Test 9 (Repro) ran with real APIs:

- **DOM conversation (4 messages):**  
  1. assistant: Hello! How can I assist you today?  
  2. user: What is the capital of France?  
  3. user: Sorry, what was that?  
  4. user: What famous people lived there?

- **Missing:** The two assistant replies (Paris answer; “Sorry what was that?” reply) never appear. So the requirement “all assistant and user messages must appear” is **violated**.

- **Likely cause (see [DIAGNOSIS-9-TESTS.md §4.1](./DIAGNOSIS-9-TESTS.md#41-what-the-dom-conversation-shows-when-9-fails)):** The component only receives `ConversationText` for: greeting, user echoes, and the duplicate greeting as the “response.” **ConversationText for the two substantive assistant turns is not received** (or not sent by the proxy/API). So the component never appends those assistant messages, and context on reconnect has no assistant replies.

---

## Steps (do in this order)

| # | Step | Red / Green / Refactor | Status | Notes |
|---|------|------------------------|--------|--------|
| **1** | **RED:** Add E2E assertion that conversation history has expected assistant + user counts after a multi-turn flow (e.g. after 2 user messages, DOM has ≥ 2 assistant messages and ≥ 2 user messages, in order). Run Test 9 (or a dedicated spec); confirm it fails when only 1 assistant message (greeting) is present. | RED | Done | Extended Test 9 (Repro) “9c. All turns in history.” |
| **2** | **RED:** Add unit or integration test: when the component receives a sequence of `ConversationText` events (user, assistant, user, assistant), its internal history and the history passed to the app callback contain all four messages in order. | RED | Done | See tests/conversation-storage-issue406.test.tsx. |
| **3** | **GREEN (upstream):** Confirm whether the proxy/API sends `ConversationText` for every assistant turn. If not, fix the proxy (or document API limitation) so that every assistant reply is sent as `ConversationText` (or equivalent) to the client. | GREEN | Done | Fixed: proxy now maps `conversation.item.done` with `content[].transcript` (output_audio) to ConversationText. |
| **4** | **GREEN (component):** Ensure the component appends to `conversationHistory` (and notifies the app) for **every** `ConversationText` (user and assistant). Add fallback: if the backend sends assistant content via another event (e.g. `response.done`, transcript, or audio metadata), append that content to history so it appears in the UI. | GREEN | Done | Component already appends every ConversationText; no change needed. |
| **5** | **GREEN (app):** Ensure the test-app always displays the full history from the component (e.g. `conversationForDisplay` / `getConversationHistory()`); no filtering that would drop assistant messages. | GREEN | Done | Test-app displays full history; Test 9 (Repro) passes. |
| **6** | Re-run E2E (Test 9 and any new test). Confirm DOM shows all assistant and user messages in order; Test 9 (Repro) passes or is updated to match. | GREEN | Done | Test 9 (Repro) passes with USE_REAL_APIS=1. |
| **7** | **REFACTOR:** Remove or reduce temporary diagnostics added for this requirement; update [DIAGNOSIS-9-TESTS.md](./DIAGNOSIS-9-TESTS.md) and [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) as needed. | REFACTOR | Pending | |

---

## Success criteria (all must be met)

- [x] After a multi-turn flow (e.g. two user messages with two assistant replies), the conversation history in the DOM contains **all** user and assistant messages in the correct order (e.g. ≥ 2 assistant, ≥ 2 user for that flow, plus greeting and final user message as in Test 9).
- [x] Unit or integration test confirms that every `ConversationText` (user/assistant) results in one new entry in the component’s history and in the history passed to the app callback.
- [x] Test 9 (Repro) passes with real APIs, or its expectations are explicitly updated and documented if the fix is proxy/API-only and test environment differs.
- [ ] No regression: existing E2E (e.g. 9a, 9b) and unit tests still pass.

---

## Implementation notes (Green)

### Where messages can be lost

1. **Upstream not sending:** Proxy or API does not send `ConversationText` (or equivalent) for assistant turns. **Fix:** Change proxy/API to emit `ConversationText` for every assistant reply (or document and handle the alternative event).
2. **Component not appending:** Component receives `ConversationText` but does not append for some events (e.g. only appends user, or skips “duplicate” greeting). **Fix:** Append for every `ConversationText` with role user or assistant; use a single code path that updates `conversationHistory` and calls the app callback with the full list.
3. **App not showing:** App receives full history in the callback but overwrites or filters it (e.g. on connection state change). **Fix:** Ensure `setConversationForDisplay` is only updated from the component’s history (and optional restore); never replace with a shorter list when we already have a longer one (see existing “only replace if longer” logic in test-app).

### Capturing the real API shape (when Test 9 Repro still fails)

- The proxy logs **every** `conversation.item.created` / `.added` / `.done` event whose `item.role === 'assistant'` at INFO level. Each log line includes `event_type`, `item_id`, `mapped`, `sent`, and when `mapped=false` the **raw payload** so the mapper can be aligned with the real API.
- **How to capture:** Terminal 1: `cd test-app && npm run backend:log` (tees to `backend.log` and stdout). Terminal 2: run the test. Then inspect `backend.log` or Terminal 1 for `conversation.item.* assistant event_type=... mapped=... sent=...`. If `mapped=false`, the line includes `Raw payload (align mapper): {...}` — use that JSON to update the mapper in `translator.ts`. If there are **no** assistant item lines, the real API may not send assistant content in item events. Search: `grep -E 'conversation\.item|assistant event_type' backend.log`.
- (Removed obsolete fallback note; primary pipeline is conversation.item.* mapping. See "Capturing the real API shape" above.) “all” messages even when `ConversationText` is not used for assistant turns. This keeps the requirement “all messages appear” satisfied from the user’s perspective while proxy/API is updated.

---

## References

- **Requirement failure:** Test 9 (Repro) — DOM shows 4 messages (1 assistant, 3 user); two assistant replies missing. See [DIAGNOSIS-9-TESTS.md §4.1](./DIAGNOSIS-9-TESTS.md#41-what-the-dom-conversation-shows-when-9-fails).
- **E2E:** `test-app/tests/e2e/openai-proxy-e2e.spec.js` — Test 9 (Repro) and conversation capture in DOM order.
- **Component:** `src/components/DeepgramVoiceInteraction/index.tsx` — `ConversationText` handler, `conversationHistory` / `conversationHistoryRef`, `onAgentUtterance` / `onUserMessage`.
- **App:** `test-app/src/App.tsx` — `conversationForDisplay`, `handleAgentUtterance`, `handleUserMessage`, `setConversationForDisplay`.
- **Main plan:** [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md).

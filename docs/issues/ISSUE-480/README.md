# Issue #480: OpenAI proxy – Settings.context.messages translated so model sees prior turns (voice-commerce #951)

**GitHub:** [#480](https://github.com/Signal-Meaning/dg_react_agent/issues/480)

**Partner:** voice-commerce [voice-commerce #951](https://github.com/Signal-Meaning/voice-commerce/issues/951) — handoff requested that the OpenAI translation proxy make conversation history (from Settings) available to the OpenAI model so follow-up messages are contextualized **without** the app prepending context into the user message text.

---

## What we're doing

We investigated why **voice-commerce** sees the model ignore prior context when using the OpenAI proxy, even though they pass `agentOptions.context` and our real-API integration test (same proxy, same API) shows context working. We requested a WebSocket trace; they shared it. **Finding:** in that trace no Settings message includes conversation history for the follow-up (only one Settings on connect, then two InjectUserMessages), so the proxy never received `agent.context.messages` for "how about green?". When a reconnection is made, the app must send context in Settings (pass `agentOptions.context` with the conversation history so the new connection gets it). No further trace request needed (see [Trace analysis](#trace-analysis-2026-02-24) below).

---

## Summary

When the app sends **Settings** with `context.messages` (conversation history), the **OpenAI translation proxy** must make that history available to the OpenAI model (e.g. via session/conversation items) so that follow-up user messages are contextualized without the app mutating message text.

Today the app must prepend context into the user message string (e.g. `[Context: User previously said: "…".] <user message>`), which is the wrong layer and brittle. The app already passes `agentOptions.context` when (re)connecting; the component sends it in Settings. Deepgram uses it; the OpenAI proxy should translate Settings.context so the model sees prior turns.

---

## Expected behavior

- App sends Settings with `context.messages` (or equivalent) on connect / reconnection.
- Proxy translates that into whatever the OpenAI Realtime API expects for conversation history.
- User sends a follow-up message (e.g. "how about green?" after "I need blue suede shoes"); the model receives the follow-up with prior context and responds accordingly. **No** prepending of context into message text by the app.

---

## Current implementation (for investigation)

- **Component (dg_react_agent):** Sends Settings with `agent.context` in Deepgram API format (`context.messages` array of `{ role, content }`) when `agentOptions.context` is provided on connect/reconnection. See `sendAgentSettings()` in `src/components/DeepgramVoiceInteraction/index.tsx` and `docs/issues/ISSUE-183-CONTEXT-SUPPORT.md`.
- **OpenAI proxy (voice-agent-backend):** Implements translation of `Settings.agent.context.messages` to OpenAI `conversation.item.create` events (user → `input_text`, assistant → `output_text`), deferred until after `session.updated` to satisfy API ordering. See `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (Settings handler and `session.updated` branch), `translator.ts` `mapContextMessageToConversationItemCreate`, and `PROTOCOL-AND-MESSAGE-ORDERING.md`.
- **Integration test:** `tests/integration/openai-proxy-integration.test.ts` includes **`itMockOnly('sends Settings.agent.context.messages as conversation.item.create to upstream', ...)`** (line ~1754). It uses **mock upstream only**; there is **no** real-API counterpart (`(useRealAPIs ? it : it.skip)(...'... context ...')`). So the context path is validated only against the mock — insufficient for real OpenAI Realtime API behavior and possibly incorrect (e.g. real API could reject or ignore client-sent context items).

---

## Voice-commerce answers (confirmed)

1. **Connection path:** OpenAI proxy; latest releases of dg_react_agent / voice-agent-backend.
2. **Context in Settings:** Yes. They pass `agentOptions.context` with `context.messages` into the component. Each item is `{ type: 'History', role: 'user' | 'assistant', content: string }` (same pattern as the component test-app). Built in App.tsx and passed as `agentOptions` whenever there is conversation history. They have not yet captured a WebSocket trace showing the first post-connect message as Settings with `agent.context.messages`; they can do that and share if needed.
3. **Observed behavior:** **(a) The model ignores prior context.** No error; the agent answers "how about green?" as a new request (no refinement of the previous search). Behaves as if there is no prior context.
4. **Prepend workaround:** Yes. They only prepend when `voiceAgentProvider === 'openai'` (when using the proxy). They do not prepend for Deepgram. The workaround is **required** for correct contextual follow-ups with the proxy today.

**Conclusion:** Bug is confirmed. With the proxy, context is passed in but the model does not see it; prepending is required only for the OpenAI path.

---

## Likely cause (hypothesis)

The proxy sends both **user and assistant** context messages to upstream as `conversation.item.create`. For the **greeting**, we already avoid sending an assistant item to the real API because it errors on client-created assistant messages (Issue #414). The real API may **ignore or drop** client-created assistant **context** items (or accept only user items). In that case the model would only see prior user turns, not assistant replies, so follow-ups like "how about green?" would have no useful context. Investigation should confirm via WebSocket trace and/or real-API test.

---

## Tasks / next steps

- [x] **Request WebSocket trace from voice-commerce:** Done; trace received and analyzed (see [Trace analysis](#trace-analysis-2026-02-24) above).
- [x] **Real-API integration test (TDD RED):** Added in `tests/integration/openai-proxy-integration.test.ts`. See [TRACKING.md](./TRACKING.md).
- [x] **TDD GREEN:** Real-API test passed in our env; proxy sends context.
- [x] **Trace analysis:** No Settings with `agent.context.messages` for the follow-up in this trace; single connection, no second Settings. Recommendation: when a reconnection is made, app must pass `agentOptions.context` with conversation history.
- [ ] **Respond to voice-commerce:** Share the finding and recommendation (when reconnecting, pass context in Settings; or we support mid-session Settings with context if they need follow-ups without reconnecting).
- [x] **Clarify docs and test-app:** Done. test-app README § "When is context sent to the backend?", "Basic Context Handling", "Reconnection Patterns", and "Important Notes"; PROTOCOL-AND-MESSAGE-ORDERING § 2.2; RUN-OPENAI-PROXY and BACKEND-PROXY README updated (see [Documentation and test-app clarity](#documentation-and-test-app-clarity)).
- [ ] **Document for partners:** How to pass `agentOptions.context` and that when a reconnection is made, context must be in the Settings message the proxy receives.

---

## Trace analysis (2026-02-24)

Voice-commerce shared a trace: **3 client-sent frames** on one connection.

| # | Message            | Content |
|---|--------------------|--------|
| 1 | **Settings**       | Body truncated. Visible: `agent.think.prompt` (instructions mentioning "conversation context"), `agent.idleTimeoutMs`, `audio`, etc. **`agent.context` / `agent.context.messages` not visible** in the truncated payload. |
| 2 | InjectUserMessage  | `"I need blue suede shoes"` |
| 3 | InjectUserMessage  | `"[Context: User previously said: \"I need blue suede shoes\".] how about green?"` (prepend workaround) |

**Finding:** In this trace, **no Settings message contains conversation history for the follow-up.** There is only one Settings (on connect). When the user sends "how about green?", the app does **not** send a second Settings with `agent.context.messages` containing the first turn (user "I need blue suede shoes" + assistant response). So the proxy never receives context for that follow-up; the model cannot see prior turns because the app never sent them in Settings.

**Root cause (app/protocol):** Context is sent to the proxy only in a **Settings** message (with `agent.context.messages`), and Settings is sent when a connection is established. Our proxy forwards only the first Settings per connection (no second `session.update`). So on a single connection, the backend never receives updated context. The trace shows a single connection and no second Settings, so context was never provided for "how about green?". When a reconnection does happen, the app must pass `agentOptions.context` with the conversation history so the new connection’s first message is Settings with context.

**Recommendation to voice-commerce:** When a reconnection is made (e.g. connection dropped, user returns to the app), the app **must** pass `agentOptions.context` with the conversation history so that the first message on the new connection is Settings with `agent.context.messages`. Otherwise the new connection has no context. If you need the model to see prior turns on a follow-up without reconnecting, we’d need to support and apply a mid-session Settings update with context (proxy + component change).

**Optional:** If they can share the **full** first Settings frame (untruncated), we can confirm whether `agent.context` was present but empty on connect.

---

## Follow-up (optional)

If voice-commerce can share the **full** first Settings frame (untruncated), we can confirm whether `agent.context` was present but empty on initial connect. Otherwise the next step is to **respond to voice-commerce** with the finding and recommendation (when reconnecting, pass context in Settings; or we implement mid-session Settings with context if they need follow-ups without reconnecting).

---

## Documentation and test-app clarity

**Our documentation and test-app sample are not clear enough on when context is sent and how to retain it with the OpenAI proxy.**

- **What we say today:** test-app README says "Pass conversation history through `agentOptions.context`. The component will automatically include it in the Settings message" and "Reconnection: … Context is preserved through agentOptions." We do **not** clearly state that:
  1. **Settings is sent once per connection** (when the WebSocket connects). The backend receives context only from that first Settings message.
  2. **If the app stays on one connection** and sends a follow-up (e.g. "how about green?" after "I need blue suede shoes"), the backend never receives an updated context — no second Settings is sent.
  3. **When a reconnection is made** (e.g. connection dropped, user returns), the app **must** pass `agentOptions.context` with the conversation history so that the new connection’s first message is Settings with `agent.context.messages`. Our E2E context-retention tests demonstrate this: when they reconnect, they pass context so the new connection gets it.
- **"Basic Context Handling" in test-app README** shows injecting context via `injectMessage` after start; that sends user messages, not context in Settings, and can be read as "inject history after connect" rather than "send history in the Settings that goes out on connect/reconnect."
- **Recommendation:** Clarify in test-app README (and optionally in BACKEND-PROXY or OPENAI proxy docs) that: (1) context is sent to the backend only in the **first** Settings message per connection; (2) when a reconnection is made, the app must pass `agentOptions.context` with the conversation history so the new connection gets context; (3) if follow-ups on the same connection need to be contextualized without reconnecting, we’d need mid-session Settings support.

---

## References

- Voice-commerce issue: https://github.com/Signal-Meaning/voice-commerce/issues/951
- API discontinuities (context): `docs/issues/ISSUE-381/API-DISCONTINUITIES.md` § 3.2 Context / session history
- Backend/proxy defects and partner-reported defects: `.cursorrules` (Backend / Proxy Defects, Release Qualification)
- Issue #406 (context before session.updated): proxy defers context until after `session.updated`; regression test in same integration test file.

# Issue #480: OpenAI proxy – Settings.context.messages translated so model sees prior turns (voice-commerce #951)

**GitHub:** [#480](https://github.com/Signal-Meaning/dg_react_agent/issues/480)

**Partner:** voice-commerce [voice-commerce #951](https://github.com/Signal-Meaning/voice-commerce/issues/951) — handoff requested that the OpenAI translation proxy make conversation history (from Settings) available to the OpenAI model so follow-up messages are contextualized **without** the app prepending context into the user message text.

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

- [ ] **WebSocket trace:** Confirm with voice-commerce (or capture ourselves) that the first message after connect is Settings with `agent.context.messages` and that the proxy sends `conversation.item.create` after `session.updated`.
- [ ] **Real-API integration test:** Add a test that runs with `USE_REAL_APIS=1`: send Settings with `agent.context.messages`, then InjectUserMessage; assert the model response is contextualized (or at least that no error occurs and context items are sent).
- [ ] **Fix or document:** From trace + real-API test, either fix the proxy (e.g. only user context to upstream and assistant context in instructions, or other approach per API behavior) or document the limitation and recommend prepending when using the proxy until supported.
- [ ] **Document for partners:** How to pass `agentOptions.context` and that the proxy translates it so prepending is unnecessary once the fix is in place.

---

## References

- Voice-commerce issue: https://github.com/Signal-Meaning/voice-commerce/issues/951
- API discontinuities (context): `docs/issues/ISSUE-381/API-DISCONTINUITIES.md` § 3.2 Context / session history
- Backend/proxy defects and partner-reported defects: `.cursorrules` (Backend / Proxy Defects, Release Qualification)
- Issue #406 (context before session.updated): proxy defers context until after `session.updated`; regression test in same integration test file.

# Issue #482: idle_timeout closes WebSocket before assistant bubble appears (voice-commerce #956)

**GitHub:** [#482](https://github.com/Signal-Meaning/dg_react_agent/issues/482)

**Partner:** voice-commerce [voice-commerce #956](https://github.com/Signal-Meaning/voice-commerce/issues/956) — when using the OpenAI proxy, the agent can speak or complete a function call but the assistant message bubble never appears in the conversation UI; console shows `idle_timeout` and WebSocket close immediately after or during the response.

---

## Summary

When using the **OpenAI proxy** (`wss://backend/api/openai/proxy`), the agent may process a user message (TTS, function call, or both), but the **assistant message bubble does not appear** in the conversation. The client sees an `idle_timeout` error and WebSocket close (e.g. `code=1005`, `wasClean=true`). The connection closes and the settings flag is reset before or without the UI committing the final assistant turn.

**Expected:** If the agent has finished speaking or completed a function call, the corresponding assistant message bubble should appear before or regardless of a subsequent `idle_timeout`/WebSocket close.

**Objective (broader):** Identify why the component can **disconnect (idle timeout) despite the agent or user being active** — so that we can fix both “bubble never appears” and “timeout while active.” See **[CAUSE-INVESTIGATION.md](./CAUSE-INVESTIGATION.md)** for identified causes (proxy not sending agent-activity messages, ConversationText not resetting client timeout, server idle definition, message ordering).

---

## Observed sequence (voice-commerce)

1. User sends a message (e.g. about exercise pools or laptops).
2. Agent processes the request (may call `search_products` or respond verbally).
3. Console: `❌ [FUNCTION DEBUG] Error received after sending Settings with functions: with "code\": \"idle_timeout\"`.
4. WebSocket closed: `code=1005`, `reason=''`, `wasClean=true` – `{ service: "agent" }`.
5. Connection state → closed; settings flag reset.
6. **Assistant bubble for that turn never appears**, even though the agent had spoken or completed the function call.

---

## Environment

- Frontend: Buy with Voice v1.9.0 (e.g. Built: 2026-02-22)
- Backend: v1.8.0 (e.g. Built: 2026-02-22)
- Provider: OpenAI (proxy mode)
- Endpoint: `wss://localhost:3001/api/openai/proxy`

---

## Possible causes

1. **Idle timeout fires on server/proxy** before the client has rendered the final assistant message (upstream sends `error` and/or closes the connection before or without sending the final `response.output_text.done`).
2. **Message/event ordering:** The close event (or the Error message with `idle_timeout`) is processed before the UI has added the assistant bubble (e.g. last `ConversationText` and close/Error arrive in quick succession; close/Error handling resets state or prevents the last message from being committed).
3. **Frontend not persisting/displaying** the last assistant chunk when the connection closes immediately after (e.g. no flush of in-flight ConversationText on close).

**Ownership (suggested):** Proxy (idle timeout / connection lifecycle) and/or Component (when/where assistant message is committed to UI before close). App can only work around by persisting last response on close; correct fix is upstream.

---

## Current behavior (reference)

- **Proxy:** Forwards upstream messages in order. On upstream `error` that matches idle timeout, maps to component `Error` with `code: 'idle_timeout'` and sends to client; upstream may then close the connection. See `server.ts` (error handling), `translator.ts` (`isIdleTimeoutClosure`, `mapErrorToComponentError`), `PROTOCOL-AND-MESSAGE-ORDERING.md` §3.9.
- **Component:** Treats `idle_timeout` (and `session_max_duration`) as expected closure: logs only, does not call `onError`. ConversationText is applied to conversation history and `onAgentUtterance` in the same handler that receives messages; if the WebSocket closes or Error is processed before the last ConversationText is received or applied, the bubble will not appear. See `index.tsx` (Error handler ~2576–2585, ConversationText handler ~2261–2308).

---

## Tasks / next steps

- [x] **Failing test (TDD RED):** Two tests in `tests/integration/openai-proxy-integration.test.ts`. **(1) Real API first:** `Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout)` — runs with `USE_REAL_APIS=1`; send message, wait for response and idle_timeout; assert ConversationText before Error. **(2) Then mocks:** `Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done` — mock sends `error` then `response.output_text.done`; same assertion. Run order: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #482"` (must fail), then without env (mock-only run, must fail).
- [ ] **Reproduce:** Capture proxy and client logs for a run where the bubble is missing (voice-commerce scenario or local with real API).
- [ ] **Determine ordering:** Whether upstream sends `response.output_text.done` (and proxy sends ConversationText) before or after `error`/close; whether client processes close/Error before the last ConversationText.
- [ ] **Fix (proxy and/or component):** e.g. ensure final assistant message is sent and delivered before closing, or ensure component commits/flushes last assistant content on expected closure (`idle_timeout` / `session_max_duration`).
- [ ] **Tests:** Add integration and/or E2E coverage for “assistant bubble visible before or on idle_timeout close” (per .cursorrules: partner-reported defects require coverage that exercises the partner’s scenario).
- [ ] **Respond to voice-commerce** with resolution and release.

---

## References

- Voice-commerce issue: https://github.com/Signal-Meaning/voice-commerce/issues/956
- Proxy idle timeout: `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` §3.7, §3.9; `server.ts` error handling; `translator.ts` `isIdleTimeoutClosure`, `mapErrorToComponentError`
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` (Error expected-closure handling, ConversationText → `setConversationHistory` / `onAgentUtterance`)
- Backend/proxy defects and partner-reported defects: `.cursorrules` (Backend / Proxy Defects, Release Qualification)

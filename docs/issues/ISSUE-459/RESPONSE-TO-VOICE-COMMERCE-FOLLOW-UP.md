# Response to voice-commerce: conversation_already_has_active_response still occurs on 0.9.1 / 0.2.1

**For:** voice-commerce  
**From:** dg_react_agent team  
**Re:** [Bug report](./DEFECT-REPORT-DG-REACT-AGENT-SESSION-UPDATE-RACE.md) follow-up (error still occurs after upgrading to 0.9.1 / 0.2.1)  
**Date:** 2026-02-16  

---

## Summary

Yes — **0.9.1 (voice-agent-react) and 0.2.1 (voice-agent-backend)** are intended to address the `conversation_already_has_active_response` issue (Issue #459). We’re sorry the error is still occurring on your side and we want to track down any remaining path or timing.

Below is what we changed, what we’d like from you to investigate, and how we can work together next.

---

## What we fixed in 0.9.1 / 0.2.1 (Issue #459)

1. **Gating `session.update` on “no active response”**  
   The OpenAI proxy no longer sends `session.update` to upstream when it considers a response to be in progress. If the first Settings arrives while a response is active, the proxy sends `SettingsApplied` to the client and does **not** send `session.update` to the API (avoids triggering this error from that path).

2. **Tracking “response in progress” for all paths**  
   We set `responseInProgress = true` whenever we send `response.create`:
   - Audio path (commit + `response.create`)
   - **Function-call path** (when we send the host’s `FunctionCallResponse` → `conversation.item.create` + `response.create`)
   - Inject-user-message path (after `conversation.item.added`, when we send `response.create`)

3. **Clearing “response in progress” on completion**  
   We set `responseInProgress = false` when we receive either:
   - `response.output_text.done`, or  
   - `response.output_audio.done`  
   so we don’t send a new `session.update` until the current turn is done.

So in our design, the “user message → function call → host sends result” flow should not send `session.update` while that function-call response is in progress. If the error still appears, we need to find another code path or timing.

---

## What would help us investigate

1. **Proxy logs (voice-agent-backend)**  
   With `OPENAI_PROXY_TTS_BOUNDARY_DEBUG` or normal proxy logging, can you capture a log sequence for **one** run where the error occurs (from connection open through the function-call flow until `onError` with `conversation_already_has_active_response`)?  
   We’re especially interested in:
   - How many times we send `session.update` (should be once per connection before the function-call response).
   - How many times we send `response.create` for that turn (should be once for the function-call result).
   - Order of: Settings → session.updated → … → FunctionCallResponse → response.create → upstream events (e.g. `response.output_text.done` / `response.output_audio.done`) vs `error`.

2. **Possible double submission**  
   Can you confirm whether `sendFunctionCallResponse(id, name, content)` could ever be called **twice** for the same function call (e.g. retry, duplicate event handler, or React strict mode double-invocation)?  
   Sending the function-call result twice would mean we send `response.create` twice and could trigger this error even with the above fixes.

3. **Minimal repro (optional but very helpful)**  
   If you can share a minimal repro (e.g. small React app + backend that only does connect → one user message → one function call → one `sendFunctionCallResponse`), we can run it against 0.9.1/0.2.1 and reproduce the error with our proxy logs.

4. **E2E test**  
   If it’s possible to run your E2E test (`openai-provider.e2e.test.js`, grep `conversation_already_has_active_response`) in an environment where we can enable proxy/component debug logs (or you can attach logs from a failing run), that would also help.

---

## Next steps on our side

- We’ll review any logs or repro you can share and look for:
  - A second `session.update` in the same connection.
  - A second `response.create` for the same turn.
  - Any timing where we clear `responseInProgress` too early and then send `session.update` before the API considers the response done.
- If we find a gap (e.g. another completion event we should treat as “response done”, or a path that still sends `session.update` or `response.create` at the wrong time), we’ll propose a fix and track it in this repo (e.g. follow-up issue and patch release).

---

## Your workaround

Keeping your log sanitization for E2E (`error.code === 'conversation_already_has_active_response'` → log as e.g. `active_response_state_conflict`) is reasonable until we resolve this. We’ll update you when we have a fix or a clear root cause.

---

## References

- **Issue #459:** [README](./README.md), [INVESTIGATION](./INVESTIGATION.md), [TRACKING](./TRACKING.md)
- **Proxy behavior:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (`responseInProgress`, Settings gating, FunctionCallResponse path), [PROTOCOL-AND-MESSAGE-ORDERING.md](../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)
- **Integration tests:** `tests/integration/openai-proxy-integration.test.ts` (e.g. “Issue #459: does not send session.update while response is active”, “forwards only first Settings per connection”)

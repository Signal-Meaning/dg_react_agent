# Issue #470 – Investigation: conversation_already_has_active_response in function-call flow

**Date:** 2026-02  
**Outcome:** Root cause identified and fixed in proxy. E2E test 6b (partner scenario) was failing with the target error when run against real OpenAI API.

---

## Root cause

When the client sends **FunctionCallResponse**, the proxy was doing:

1. Send `conversation.item.create` (function_call_output) to upstream.
2. Send `response.create` immediately.

The OpenAI Realtime API still considers the **previous** response (the one that requested the function call) active until it has **processed** our `function_call_output` and closed that response (signalled by `response.output_text.done`). Sending `response.create` before that triggered:

`Conversation already has an active response in progress: resp_…. Wait until the response is finished before creating a new one.`

So the bug was **sending `response.create` too early** after function_call_output, not (only) clearing `responseInProgress` on `output_audio.done` (that was already fixed in #462).

---

## Fix (proxy)

**File:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts`

1. **Defer `response.create` after FunctionCallResponse**  
   On `FunctionCallResponse`: send only `conversation.item.create` (function_call_output). Set `pendingResponseCreateAfterFunctionCallOutput = true`. Do **not** send `response.create` here.

2. **Send `response.create` on the next `response.output_text.done`**  
   In the `response.output_text.done` handler: after clearing `responseInProgress`, if `pendingResponseCreateAfterFunctionCallOutput` is true, send `response.create`, set `responseInProgress = true`, clear the flag. Then continue with mapping to ConversationText and sending to client.

3. **Block `session.update` while waiting**  
   When deciding whether to forward Settings as `session.update`, treat `pendingResponseCreateAfterFunctionCallOutput` like `responseInProgress`: do not send `session.update` (send SettingsApplied to client instead).

---

## Tests

- **Integration (mock):** Mock updated so that when it receives `conversation.item.create` with `item.type === 'function_call_output'`, it sends `response.output_text.done` (so the proxy’s deferred `response.create` flow completes). All 40 openai-proxy-integration tests pass.
- **E2E (real API):** Run test 6b with real OpenAI proxy to confirm GREEN:  
  `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e --grep "6b.*462"` (from test-app).

---

## References

- Scenario: [SCOPE.md](./SCOPE.md)
- TDD plan: [TDD-PLAN.md](./TDD-PLAN.md)
- #462 ANALYSIS: [../ISSUE-462/ANALYSIS.md](../ISSUE-462/ANALYSIS.md)
- Protocol: `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md`

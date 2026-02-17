# Issue #478: Function-call tests do not assert presentation of agent response (result content)

**GitHub:** [#478](https://github.com/Signal-Meaning/dg_react_agent/issues/478)  
**Labels:** bug

---

## Summary

Function-calling tests use the real API path (real OpenAI, real proxy, real backend HTTP) and do not hardcode `FunctionCallResponse` in the client. However, they do **not** assert that the agent's reply actually **presents the function result to the user**.

## Current behavior

| Test | What it asserts |
|------|------------------|
| Integration (Issue #470 real-API: function-call flow) | Receives at least one `ConversationText` with `role: "assistant"` and non-empty content. |
| E2E 6 / 6b | `[data-testid="agent-response"]` is truthy and non-empty. |

So we demonstrate "we got a response" but **not** "the agent's follow-up that presents the function result to the user."

## Expected behavior

Tests should assert **presentation** of the agent response:

- **Integration:** Assert that the assistant `ConversationText` **content** includes the function result (e.g. `12:00` or `UTC`) so we verify the API delivered a reply that reflects the function-call result.
- **E2E:** Assert that the `agent-response` element **text** includes the function result (e.g. `12:00`) so we verify the user sees the agent's follow-up with the result.

## References

- **Integration test:** `tests/integration/openai-proxy-integration.test.ts` — *"Issue #470 real-API: function-call flow completes without conversation_already_has_active_response"*
- **E2E:** `test-app/tests/e2e/openai-proxy-e2e.spec.js` — tests 6 and 6b
- **Backend/proxy defect and partner-scenario coverage:** `.cursorrules`, [docs/issues/ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md](../ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md)

---

## Tracking

**Progress:** [TRACKING.md](./TRACKING.md) — checklist to add integration and E2E assertions for function-result content.

**Done:** Phase 1 (integration: assert assistant ConversationText includes 12:00 or UTC). Phase 2 (E2E: wait for agent-response to match /UTC|time/ then assert). Phase 3 in progress (full test run, then close #478).

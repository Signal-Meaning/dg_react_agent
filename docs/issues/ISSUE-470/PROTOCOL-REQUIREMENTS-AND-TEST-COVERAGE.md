# OpenAI Realtime API: Protocol Requirements and Test Coverage

**Purpose:** Capture protocol requirements we’ve learned (from docs, community, and failures), map them to tests, and identify gaps so we don’t repeat the #462/#470 class of bugs (ordering requirements not covered until a partner hit them on the real API).

**See also:** [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md), [ISSUE-388 OPENAI-REALTIME-API-REVIEW.md](../ISSUE-388/OPENAI-REALTIME-API-REVIEW.md), [BACKEND-PROXY-DEFECTS-REAL-API.md](../../../tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md).

---

## 1. Known protocol requirements (summary)

| # | Requirement | Source | How we learned |
|---|-------------|--------|----------------|
| 1 | **session.update only when no active response** | API error `conversation_already_has_active_response` | #459: client sent Settings while response active → error. We gate session.update on `responseInProgress`. |
| 2 | **Do not clear “response active” on output_audio.done alone** | Real API can send audio.done before text.done | #462: clearing on audio.done allowed a later Settings → session.update while API still had active response. We clear only on `response.output_text.done`. |
| 3 | **InjectUserMessage: send response.create only after item confirmed** | Docs: “After adding the user message to the conversation, send response.create” | #388: we wait for conversation.item.added (or .created/.done) before response.create. |
| 4 | **FunctionCallResponse: do not send response.create until previous response is done** | API error `conversation_already_has_active_response` | #470: we were sending response.create immediately after function_call_output; API still had previous response active until it processed our item and sent output_text.done. We now defer response.create until we receive that output_text.done. |
| 5 | **No conversation.item.create / context before session.updated** | Upstream errors on unconfigured session | #414: we defer context and greeting until session.updated. |
| 6 | **No input_audio_buffer.append before session.updated** | Session must be configured for audio | #414: we queue audio and flush after session.updated. |
| 7 | **Commit only when buffer has enough audio (e.g. ≥100ms)** | API “buffer too small” error | openai-audio-constants; we assert before commit. |
| 8 | **Only one response active at a time** | API “conversation already has an active response” | Community + #459/#462/#470; we track responseInProgress and pendingResponseCreateAfterFunctionCallOutput. |

Other documented behaviors we rely on: session max duration 60 min, idle timeout closure, Server VAD vs client commit (we disable Server VAD and commit from proxy), wire contract (only output_audio.delta as binary to client).

---

## 2. Test coverage matrix

| Requirement | Integration (mock) | Integration (real API) | E2E (real API) |
|-------------|--------------------|-------------------------|----------------|
| 1 – session.update only when no active response | ✅ Issue #459 test | — | — |
| 2 – clear responseInProgress only on output_text.done | ✅ Issue #462 test (mock sends audio.done then delayed text.done) | ✅ Same test with USE_REAL_APIS=1 (unified #462 test) | — |
| 3 – response.create only after item.added (InjectUserMessage) | ✅ Issue #388 test | — | Implied by openai-proxy-e2e |
| 4 – FunctionCallResponse: defer response.create until output_text.done | ✅ Mock sends output_text.done on function_call_output (Issue #470) | ✅ **Issue #470 real-API** (function-call flow integration test) | ✅ **Test 6b** (partner scenario) |
| 5 – No context before session.updated | ✅ session.created vs session.updated tests | — | — |
| 6 – No append before session.updated | ✅ Issue #414 tests | — | — |
| 7 – Min audio before commit | ✅ Buffer too small test | — | — |
| 8 – Only one response active | ✅ “at most one response.create per turn” test | — | Test 6b (strict 0 errors) |

**Gap:** Requirement 4 was **not** covered by any test that would fail on the real API before we added test 6b and the proxy fix. The mock did not simulate “API still has response active until it processes function_call_output and sends output_text.done.”

---

## 3. Recommendations

### 3.1 Re-audit OpenAI docs and samples periodically

- **When:** After any proxy change that touches client-event ordering or session/response state; at least when preparing a release that includes proxy changes.
- **What to check:**
  - [Client events](https://platform.openai.com/docs/api-reference/realtime-client-events): session.update, conversation.item.create, response.create, input_audio_buffer.* — any “must not … while …” or “after X, send Y”.
  - [Server events](https://platform.openai.com/docs/api-reference/realtime-server-events): order of response.*.done, conversation.item.*, session.*.
  - [Realtime conversations](https://platform.openai.com/docs/guides/realtime-conversations): lifecycle and “after adding the user message …”.
  - [Realtime VAD](https://platform.openai.com/docs/guides/realtime-vad): commit vs Server VAD, idle_timeout_ms.
  - Community: search for “conversation already has an active response”, “server had an error”, ordering, and function calling.
- **Output:** Update PROTOCOL-AND-MESSAGE-ORDERING.md and this matrix; add integration or E2E tests for any new ordering rule.

### 3.2 Add tests for “real-API-like” ordering where possible

- **Function-call flow:** We now have mock send `response.output_text.done` when it receives `function_call_output`, so the deferred response.create path is covered under mock. E2E test 6b covers the real-API partner scenario.
- **Other ordering:** If we discover more “do X only after server sends Y” rules, add mock behavior that simulates that order (e.g. delay a server event) and an integration test that would fail if we sent client event too early.

### 3.3 Require real-API qualification for proxy ordering changes

Per `.cursorrules` and [BACKEND-PROXY-DEFECTS-REAL-API.md](../../../tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md): backend/proxy defects must be qualified with real APIs; partner-reported defects must add coverage for the **reported scenario**. For any change that touches:

- when we send `session.update`, `response.create`, or `conversation.item.create`, or  
- when we clear `responseInProgress` or similar state,

run the relevant integration test with `USE_REAL_APIS=1` and/or the E2E partner-scenario test (6b) before release.

### 3.4 Optional: integration test for “defer response.create after function_call_output” with real API

Today we have:

- Integration: mock that sends output_text.done on function_call_output → proxy sends response.create on that event (passes).
- E2E 6b: full app + real proxy + real API, function-call flow, assert no conversation_already_has_active_response (real-API signal).

We could add an integration test that runs against the **real** API and asserts the same (no error containing conversation_already_has_active_response) for the function-call path only, without starting the full test-app. That would give a second real-API signal and faster feedback than E2E. Not required for #470; consider if we add more ordering rules later.

---

## 4. TDD plan for missing coverage

A concrete TDD plan for adding the missing tests (real-API integration for Reqs 1 and 4, optional for 3/5/6/7) is in **[TDD-PLAN-MISSING-REQUIREMENTS.md](./TDD-PLAN-MISSING-REQUIREMENTS.md)**. It uses Red → Green → Refactor per requirement and updates this matrix as each phase is done.

---

## 5. References

- **Our protocol doc:** `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md`
- **OpenAI:** Client events, Server events, Realtime conversations, Realtime VAD (links in §3.1)
- **Community:** e.g. [Conversation already has an active response](https://community.openai.com/t/realtime-api-server-response-error-message-conversation-already-has-an-active-response/1005582)
- **Policy:** `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md`, `.cursorrules` (Backend / Proxy Defects)

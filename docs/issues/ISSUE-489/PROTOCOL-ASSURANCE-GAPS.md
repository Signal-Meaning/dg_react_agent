# Critical Protocol Assurance Gaps (OpenAI Proxy)

This doc identifies **protocol assurances** that are either missing from the test suite or only covered by mock-based tests, so we cannot distinguish "real API never sent X" from "proxy bug" without running with logs or adding real-API tests.

**Reference:** [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md), [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](../ISSUE-470/PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md).

---

## Implemented real-API tests (Issue #489)

The following real-API integration tests were added in `tests/integration/openai-proxy-integration.test.ts`. Run with `USE_REAL_APIS=1` (and `OPENAI_API_KEY` set):

| Test name | Covers gap |
|-----------|------------|
| `Issue #489 real-API: client receives SettingsApplied within 10s of connect (session.updated)` | Session ready (gap #2) |
| `Issue #489 real-API: InjectUserMessage receives ConversationText (assistant) and AgentAudioDone` | InjectUserMessage → completion (gaps #4, #6) |
| `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)` | Proxy receives completion after FunctionCallResponse (gap #1, essential) |
| `Issue #489 real-API: client receives AgentStartedSpeaking before ConversationText (assistant) for a turn` | AgentStartedSpeaking before ConversationText (gap #5) |

---

## 1. Missing essential: proxy receives completion after FunctionCallResponse (real API)

**Assurance:** After the client sends `FunctionCallResponse`, the **proxy** receives from upstream at least one of: `response.output_text.done`, `response.output_audio.done`, or `response.done`. The proxy only sends "agent done" to the client when it receives one of these; if the real API never sends them, the component never transitions to idle and the idle timeout never runs.

**Current coverage:**
- **Mock:** Issue #487 protocol contract — client receives AgentThinking or ConversationText or AgentAudioDone within 2s of FunctionCallResponse (mock sends output_text.done on function_call_output).
- **Real API:** Issue #470 real-API function-call test — asserts no `conversation_already_has_active_response` and client receives assistant ConversationText.
- **Real API (added):** `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)` — asserts client receives AgentAudioDone within 60s after sending FunctionCallResponse (effect of proxy receiving response.done or response.output_text.done from upstream).

---

## 2. Other critical protocol assurances not covered by real-API tests

These are protocol guarantees the proxy depends on. For each, we either have no real-API test that asserts "proxy received upstream event X" (or "client received Y when using real API"), or we only have mock-based tests.

| # | Protocol assurance | What we need to assert | Current coverage | Gap |
|---|--------------------|------------------------|------------------|-----|
| **2** | **Session ready:** Proxy receives `session.updated` after sending `session.update` so it can send SettingsApplied and inject context. | With real API: proxy receives `session.updated` (or client receives SettingsApplied within N s of connect). | **Covered:** Issue #489 real-API test — client receives SettingsApplied within 10s of connect. | — |
| **3** | **InjectUserMessage → item confirmed:** Proxy receives `conversation.item.added` (or .created/.done) for the user item before sending `response.create`. | With real API: no `conversation_already_has_active_response` (we have this); optionally "proxy received item.added before response.create." | Issue #470 real-API Req 3 (InjectUserMessage receives assistant response without error). Outcome only; we don't assert proxy received item.added. | Could add: assert proxy received at least one conversation.item.added (or that client received response) to pin "API confirmed item." |
| **4** | **InjectUserMessage → completion:** Proxy receives `response.output_text.done` or `response.done` so it can send ConversationText + AgentAudioDone to client. | With real API: client receives ConversationText (assistant) and optionally AgentAudioDone. | **Covered:** Issue #489 real-API test — InjectUserMessage receives ConversationText (assistant) and AgentAudioDone. | — |
| **5** | **AgentStartedSpeaking before ConversationText (Issue #482):** For a given turn, client receives AgentStartedSpeaking before ConversationText (assistant). | With real API: client message order for a turn. | **Covered:** Issue #489 real-API test — client receives AgentStartedSpeaking before ConversationText (assistant) for a turn. | — |
| **6** | **AgentAudioDone when response completes:** Proxy sends AgentAudioDone when it receives response.output_text.done or response.done (or output_audio.done). | With real API: after a turn, client receives AgentAudioDone (or we see proxy received completion from upstream). | **Covered:** Issue #489 real-API tests for normal turn (InjectUserMessage + AgentAudioDone) and function-call turn (after FunctionCallResponse client receives AgentAudioDone). | — |
| **7** | **Idle timeout from upstream:** Proxy receives upstream `error` with idle_timeout and sends Error (code idle_timeout) to client. | With real API: client receives Error with code idle_timeout (and optionally after ConversationText when response was in progress). | Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout). We assert client order; we don't assert "proxy received error event from upstream." | Minor; outcome (client sees Error with correct code) is asserted. |
| **8** | **Greeting text-only:** After session.updated, proxy sends greeting as ConversationText to client only (no conversation.item.create for greeting to upstream). | With real API: greeting flow completes without upstream error. | Issue #414 real-API greeting flow must not produce error. We don't assert "proxy received session.updated" or "greeting was not sent to upstream." | Mock-only for "greeting text-only"; real-API test is outcome-only. |
| **9** | **Wire contract:** Only `response.output_audio.delta` is sent to client as binary; all other upstream messages as text. | With real API: client never receives non-audio binary that looks like JSON. | Mock-only. | No real-API test; would require inspecting frame types. |

---

## 3. Summary: highest priority gaps

1. **Proxy receives completion after FunctionCallResponse (real API)** — Essential. Add integration test with real API that asserts the proxy receives `response.done` or `response.output_text.done` (or that the client receives an agent-done signal) after the client sends FunctionCallResponse. This directly addresses the failing E2E and distinguishes API vs proxy.
2. **Proxy receives session.updated (real API)** — High. All flows depend on it; no explicit assertion. Could be a single real-API test: client receives SettingsApplied within N s of connect.
3. **Client receives AgentAudioDone after a turn (real API)** — High. Component needs "agent done" to start idle timeout; we have no real-API test that the client receives AgentAudioDone (or that proxy received completion) for a normal or function-call turn.
4. **AgentStartedSpeaking before ConversationText (real API)** — Medium. Issue #482 ordering; mock-only today.
5. **InjectUserMessage: proxy received item.added (real API)** — Lower; outcome (no error, client gets response) is already asserted; explicit "proxy received item.added" would help if we ever see ordering bugs.

---

## 4. Recommendations

- **Add first:** Real-API integration test that after FunctionCallResponse, the proxy receives (or we observe the effect of) `response.done` or `response.output_text.done` from upstream. For example: run function-call flow with real API and assert client receives AgentAudioDone (or ConversationText that implies completion) within a timeout; or capture proxy logs and assert presence of completion event type. This is the essential missing protocol test.
- **Then:** Consider real-API tests for (2) session.updated → SettingsApplied, (3) client receives AgentAudioDone after a turn, (4) AgentStartedSpeaking before ConversationText for a turn.
- **Logging:** Proxy already logs every upstream JSON message type at INFO. When adding tests, run with LOG_LEVEL=info to correlate "proxy received X" with test assertions; optional: have the test parse proxy output or use a test double that records received upstream event types.

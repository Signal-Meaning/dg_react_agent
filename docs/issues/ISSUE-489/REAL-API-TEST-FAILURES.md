# Real-API Test Failures: Investigation and Alignment

This doc records the **two recurring real-API integration test failures**, their likely root causes, and how we align with the **OpenAI Realtime API** and our own protocol docs. **Do not fix these by increasing timeouts;** see [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md) and focus on correct observation and spec alignment.

**Reference:** [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](../ISSUE-470/PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md), [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md), [PROTOCOL-SPECIFICATION.md](../../../tests/integration/PROTOCOL-SPECIFICATION.md) (requirement ↔ test table), [TDD-CODES-OVER-MESSAGE-TEXT-CHECKLIST.md](./TDD-CODES-OVER-MESSAGE-TEXT-CHECKLIST.md) (TDD progress for error-code implementation), OpenAI Realtime API [server events](https://platform.openai.com/docs/api-reference/realtime-server-events), [client events](https://platform.openai.com/docs/api-reference/realtime-client-events).

---

## 1. Failure: SettingsApplied not received within 10s

**Test:** `Issue #489 real-API: client receives SettingsApplied within 10s of connect (session.updated)`

**What the test does:** Connects to proxy, sends `Settings`, waits for `SettingsApplied` on the client within 10s.

**Observed failure:** `Issue #489: did not receive SettingsApplied within 10s`

**Protocol chain:** Client sends Settings → proxy sends `session.update` to upstream → **OpenAI sends `session.updated`** → proxy sends `SettingsApplied` to client. So the client only gets `SettingsApplied` after the proxy receives `session.updated` from the API.

**Root-cause direction (do not assume "API is slow"):**

1. **Observation:** The test only checks `client.on('message')` for `msg.type === 'SettingsApplied'`. It does not distinguish text vs binary; the proxy sends SettingsApplied as **text** (JSON). Confirm the test is parsing JSON messages correctly (it does check `data[0] === 0x7b` for `{`). So observation is likely correct; the client simply never received a message with `type: 'SettingsApplied'`.

2. **Proxy:** Proxy sends `SettingsApplied` only in `msg.type === 'session.updated'` (see `server.ts`). So either the proxy never received `session.updated`, or it did not send `SettingsApplied` (e.g. connection closed before that).

3. **OpenAI Realtime API:** Per [session.updated](https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated), the server sends `session.updated` **after** the client’s `session.update` has been applied. So the API contract is: client sends `session.update` → server responds with `session.updated`. If the server never sends `session.updated`, the proxy cannot send `SettingsApplied`. **Action:** Confirm from the current OpenAI Realtime API spec (and, if needed, a minimal trace with `LOG_LEVEL=info`) that the upstream actually sends `session.updated` after our `session.update`, and that the proxy receives it. If the API contract or URL/model changed (e.g. different endpoint or response shape), our proxy or test assumptions may be wrong.

4. **Alignment:** Our [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §2.3 states we wait for `session.updated` (not `session.created`) before sending SettingsApplied. That matches the API. Ensure the test environment (URL, model, auth) matches what the proxy uses and that no middleware drops or delays `session.updated`.

---

## 2. Failure: Idle_timeout Error never received (Issue #482 real-API)

**Test:** `Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout) (USE_REAL_APIS=1)`

**What the test does:** Connects, sends Settings, on SettingsApplied sends InjectUserMessage "Hi", then expects to receive (1) at least one ConversationText (assistant), (2) an Error with `code: 'idle_timeout'`, and (3) ConversationText before that Error. After 25s it asserts `errIdx >= 0`; failure is `errIdx === -1` (no such Error received).

**Observed failure:** `expect(errIdx).toBeGreaterThanOrEqual(0)` — no Error with `code === 'idle_timeout'` was received.

**Error handling requirement:** The proxy must use **structured codes** for all errors and events: (1) **Codes from the API** — map upstream `error` (and any other events that carry a code) using the API's structured payload (e.g. `event.error?.code`), not message text. (2) **Codes from the proxy** — when the proxy sends messages to the client (e.g. `Error` with `code`), use defined codes from the protocol, not free-form text. The proxy should **avoid using text strings from messages** (API or client) for control flow or mapping if at all possible; prefer structured fields (codes, types, event names). See protocol requirement **Error handling** in [PROTOCOL-SPECIFICATION.md](../../../tests/integration/PROTOCOL-SPECIFICATION.md) and PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.

**Root-cause direction:**

1. **Observation:** The test collects all messages and looks for `type === 'Error' && code === 'idle_timeout'`. The component Error shape is `{ type: 'Error', description: string, code: string }`. The proxy must set that code from the API's structured error payload (e.g. `event.error?.code`), not from message substring.

2. **OpenAI Realtime API:** The proxy must use the API’s **structured error codes** (e.g. `event.error?.code`) for all error mapping, including idle timeout → `idle_timeout`; avoid inferring from message text. Same for any other codes the API emits. **Action:** Re-review the [OpenAI Realtime API server events](https://platform.openai.com/docs/api-reference/realtime-server-events) (and error payload) for the error event shape and any documented code for idle timeout. Align `isIdleTimeoutClosure` and `mapErrorToComponentError` to use the API’s code; add or update tests to assert the code the API sends.

3. **Test assumption:** The test assumes that within 25s the API will close the connection due to idle and that the proxy will receive an error, map it to `idle_timeout`, and send Error to the client. If the API never sends that error in this scenario (e.g. different idle behavior, or no idle timeout in the test window), the test cannot pass. **Do not fix by increasing the 25s timeout.** Instead: (a) Confirm from the API spec when and how idle timeout is signaled; (b) If the API has a configurable idle timeout (e.g. in `session.update`), ensure we set it so the test can reliably trigger it; (c) If the test is meant to run only when the API actually sends an idle-timeout closure, document that and consider skipping or conditioning the test when the API behavior cannot be triggered (e.g. no idle timeout in the plan).

4. **Alignment:** Keep [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.9 and §3.7 aligned with the current API. Use upstream **structured codes** for all error mapping (idle_timeout, session_max_duration, and any other codes the API emits); proxy should avoid message text for control flow. Update `isIdleTimeoutClosure` and `mapErrorToComponentError` to use codes. Same principle applies to any codes the proxy emits to the client.

---

## 3. Policy: No timeout increases

We do **not** fix real-API test failures by increasing deadlines (e.g. 10s → 30s for SettingsApplied, or 25s → 60s for idle_timeout). The goal is to have tests that **correctly observe** the events the API and proxy produce and that are **aligned with the OpenAI Realtime API** and our protocol docs. If the test fails, the next step is to (1) confirm what the API actually sends (e.g. with logging or a minimal trace), (2) align proxy and docs with the spec, and (3) ensure the test asserts on the right events in the right order.

---

## 4. Alignment checklist (OpenAI Realtime API ↔ proxy ↔ component)

- [ ] **session.update / session.updated:** API sends `session.updated` after client `session.update`. Proxy sends SettingsApplied only on `session.updated`. Doc: PROTOCOL-AND-MESSAGE-ORDERING.md §2.2, §2.3.
- [ ] **Idle timeout and all error codes:** Use API structured codes for all error mapping; proxy avoids message text. Proxy-emitted codes (to client) should also be from the protocol, not free-form. Doc: §3.9, §3.7; COMPONENT-PROXY-CONTRACT "Codes over message text."
- [ ] **Agent activity and idle timer:** Component expects AgentDone / AgentAudioDone and other events to start/stop the idle timer. Proxy must send the events the component needs, in the order required. See [AGENT-DONE-SEMANTICS-AND-NAMING.md](./AGENT-DONE-SEMANTICS-AND-NAMING.md) and [COMPONENT-PROXY-CONTRACT](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md).

---

## 5. Answers (from project references and spec)

**Spec clarity**

- **(a) When the server sends `session.updated`:** The API reference and our PROTOCOL-AND-MESSAGE-ORDERING.md §2.3 state that the server sends `session.updated` **after** the client’s `session.update` has been applied. So the contract is clear: client sends `session.update` → server sends `session.updated`. Our proxy correctly waits for `session.updated` before sending SettingsApplied and injecting context/greeting.
- **(b) How the server signals idle timeout (and all errors):** The proxy **must use the API’s structured error codes** (e.g. upstream `error.code`) for all error mapping, including idle timeout. The proxy should **avoid using text strings from messages** for control flow or mapping if at all possible; same for any codes the proxy emits to the client — use protocol-defined codes. Align `isIdleTimeoutClosure` and `mapErrorToComponentError` with the API’s error payload; add or update tests to assert the code the API sends.
- **(c) Ordering of response.*.done and error when response in progress:** PROTOCOL-AND-MESSAGE-ORDERING.md §5 and Issue #482 describe that when the upstream sends an error (e.g. idle_timeout) while a response is in progress, we **buffer** the Error and send it after the next `response.output_text.done` so the client receives ConversationText (assistant) before Error. So the required ordering is specified; the test "ConversationText (assistant) before Error (idle_timeout)" encodes that contract.

**Test coverage vs requirements**

- The **test matrix** in PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md §2 maps each of the 8 requirements to integration (mock/real) and E2E. Gaps already identified: (1) real-API test that would fail if the API never sent `session.updated` — we have that test (Issue #489 real-API SettingsApplied within 10s); when it fails, the root cause is either API/proxy not sending or test environment. (2) real-API test that would fail if the API never sent an idle-timeout signal (or we mis-detect it) — we have Issue #482 real-API; when it fails with errIdx === -1, we are not receiving an Error with code idle_timeout, which is consistent with the blunder (we may be mis-detecting or the API may not send that message in the test window). To make "tests for every requirement" explicit: maintain the **protocol specification** in the integration test folder (see below) with a requirement ↔ test table and reference it from this doc and from PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE. CI: real-API tests run only when `USE_REAL_APIS=1` and keys are set; document that in TEST-STRATEGY (already done).

**Agent activity and idle timer**

- **(a) Proxy sends the events the component needs:** PROTOCOL-AND-MESSAGE-ORDERING.md §5–6 and COMPONENT-PROXY-CONTRACT list the component-facing events (AgentThinking, AgentStartedSpeaking, AgentDone/AgentAudioDone, etc.) and when the proxy sends them. AGENT-DONE-SEMANTICS-AND-NAMING.md defines agent done and receipt vs playback. **(b) Order:** The same docs specify order (e.g. AgentStartedSpeaking before first response output; AgentDone/AgentAudioDone when response completes; Issue #482 buffering of idle_timeout Error after ConversationText). We clarify by keeping the **protocol specification** in the integration test folder (see below) with every server → proxy → client event and required ordering, and a test (or test section) per requirement so that agent activity and idle timer are explicitly covered.

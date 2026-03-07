# Real-API Test Failures: Investigation and Alignment

This doc records **real-API integration test failures** (and their resolution), **E2E real-API failure**, and how we align with the **OpenAI Realtime API** and our own protocol docs. **Do not fix these by increasing timeouts;** see [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md) and focus on correct observation and spec alignment.

**Reference:** [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](../ISSUE-470/PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md), [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md), [PROTOCOL-SPECIFICATION.md](../../../tests/integration/PROTOCOL-SPECIFICATION.md) (requirement ↔ test table), [TDD-CODES-OVER-MESSAGE-TEXT-CHECKLIST.md](./TDD-CODES-OVER-MESSAGE-TEXT-CHECKLIST.md) (TDD progress for error-code implementation), OpenAI Realtime API [server events](https://platform.openai.com/docs/api-reference/realtime-server-events), [client events](https://platform.openai.com/docs/api-reference/realtime-client-events).

**Integration tests (real API):** The openai-proxy integration suite includes real-API tests that **pass** with `USE_REAL_APIS=1`, including **"after FunctionCallResponse client receives AgentAudioDone"** — so we have proven that the **client does receive completion (AgentAudioDone) from the proxy** after a function call with the real API. See [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) and [PROTOCOL-ASSURANCE-GAPS.md](./PROTOCOL-ASSURANCE-GAPS.md).

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

**What the test does:** Connects, sends Settings (including `agent.idleTimeoutMs` when we support sending it), on SettingsApplied sends InjectUserMessage "Hi", then expects to receive (1) at least one ConversationText (assistant), (2) an Error with `code: 'idle_timeout'`, and (3) ConversationText before that Error. The test waits up to **65s** for the server idle timeout. Failure was `errIdx === -1` (no such Error received within the wait).

**Server timeout (API code `idle_timeout` = SERVER_TIMEOUT_ERROR_CODE):** The timeout is the **server** (API) idle timeout, not the client’s. We map it from the Deepgram-style protocol: the component sends `Settings.agent.idleTimeoutMs` and the proxy is intended to send `idle_timeout_ms` in `session.update` when the API supports it (PROTOCOL-AND-MESSAGE-ORDERING.md §3.9). **OpenAI:** The Realtime API only accepts `idle_timeout_ms` under `turn_detection: { type: 'server_vad', ... }`. We use `turn_detection: null` (so we control commit/response.create), so we do not currently send `idle_timeout_ms`; the server may use its own default (e.g. ~60s, or none). **Deepgram:** Server timeout was 60s. The test uses `DEFAULT_SERVER_TIMEOUT_MS` (60s) and waits `DEFAULT_SERVER_TIMEOUT_MS + 5s`; the API sends `SERVER_TIMEOUT_ERROR_CODE` when the server timeout fires (see `src/constants/voice-agent.ts`).

**OpenAI Realtime API (from official docs):** `idle_timeout_ms` is configurable only when using **Server VAD** (`turn_detection: { type: 'server_vad', ... }`). When set, it is optional with **minimum 5000, maximum 30000** (5s–30s). Docs: "Idle timeout is currently only supported for server_vad mode." With **`turn_detection: null`** (our proxy), there is no way to set it and **no published default**; the API may never send `idle_timeout` in that configuration. The test is skipped for real API (see test file).

**Observed failure:** `expect(errIdx).toBeGreaterThanOrEqual(0)` — no Error with `code === 'idle_timeout'` received within 65s. Confirms API does not send idle_timeout when turn_detection is null.

**Error handling requirement:** The proxy must use **structured codes** for all errors and events: (1) **Codes from the API** — map upstream `error` (and any other events that carry a code) using the API's structured payload (e.g. `event.error?.code`), not message text. (2) **Codes from the proxy** — when the proxy sends messages to the client (e.g. `Error` with `code`), use defined codes from the protocol, not free-form text. The proxy should **avoid using text strings from messages** (API or client) for control flow or mapping if at all possible; prefer structured fields (codes, types, event names). See protocol requirement **Error handling** in [PROTOCOL-SPECIFICATION.md](../../../tests/integration/PROTOCOL-SPECIFICATION.md) and PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.

**Root-cause direction:**

1. **Observation:** The test collects all messages and looks for `type === 'Error' && code === 'idle_timeout'`. The component Error shape is `{ type: 'Error', description: string, code: string }`. The proxy must set that code from the API's structured error payload (e.g. `event.error?.code`), not from message substring.

2. **OpenAI Realtime API:** The proxy must use the API’s **structured error codes** (e.g. `event.error?.code`) for all error mapping, including idle timeout → `idle_timeout`; avoid inferring from message text. Same for any other codes the API emits. **Action:** Re-review the [OpenAI Realtime API server events](https://platform.openai.com/docs/api-reference/realtime-server-events) (and error payload) for the error event shape and any documented code for idle timeout. Align `isIdleTimeoutClosure` and `mapErrorToComponentError` to use the API’s code; add or update tests to assert the code the API sends.

3. **Test assumption:** The test waits up to **65s** for the server to close due to idle and send an error that the proxy maps to `idle_timeout`. This allows for a ~60s server default (e.g. Deepgram-like). If the API never sends that error (e.g. no idle timeout when `turn_detection: null`), the test will still fail. (a) Confirm from the API spec when and how idle timeout is signaled; (b) OpenAI accepts `idle_timeout_ms` only under `turn_detection: { type: 'server_vad', ... }`; with `turn_detection: null` the server may use a default or none; (c) When the API supports a session-level or other configurable idle timeout we can set it from Settings so the test triggers within a known window.

4. **Alignment:** Keep [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.9 and §3.7 aligned with the current API. Use upstream **structured codes** for all error mapping (idle_timeout, session_max_duration, and any other codes the API emits); proxy should avoid message text for control flow. Update `isIdleTimeoutClosure` and `mapErrorToComponentError` to use codes. Same principle applies to any codes the proxy emits to the client.

---

## 3. Test suite hang (regression): open client on failure

**Symptom:** With `USE_REAL_APIS=1`, the integration test run appeared to hang (no PASS/FAIL output, or process did not exit after tests).

**Root cause:** Some real-API tests use a `setTimeout` that on failure calls `done(e)` (or asserts and then `done(e)` in a catch) **without closing the client WebSocket**. When the test fails (e.g. Issue #482: no `idle_timeout` Error received within 25s), the client connection stayed open. After all tests, `afterAll` calls `proxyServer.close()`; the server’s close callback does not run until all connections are closed, so the run could hang or the process could fail to exit due to open handles.

**Tests fixed:** (1) **Issue #482 real-API** (client receives ConversationText before Error idle_timeout): timeout callback now closes the client at the start, then runs assertions and calls `done()` or `done(e)`. (2) **Issue #489 real-API** (AgentStartedSpeaking before ConversationText): same pattern. (3) **Issue #482 TDD** (AgentAudioDone when response completes): same pattern for consistency. In all such tests, the timeout callback must close the client **before** any path that calls `done()` (success or failure) so the proxy server can shut down and the process can exit.

**Prevention:** In any test that opens a WebSocket client and uses a timeout (or other path) that may call `done(error)`, ensure the client is closed on every exit path (e.g. use a shared `finish(err?)` that closes the client and then calls `done`, or close the client at the start of the timeout callback before asserting).

---

## 4. Policy: No timeout increases

We do **not** fix real-API test failures by increasing deadlines (e.g. 10s → 30s for SettingsApplied, or 25s → 60s for idle_timeout). The goal is to have tests that **correctly observe** the events the API and proxy produce and that are **aligned with the OpenAI Realtime API** and our protocol docs. If the test fails, the next step is to (1) confirm what the API actually sends (e.g. with logging or a minimal trace), (2) align proxy and docs with the spec, and (3) ensure the test asserts on the right events in the right order.

---

## 5. Alignment checklist (OpenAI Realtime API ↔ proxy ↔ component)

- [ ] **session.update / session.updated:** API sends `session.updated` after client `session.update`. Proxy sends SettingsApplied only on `session.updated`. Doc: PROTOCOL-AND-MESSAGE-ORDERING.md §2.2, §2.3.
- [ ] **Idle timeout and all error codes:** Use API structured codes for all error mapping; proxy avoids message text. Proxy-emitted codes (to client) should also be from the protocol, not free-form. Doc: §3.9, §3.7; COMPONENT-PROXY-CONTRACT "Codes over message text."
- [ ] **Agent activity and idle timer:** Component expects AgentDone / AgentAudioDone and other events to start/stop the idle timer. Proxy must send the events the component needs, in the order required. See [AGENT-DONE-SEMANTICS-AND-NAMING.md](./AGENT-DONE-SEMANTICS-AND-NAMING.md) and [COMPONENT-PROXY-CONTRACT](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md).

---

## 6. Answers (from project references and spec)

**Spec clarity**

- **(a) When the server sends `session.updated`:** The API reference and our PROTOCOL-AND-MESSAGE-ORDERING.md §2.3 state that the server sends `session.updated` **after** the client’s `session.update` has been applied. So the contract is clear: client sends `session.update` → server sends `session.updated`. Our proxy correctly waits for `session.updated` before sending SettingsApplied and injecting context/greeting.
- **(b) How the server signals idle timeout (and all errors):** The proxy **must use the API’s structured error codes** (e.g. upstream `error.code`) for all error mapping, including idle timeout. The proxy should **avoid using text strings from messages** for control flow or mapping if at all possible; same for any codes the proxy emits to the client — use protocol-defined codes. Align `isIdleTimeoutClosure` and `mapErrorToComponentError` with the API’s error payload; add or update tests to assert the code the API sends.
- **(c) Ordering of response.*.done and error when response in progress:** PROTOCOL-AND-MESSAGE-ORDERING.md §5 and Issue #482 describe that when the upstream sends an error (e.g. idle_timeout) while a response is in progress, we **buffer** the Error and send it after the next `response.output_text.done` so the client receives ConversationText (assistant) before Error. So the required ordering is specified; the test "ConversationText (assistant) before Error (idle_timeout)" encodes that contract.

**Test coverage vs requirements**

- The **test matrix** in PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md §2 maps each of the 8 requirements to integration (mock/real) and E2E. Gaps already identified: (1) real-API test that would fail if the API never sent `session.updated` — we have that test (Issue #489 real-API SettingsApplied within 10s); when it fails, the root cause is either API/proxy not sending or test environment. (2) real-API test that would fail if the API never sent an idle-timeout signal (or we mis-detect it) — we have Issue #482 real-API; when it fails with errIdx === -1, we are not receiving an Error with code idle_timeout, which is consistent with the blunder (we may be mis-detecting or the API may not send that message in the test window). To make "tests for every requirement" explicit: maintain the **protocol specification** in the integration test folder (see below) with a requirement ↔ test table and reference it from this doc and from PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE. CI: real-API tests run only when `USE_REAL_APIS=1` and keys are set; document that in TEST-STRATEGY (already done).

**Agent activity and idle timer**

- **(a) Proxy sends the events the component needs:** PROTOCOL-AND-MESSAGE-ORDERING.md §5–6 and COMPONENT-PROXY-CONTRACT list the component-facing events (AgentThinking, AgentStartedSpeaking, AgentDone/AgentAudioDone, etc.) and when the proxy sends them. AGENT-DONE-SEMANTICS-AND-NAMING.md defines agent done and receipt vs playback. **(b) Order:** The same docs specify order (e.g. AgentStartedSpeaking before first response output; AgentDone/AgentAudioDone when response completes; Issue #482 buffering of idle_timeout Error after ConversationText). We clarify by keeping the **protocol specification** in the integration test folder (see below) with every server → proxy → client event and required ordering, and a test (or test section) per requirement so that agent activity and idle timer are explicitly covered.

---

## 7. E2E real-API failure: Idle timeout after function calls (issue-373)

**Test:** `issue-373-idle-timeout-during-function-calls.spec.js` — `should re-enable idle timeout after function calls complete`

**Observed:** With real APIs, the test waits 12s after the function call completes; neither idle timeout nor connection close is observed (`timeoutFired` and `__idleTimeoutFired__` false, no connection closes).

**Important:** The **integration** test `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)` **passes** with real API. So the client **does** receive AgentAudioDone from the proxy after a function call at the wire level. The E2E failure therefore points to **component or E2E environment** (e.g. component not transitioning to idle in the full app, or timing in browser), not "proxy never sends completion."

**Detail and next steps:** See [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) (current E2E failure and recommended next steps).

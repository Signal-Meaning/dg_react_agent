# TDD Plan: Implementing Missing Protocol-Requirement Coverage

**Goal:** Add tests (and, where needed, implementation) so each protocol requirement in [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](./PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md) has coverage that would **fail if we regress**. Focus on real-API or “real-API-like” tests where the gap was (e.g. requirement 4 was only caught by a partner on real API).

**Reference matrix:** §2 of PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md. “Missing” = no real-API integration test, or no test that would catch a regression for that requirement.

---

## Overview: requirements and current gaps

| Req | Requirement | Missing coverage |
|-----|-------------|------------------|
| 1 | session.update only when no active response | Real-API integration test |
| 2 | Clear responseInProgress only on output_text.done | ✅ Has real-API (#462 unified test) |
| 3 | response.create only after item.added (InjectUserMessage) | Real-API integration test |
| 4 | FunctionCallResponse: defer response.create until output_text.done | Real-API integration test (E2E 6b exists) |
| 5 | No context before session.updated | Real-API integration test |
| 6 | No append before session.updated | Real-API integration test |
| 7 | Min audio before commit | Real-API or stronger mock |
| 8 | Only one response active | ✅ E2E 6b; optional integration real-API |

---

## Phase 1: Real-API integration test for function-call path (Req 4)

**Goal:** Integration test (no Playwright, no test-app UI) that runs against real OpenAI proxy + real API, performs the function-call flow (Settings → InjectUserMessage that triggers function call → FunctionCallResponse → wait for response), and asserts no error containing `conversation_already_has_active_response`.

### 1.1 RED

- **Add test:** In `tests/integration/openai-proxy-integration.test.ts`, add a test that runs only when `USE_REAL_APIS=1` (and OPENAI_API_KEY set): connect to proxy, send Settings, send InjectUserMessage with a prompt that triggers a function call (e.g. “What time is it?”), when client receives FunctionCallRequest send FunctionCallResponse, wait for ConversationText or response completion, assert no Error message containing `conversation_already_has_active_response`.
- **Run:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts -t "function.call.*real"` (or the chosen test name). Without the proxy fix this would have failed; with the fix it should pass (GREEN).

### 1.2 GREEN

- Implement or adjust proxy so the test passes (already done for #470).
- Ensure test is skipped when `USE_REAL_APIS` is not set or key is missing.

### 1.3 REFACTOR

- Reuse existing integration helpers (create proxy with real upstream, send client messages, collect upstream/client events). Document in PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md that Req 4 now has a dedicated real-API integration test.

---

## Phase 2: Real-API integration test for “session.update only when no active response” (Req 1)

**Goal:** Test that if the client sends Settings while a response is active, the proxy does **not** send a second session.update to upstream (and the real API does not return `conversation_already_has_active_response`).

### 2.1 RED

- **Add test:** Real-API test: connect, send Settings, send InjectUserMessage, **before** response completes send a second Settings (duplicate), then let response complete. Assert either: (a) mock/capture shows only one session.update was sent upstream, or (b) no Error containing `conversation_already_has_active_response`. With real API we can assert (b); we may need to capture “messages sent to upstream” or rely on no error.
- **Run:** `USE_REAL_APIS=1 npm test -- ... -t "session.update.*active"`. If the proxy ever sent a second session.update while response was active, real API would error; so passing test = GREEN.

### 2.2 GREEN

- Proxy already gates session.update on `responseInProgress` and `pendingResponseCreateAfterFunctionCallOutput`. Test should pass; if not, fix proxy.

### 2.3 REFACTOR

- Share “connect + Settings + InjectUserMessage” setup with other real-API integration tests. Update coverage matrix.

---

## Phase 3: Real-API integration tests for Reqs 3, 5, 6 (optional, lower priority)

- **Req 3 (response.create only after item.added):** Real-API test would require asserting that we do not send response.create until after we receive an item confirmation from upstream. Harder to assert without instrumenting the proxy; current mock test is strong. **Option:** Add a test that sends InjectUserMessage and asserts we receive response.output_text.done without an upstream error (implied correct order).
- **Req 5 (no context before session.updated):** Real-API test: start proxy, connect, send Settings with context, assert no error before session.updated is received. May require delaying session.updated on the server side (not possible with real API). **Option:** Leave as mock-only; document in matrix.
- **Req 6 (no append before session.updated):** Similar: real API doesn’t let us control event order. Mock coverage is sufficient; document.

**TDD approach if pursued:** For each, write the test (RED) that would fail if we regressed (e.g. send response.create before item.added). Get to GREEN with current implementation. Refactor for shared setup.

---

## Phase 4: Req 7 (min audio before commit) – strengthen test

- **Current:** Mock test asserts we don’t send commit when audio &lt; 100ms.
- **Optional:** Add a real-API test that sends a very small amount of audio and asserts we do not get “buffer too small” from the API (because we never send commit until ≥100ms). Or add a negative mock test: if we *did* send commit with 0 bytes, we’d get an error.

**TDD:** RED = test “sending commit with &lt; min bytes causes upstream error or is never sent”; GREEN = proxy never sends commit below threshold (already true).

---

## Phase 5: Documentation and matrix updates

- After each phase, update **PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md** §2 (Test coverage matrix) so each requirement’s row reflects new integration (mock/real-API) or E2E coverage.
- Add a short “TDD plan for missing requirements” pointer in that doc to this file.

---

## Checklist (for implementers)

- [ ] **Phase 1** — Real-API integration test for function-call path (Req 4); update matrix.
- [ ] **Phase 2** — Real-API integration test for session.update only when no active response (Req 1); update matrix.
- [ ] **Phase 3** — (Optional) Real-API or stronger tests for Reqs 3, 5, 6; update matrix.
- [ ] **Phase 4** — (Optional) Strengthen Req 7 test (min audio before commit); update matrix.
- [ ] **Phase 5** — Doc and matrix updates; link from PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md to this TDD plan.

---

## References

- Protocol requirements and matrix: [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](./PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md)
- Integration test file: `tests/integration/openai-proxy-integration.test.ts`
- E2E partner scenario: test 6b in `test-app/tests/e2e/openai-proxy-e2e.spec.js`
- Policy: `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md`, `.cursorrules`

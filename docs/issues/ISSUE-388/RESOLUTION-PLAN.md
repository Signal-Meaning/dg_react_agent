# Issue #388: Resolution plan

**Priority:** Resolution is defined by **real APIs and no mocks** — the E2E test that uses a real OpenAI proxy must pass (agent response received after first text message). Unit tests with mocks support the contract and give fast feedback but do not prove the product works with real upstream.

**Status:** Resolved. E2E with real OpenAI proxy passes; proxy fix (wait for `conversation.item.added` before `response.create`) is implemented and covered by integration + E2E tests.

---

## 0. Progress (what we did)

- **Root cause (from API review):** The proxy was sending `response.create` immediately after `conversation.item.create` on `InjectUserMessage`. The OpenAI Realtime API expects the client to wait for upstream confirmation (e.g. `conversation.item.added` or `conversation.item.done`) before sending `response.create`; sending too early could contribute to upstream closing with code 1000 before replying.
- **Proxy fix:** `scripts/openai-proxy/server.ts` — on `InjectUserMessage`, the proxy now only sends `conversation.item.create` to upstream and sets a flag; it sends `response.create` only when the upstream sends `conversation.item.added` or `conversation.item.done`. No other behavior (e.g. audio commit, `FunctionCallResponse`) was changed.
- **Integration test:** `tests/integration/openai-proxy-integration.test.ts` — “Issue #388: sends response.create only after receiving conversation.item.added from upstream for InjectUserMessage”. Mock upstream sends `conversation.item.added` 100 ms after receiving user `conversation.item.create`; test asserts `response.create` is sent after that (order in `mockReceived` and delay ≥ 50 ms). The shared mock was updated to always send `conversation.item.added` for user messages (immediate when delay is 0, delayed when 100 ms) so both this test and “translates InjectUserMessage to … ConversationText” pass; the Issue #388 test clears `mockReceived` on `SettingsApplied` (just before sending `InjectUserMessage`) to avoid cross-test message pollution.
- **E2E:** `openai-inject-connection-stability.spec.js` — “should receive agent response after first text message (real OpenAI proxy)” — **passes** when run with real proxy (`VITE_OPENAI_PROXY_ENDPOINT`, dev server + proxy running). Resolution criterion met.
- **Regression:** Required Jest (`openai-proxy-integration`, `openai-proxy.test`, `issue-380-inject`) and proxy-surface E2E (`openai-proxy-e2e.spec.js` + `openai-inject-connection-stability.spec.js`) have been run and pass.

---

## 1. Definition of “defect resolved”

**Reconciliation:** We do have E2E tests that receive agent responses — e.g. OpenAI proxy E2E (single message, multi-turn, function calling, reconnection) get agent replies and function-call responses when the connection stays open. This defect is **not** “we never receive any agent response.” It is about one **specific** flow: send a single **text** message via **injectUserMessage** and wait for an agent reply. In the failing scenario the upstream closes ~2.7–3 s after that first text message, so **that** flow never gets a reply; other flows (e.g. function calls, or runs where the connection does not close early) can still pass and do receive responses.

The defect is **resolved** when:

- **E2E with real proxy passes for this flow:** `test-app/tests/e2e/openai-inject-connection-stability.spec.js` — “should receive agent response after first text message (real OpenAI proxy)” — runs against a real OpenAI proxy (e.g. `VITE_OPENAI_PROXY_ENDPOINT` set), and the test passes: an agent reply is delivered within the timeout (e.g. 15 s) **after sending one text message via injectUserMessage**.

When the bug is present (upstream closes ~2.7–3 s after that first text message), **this** E2E test **fails** (timeout waiting for agent response). So that test is the canary **for this defect**: fix proxy/upstream/config so the connection stays open for the injectUserMessage flow and a reply is delivered; then this E2E test passes and the defect is resolved. Other tests that already receive agent/function responses are unchanged.

Unit tests that use mocks do **not** resolve the defect by themselves; they document component behavior and guard against regressions.

### 1.1 Why do some tests pass and this one fail? (same flow, different outcome)

**The flow is the same.** The passing tests (OpenAI proxy E2E: “Single message”, “Multi-turn” first message, “Simple function calling” first message) and the failing canary (`openai-inject-connection-stability`: “agent response after first text message”) all do the same thing: connect → send **one text message** via the UI (which uses `injectUserMessage` under the hood) → wait for an agent response. Same component path, same proxy path (conversation.item.create / InjectUserMessage), same “first user message in session” shape.

**The difference is outcome, not test design.** When the **connection stays open** and the upstream sends a reply, the test **passes** and we receive an agent (or function-call) response. When the **upstream closes** ~2.7–3 s after that first message (the bug), the **same** test **fails** (timeout; no reply). So the “passing” tests are the same flow in runs or environments where the bug does not manifest; the canary fails where it does (e.g. voice-commerce’s proxy/OpenAI setup).

**Why might the same flow pass in one place and fail in another?** Environment and upstream behavior: different proxy implementation or version, different OpenAI API behavior (e.g. session lifecycle, when it sends close code 1000), or timing. There is no difference in how we send the message (all use text inject); the only difference is whether the upstream keeps the connection open and replies, or closes it before sending a reply. Fixing the defect means changing something (proxy, keep-alive, or understanding OpenAI’s close) so that in the failing environment the connection stays open and the canary test passes.

---

## 2. Why did the unit tests pass without any code change?

The **component** is behaving correctly:

- It sends the user message and calls `onUserMessage`.
- When the connection closes (for any reason), it reports `onConnectionStateChange('agent', 'closed')`.
- It only calls `onAgentUtterance` when it actually receives an agent reply (e.g. ConversationText from the upstream).

The **failure** is in the **environment**: the upstream (OpenAI) closes the WebSocket with code 1000 before sending a reply. So there is no reply to deliver, and the component correctly does not call `onAgentUtterance`. No production code change was required for the new unit tests to pass — they encode that the component does the right thing in both scenarios (upstream closes vs connection stays open and a reply arrives). Fixing the defect means changing something outside the component (proxy, OpenAI behavior, keep-alive, or docs) so that the **real** E2E test passes.

---

## 3. Unit tests with mocks (supporting only)

The following are **supporting** tests: they document the contract and protect against regressions. They do not replace the need for the real-API E2E test to pass.

### 3.1 “Does NOT call onAgentUtterance when upstream closes after first send” — why this test?

We assert that `onAgentUtterance` is **not** called when the mock simulates the connection closing after the first send. Reason: when the connection closes before any response, no reply is ever received, so the component must **not** call `onAgentUtterance`. The test locks in that we don’t spuriously fire `onAgentUtterance` when we never got a message (regression guard). So: “Why would it?” — it wouldn’t, and we assert that it doesn’t.

### 3.2 What “at the manager level” means (WebSocketManager vs raw WebSocket)

The customer’s repro used a mock of the browser’s **raw** `WebSocket` (with `send`, `onclose`). Our component does not use the raw `WebSocket` API directly in a way unit tests can swap — it uses **WebSocketManager**, which wraps the socket and exposes `sendJSON` and `addEventListener`. So in unit tests we mock **WebSocketManager**, not `WebSocket`. We can’t literally “close the WebSocket on first send”; we simulate the **same outcome**: when the component calls `sendJSON` for the first time (the inject), we have the mock notify the component that the connection closed (by calling the registered event listener with `{ type: 'state', state: 'closed' }`). That is what “simulate at the manager level” means — we fake the close by emitting the same event the real manager would emit when the underlying socket closes.

### 3.3 Closing mock and test list

- **Factory:** `createClosingWebSocketManagerMock()` in `tests/issue-380-inject-upstream-close.test.tsx`. It wraps `createMockWebSocketManager()` and: (1) stores the listener passed to `addEventListener`; (2) on first `sendJSON` call, invokes that listener with `{ type: 'state', state: 'closed' }`.
- **Tests:** See the same file, describe block “Issue #388: upstream close and agent reply after inject”. Tests 1–3 pass; test 4 (agent reply within 10 s with closing mock) is skipped until upstream keeps the connection open.

---

## 4. Acceptance checklist

- [x] **E2E with real OpenAI proxy passes:** `openai-inject-connection-stability.spec.js` — “should receive agent response after first text message” — green when run with `VITE_OPENAI_PROXY_ENDPOINT` and real proxy. **This is the resolution criterion.**
- [x] Unit tests: closing mock and #388 tests implemented; “closed” reported, no utterance when closed, utterance when we simulate reply; skipped test for “reply within 10 s with closing mock”.
- [x] Integration test: “Issue #388: sends response.create only after receiving conversation.item.added from upstream” — passes; mock sends item.added for user messages; test clears `mockReceived` before InjectUserMessage to avoid cross-test pollution.
- [x] Docs: ISSUE-388 README and this RESOLUTION-PLAN; draft files removed.
- [x] **OpenAI Realtime API review:** [OPENAI-REALTIME-API-REVIEW.md](./OPENAI-REALTIME-API-REVIEW.md) — event order (wait for conversation.item.added before response.create), session lifecycle, keep-alive; proxy fix implemented.

---

## 5. Next steps (post-resolution)

- **Merge and release:** Land the proxy fix and tests on the target branch; run full regression (required Jest + proxy-surface E2E) before release. Pre-release / full E2E suite can be run when release is kicked off.
- **Optional (product):** Document or investigate OpenAI Realtime API close code 1000 and session lifecycle if needed for support; consider keep-alive / reconnection / session-extend for multi-turn or long sessions.
- **No further code change required** for this defect; resolution is confirmed by the canary E2E test and supporting integration/unit tests.

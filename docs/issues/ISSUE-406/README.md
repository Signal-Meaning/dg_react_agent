# Issue #406: OpenAI proxy – conversation after refresh + readiness

**Branch:** `davidrmcgee/issue406`  
**GitHub:** [#406](https://github.com/Signal-Meaning/dg_react_agent/issues/406)  
**Context:** Voice-commerce (downstream) reported symptoms; root cause and fix are **our** responsibility. The contract is between the **component and the OpenAI proxy**; we own it. Whatever is broken must be fixed here so it does not flow down to voice-commerce or any other host.

---

## Status

### Settings / readiness contract — complete

The **settings part** of this issue is complete. We now enforce and document the readiness contract consistently:

- **E2E:** OpenAI proxy E2E tests require `waitForSettingsApplied` (no try/catch that makes it optional). Every test that sends a message waits for connection + Settings applied first. Same for `openai-inject-connection-stability.spec.js`.
- **Integration test:** `tests/integration/readiness-contract.test.ts` asserts the protocol contract (client receives SettingsApplied before sending first InjectUserMessage). Passes for the contract any proxy must satisfy.
- **E2E for either proxy:** `test-app/tests/e2e/readiness-contract-e2e.spec.js` runs with `E2E_BACKEND=openai` or `deepgram` and enforces connection + Settings applied → send → assert response.
- **Docs:** [Component–Proxy Contract](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) and [Interface Contract](../../BACKEND-PROXY/INTERFACE-CONTRACT.md) describe the big picture and the readiness contract; BACKEND-PROXY README and Issue #381 API-DISCONTINUITIES reference them. Issue #406 README is the working record for this issue.

When the OpenAI proxy/upstream fails to deliver SettingsApplied or closes before first message, our tests will now fail clearly (e.g. on `waitForSettingsApplied` or on send), instead of passing with “Settings optional” and failing later.

### Proxy mitigation (done)

When the **upstream** (OpenAI Realtime API) closes before the proxy has sent **SettingsApplied** to the client, the proxy now sends a component **Error** to the client before closing the connection:

- **Code:** `upstream_closed_before_session_ready`
- **Description:** includes upstream close code and reason (e.g. `Upstream closed before session ready (code 1005). Session may not have been applied.`)

So the host (and E2E) see a clear error instead of only “connection closed,” and can distinguish “upstream closed before session ready” from other failures. Implementation: `scripts/openai-proxy/server.ts` (track `hasSentSettingsApplied`, on `upstream.on('close')` send Error then close client).

### Root cause and fix (proxy protocol/timing)

**Full write-up:** [INVESTIGATION.md](./INVESTIGATION.md).

*Upstream* = the proxy’s WebSocket connection to the **OpenAI Realtime API** (OpenAI’s servers). The component talks to our proxy; the proxy talks upstream to OpenAI.

- **When:** Upstream closes before the proxy has sent SettingsApplied to the client (e.g. during the readiness handshake after we sent `session.update` but before we received `session.updated`).
- **Why:** The API expects **session.update** → **session.updated** before any **conversation.item.create**. We were sending context (conversation.item.create) **immediately** after session.update, i.e. before session.updated. That violates API ordering and can cause the upstream to close (e.g. 1005/1006).
- **Root cause (our proxy):** In `scripts/openai-proxy/server.ts`, on Settings we sent session.update then immediately sent conversation.item.create for each context message. That protocol/timing bug is our responsibility.
- **Fix (done):** Defer context: on Settings send only session.update and store context as pending conversation.item.create; on session.updated/session.created send those items to upstream, then send SettingsApplied (and greeting) to the client. See INVESTIGATION.md and `scripts/openai-proxy/server.ts`.

### Regression test for protocol ordering (done)

The integration test **"sends Settings.agent.context.messages as conversation.item.create to upstream"** (`tests/integration/openai-proxy-integration.test.ts`) now enforces correct ordering. The mock delays sending `session.updated` by 50ms; if the proxy sends any `conversation.item.create` before the mock has sent `session.updated`, a protocol error is recorded and the test fails. So any reversion to “context before session.updated” is caught. See [INVESTIGATION.md](./INVESTIGATION.md#regression-test).

### E2E with real APIs (validated)

Readiness and OpenAI proxy E2E were run against **real APIs** (OpenAI Realtime via proxy, Deepgram when applicable). All 11 tests passed:

- **readiness-contract-e2e.spec.js** – connection + Settings applied → send → response (default backend OpenAI)
- **openai-proxy-e2e.spec.js** – connection, greeting, single message, multi-turn, reconnection, basic audio, function calling, error handling
- **openai-inject-connection-stability.spec.js** – inject/connection stability

Command (from repo root): `USE_REAL_APIS=true USE_PROXY_MODE=true npx playwright test test-app/tests/e2e/readiness-contract-e2e.spec.js test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js --config=test-app/tests/playwright.config.mjs`. Requires `test-app/.env` with `OPENAI_API_KEY` (and Deepgram keys if running Deepgram-backed specs).

### Investigation: Conversation after refresh (OpenAI)

With OpenAI provider, the latest conversation is not shown after full page refresh (reported as working with Deepgram in partner flow). Findings so far:

- **Test-app:** Conversation is held only in React state (`conversationHistory` in `test-app/src/App.tsx`). There is no `localStorage`/`sessionStorage` persistence or restore on load. So after a full page refresh, state is lost and the conversation list is empty for **any** backend (OpenAI or Deepgram) in the test-app.
- **Component:** The component does not handle session storage or context persistence; that is an application-layer concern (see test-app docs).
- **Implication:** To have “conversation after refresh” in the test-app, we need to persist and restore conversation in the app layer (e.g. `sessionStorage` keyed by backend or session). That would make post-refresh behavior consistent for both backends. If the partner’s “works with Deepgram” means they already persist for Deepgram, the same pattern (persist/restore in host app) should be used for the OpenAI path.

**Done (test-app):** Test-app uses the component’s conversation storage: it passes a localStorage-backed `conversationStorage` and `conversationStorageKey` to the component and drives the "Conversation History" UI from `ref.getConversationHistory()` (synced in onAgentUtterance / onUserMessage and after inject). After a full page refresh the component restores from storage and the UI shows the same list. Context for the backend is built from that same list.

**Done (component – TDD Issue #406):** The component now **owns** conversation persistence logic when the app provides storage. Optional props: `conversationStorage` (interface: `getItem(key)`, `setItem(key, value)`) and `conversationStorageKey` (default `dg_conversation`). On mount the component calls `getItem`, restores messages, and exposes them via `ref.getConversationHistory()`. When `ConversationText` is received, the component appends to the list and calls `setItem` (last 50 messages). Application provides the storage implementation (e.g. localStorage, encrypted storage). See [CONVERSATION-STORAGE](../../CONVERSATION-STORAGE.md). Unit tests: `tests/conversation-storage-issue406.test.tsx` (7 tests, TDD red→green).

### Remaining (next steps)

1. **Done – Test-app uses component storage:** Test-app passes a localStorage-backed `conversationStorage` (and `conversationStorageKey`) to the component and drives the Conversation History UI from `ref.getConversationHistory()`, with state synced in `onAgentUtterance` / `onUserMessage` and after inject. See docs/CONVERSATION-STORAGE.md.
2. **E2E: conversation state reloaded after refresh (done):** `readiness-contract-e2e.spec.js` includes a test that sends a unique message, waits for agent response, asserts the message appears in `[data-testid="conversation-history"]`, reloads the page, re-establishes connection, then asserts the same message is still visible in the DOM. This proves session state (conversation) is persisted and reloaded after refresh.
3. **If upstream still closes:** The **protocol** fix (no context before session.updated) is covered by the integration test in `openai-proxy-integration.test.ts` and was validated with real API E2E. This bullet refers to **other** causes of upstream close (e.g. network, OpenAI service, auth, rate limits). The proxy mitigation (Error `upstream_closed_before_session_ready`) remains; if issues persist, investigate those other causes or report to OpenAI.

---

## Our contract and readiness flow

**Canonical doc:** [Component–Proxy Contract](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) describes the big picture: one component protocol, multiple backends (Deepgram or translation proxy), and the readiness contract (SettingsApplied before first user message) that applies to all.

### Component behavior (actual)

- **InjectUserMessage** is only safe after Settings have been sent and ideally **SettingsApplied** received. The component enforces this:
  - `injectUserMessage()` calls `waitForSettings()` (up to 5s) after connection and does a final `hasSettingsBeenSent()` check before calling `sendJSON({ type: 'InjectUserMessage', ... })`.
  - It treats “Settings not sent” as **CRITICAL** and logs that the backend may reject the message; it may still proceed after extra waits but the intended contract is **Settings applied before first user message**.
- **WebSocketManager.sendJSON()** returns `false` (and does not send) when the WebSocket is not OPEN. So if the connection closes after we think we’re “ready” but before send, the message is dropped and the component does not throw.

So in practice: **readiness = connection open + Settings applied (SettingsApplied received).** That is the component’s own contract with the backend (Deepgram or OpenAI proxy).

### Test app proof

- The test app exposes readiness via **`[data-testid="has-sent-settings"]`**, which is set to `true` in **`onSettingsApplied`** (when the component receives SettingsApplied from the server).
- So the test app’s **own** readiness flow is: **connection + Settings applied**. That is the successful proof we demonstrate to integrators.

### Conclusion

- **Settings applied is not optional** for correct “ready for messages” behavior. The component waits for it; the test app surfaces it. We should only treat it as optional in tests if the product actually allows sending before Settings applied (it does not).
- E2E must **enforce actual behavior**: wait for connection, **then** wait for Settings applied, **then** send. That way we catch when the OpenAI proxy path fails to deliver SettingsApplied or keeps the connection closed.

---

## What went wrong in our E2E

1. **OpenAI proxy E2E** used `establishConnectionViaText()` then (in test “1. Connection”) `waitForSettingsApplied(page, 5000)` inside a **try/catch that ignores failure**, with a comment that “Settings applied is optional; connection ready is the main assertion.” That contradicts the component and test app: Settings applied **is** required for readiness. Making it optional in the test hid the flaw.
2. Tests 2–7 call `sendTextMessage` immediately after `establishConnectionViaText` and **do not** wait for Settings applied. So we never asserted “connection + Settings applied → then send” for OpenAI. When the OpenAI upstream closes before `session.updated`, the proxy never sends SettingsApplied, the test app never shows “ready,” and any host that (correctly) waits for readiness then send would see “connection closed” / “not ready.” Our tests didn’t enforce that flow, so the bug didn’t show up as a clear failure.

---

## Why the flaw is limited in scope (and why tests still passed sometimes)

- **Backend-specific:** Only the **OpenAI proxy path** depends on upstream sending `session.updated`/`session.created` so the proxy can send SettingsApplied. Deepgram sends an equivalent on its own protocol. So the defect is in the component–OpenAI proxy contract / upstream lifecycle.
- **Timing-dependent:** If the OpenAI upstream sends `session.updated` before closing, the client gets SettingsApplied and the first send works. So the failure can be intermittent; our E2E could pass when timing was favorable and fail when it wasn’t.
- **Test design:** Because we treated Settings as optional and didn’t require “connection + Settings applied → send,” we didn’t catch the case where the OpenAI path never delivers SettingsApplied and the connection closes before first message.

---

## Our responsibility

- **We own the component–OpenAI contract.** The proxy must deliver SettingsApplied (and keep the connection open until the host can send) so that the same readiness flow works for both Deepgram and OpenAI. Voice-commerce and other hosts should not have to work around our contract; we fix it here.
- **Tests enforce actual behavior.** Settings applied is required in OpenAI proxy E2E and in the shared readiness-contract E2E for either proxy (see Status above).

---

## Tests for the readiness contract (either proxy)

- **Jest integration** (`tests/integration/readiness-contract.test.ts`): Protocol-level test. A minimal WebSocket server speaks the component protocol (on Settings → send SettingsApplied; on InjectUserMessage → accept and reply). The test asserts that the client receives SettingsApplied before sending the first InjectUserMessage. Run: `npm test -- tests/integration/readiness-contract.test.ts`. Passes for the contract that any proxy (OpenAI or Deepgram) must satisfy.
- **E2E** (`test-app/tests/e2e/readiness-contract-e2e.spec.js`): Runs for either proxy based on `E2E_BACKEND` (openai or deepgram). Uses `setupTestPageForBackend`, then `establishConnectionViaText` → `waitForSettingsApplied` → `sendTextMessage` → assert agent response. Run with the matching proxy: `USE_PROXY_MODE=true npm run test:e2e -- readiness-contract-e2e` (default OpenAI), or `E2E_BACKEND=deepgram USE_PROXY_MODE=true npm run test:e2e -- readiness-contract-e2e` (Deepgram).

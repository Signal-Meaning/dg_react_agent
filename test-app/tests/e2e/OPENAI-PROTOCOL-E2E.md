# OpenAI proxy: protocol and E2E tests

**Purpose:** Align E2E tests and the test-app with the **OpenAI proxy protocol** so that tests both **abide by** the intended protocol and **reflect** it in the test-app (DOM and behavior).

**Protocol spec:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)

---

## 1. How the test-app reflects the protocol

The test-app exposes DOM and state that correspond to protocol concepts. E2E tests use these to assert protocol-compliant behavior.

| Protocol concept | Test-app reflection | data-testid / selector |
|------------------|---------------------|------------------------|
| **Settings applied** (before first message) | "Settings applied" flag from proxy | `has-sent-settings` (true after SettingsApplied) |
| **Connection** | Agent connection status | `connection-status` |
| **User echo** (proxy sends ConversationText role user after InjectUserMessage) | Conversation history shows user message | `conversation-history` → `[data-role="user"]` |
| **Assistant messages** (ConversationText role assistant, greeting or response) | Conversation history shows assistant message | `conversation-history` → `[data-role="assistant"]` |
| **Agent response text** | Latest agent response text | `agent-response` |
| **Greeting sent** (after session.updated, proxy sends greeting as ConversationText only) | Greeting acknowledged in UI | `greeting-sent` |
| **Agent errors** (proxy forwards upstream Error) | Error counts | `agent-error-count`, `recoverable-agent-error-count` |
| **TTS binary** (only PCM from response.output_audio.delta) | Chunks received by component | `agent-audio-chunks-received` |
| **Playback status** | Whether TTS is playing | `audio-playing-status` |

**Readiness contract:** The component (and test-app) only consider the session ready for the first user message after **SettingsApplied**. E2E must call `waitForSettingsApplied(page)` before `sendTextMessage(page, ...)` so tests abide by the same contract.

---

## 2. Protocol requirement → E2E coverage

| Protocol requirement | E2E spec(s) | Assertion / behavior |
|----------------------|-------------|------------------------|
| **§2 Readiness:** SettingsApplied before first message | `readiness-contract-e2e.spec.js`, `openai-proxy-e2e.spec.js`, all OpenAI specs | `waitForSettingsApplied()` before first `sendTextMessage()` |
| **§2 Session ordering:** Greeting only after session.updated | `openai-proxy-e2e.spec.js` (greeting), `greeting-playback-validation.spec.js` | Wait for `greeting-sent` or assistant in conversation after connect |
| **§3 User echo:** Proxy sends ConversationText (user) after InjectUserMessage | `openai-proxy-e2e.spec.js` (new) | After send, conversation history has user message with same content |
| **§1.2 Wire:** Only TTS PCM as binary; no JSON as binary | `openai-proxy-tts-diagnostic.spec.js` | First binary not JSON; all binary frames not JSON-like |
| **§5 Error:** Upstream errors forwarded as text (Error) | All OpenAI specs | `assertNoRecoverableAgentErrors(page)` (fail if any agent error) |
| **§6 Client-facing events:** SettingsApplied, ConversationText, Error, binary PCM | Test-app DOM above | Assertions use the testids and roles above |

---

## 3. What to do in E2E so they abide by and reflect the protocol

### Already in place

- **Readiness:** All OpenAI E2E specs use `establishConnectionViaText` then `waitForSettingsApplied` before sending. This matches the protocol (SettingsApplied before first InjectUserMessage).
- **Wire (binary not JSON):** TTS diagnostic asserts no binary frame is JSON; aligns with proxy contract.
- **Errors:** `assertNoRecoverableAgentErrors` used in OpenAI specs so tests fail when the proxy forwards an upstream error.
- **Greeting:** Greeting flow and connect-only greeting playback are covered.

### Recommended additions

1. **User echo (protocol §3)**  
   After `sendTextMessage(page, content)`, assert that the conversation history contains a **user** message with that content. This reflects the protocol: proxy sends ConversationText (role user) so the test-app can show the user’s message in history.  
   **Spec:** `openai-proxy-e2e.spec.js` — add test *"user message appears in conversation history (protocol: proxy sends user echo)"*.

2. **Reference the protocol in specs**  
   In OpenAI proxy E2E specs, add a short comment or link to this doc and to `PROTOCOL-AND-MESSAGE-ORDERING.md` so maintainers know the intended contract.  
   **Files:** `openai-proxy-e2e.spec.js`, `openai-proxy-tts-diagnostic.spec.js`, `greeting-playback-validation.spec.js`.

3. **Optional: order assertion (SettingsApplied before greeting)**  
   In a greeting test, assert that `has-sent-settings` is true before we see the greeting in conversation history. Reinforces protocol §2.3 (SettingsApplied only on session.updated; greeting after that).

4. **Optional: conversation history roles**  
   When asserting on conversation history, use `[data-role="user"]` and `[data-role="assistant"]` explicitly so tests document that the test-app reflects protocol roles (ConversationText role user/assistant).

---

## 4. Running OpenAI protocol–aligned E2E

- **OpenAI proxy E2E:**  
  `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e -- openai-proxy-e2e openai-proxy-tts-diagnostic greeting-playback-validation readiness-contract-e2e openai-inject-connection-stability`

- **Readiness (either backend):**  
  `E2E_BACKEND=openai USE_PROXY_MODE=true npm run test:e2e -- readiness-contract-e2e`

See [E2E-BACKEND-MATRIX.md](./E2E-BACKEND-MATRIX.md) for which specs require the OpenAI proxy.

---

## 5. References

- Protocol: [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)
- Component–proxy contract: [docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md](../../docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md)
- Helpers: [helpers/test-helpers.js](./helpers/test-helpers.js) (`waitForSettingsApplied`, `assertNoRecoverableAgentErrors`, etc.)

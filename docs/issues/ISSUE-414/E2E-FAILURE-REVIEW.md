# Issue #414: E2E real-API failure review

**Context:** 2026-02-08 run of OpenAI proxy E2E with real APIs: 15 passed, 3 failed. This doc reviews each failure and the actions taken.

---

## 1. Greeting playback – "connect only": agent error (agent-error-count = 1)

**Failure:** `assertNoRecoverableAgentErrors` failed: `agent-error-count` was 1 (likely "server had an error" or similar).

**Requested check:** Supreme confidence that **no binary** is being sent over the WebSocket in the connect-only flow. If any binary were sent, it would be incorrect/inadvertent and a culprit.

**Findings:**

- **When is binary sent?** The component sends binary only via `sendAudioData` → `agentManagerRef.current.sendBinary(data)`. That is only called when the component receives audio data from the **microphone** path (AudioWorklet → `handleAudioData` → `sendAudioData`). Microphone capture is started only when:
  - The test-app calls `startAudioCapture()` (e.g. when the user clicks the **microphone** button), or
  - The declarative prop `startAudioCapture` is set to true.
- **Connect-only flow:** The test only focuses the **text input**. The test-app on text focus calls `deepgramRef.current?.start?.({ agent: true, transcription: false })` and does **not** call `startAudioCapture()`. So no mic, no audio data, no `sendAudioData`, so **no binary** should be sent.
- **Validation added:** In `greeting-playback-validation.spec.js`, the "connect only" test now:
  1. Calls `installWebSocketCapture(page)` before loading the app so all client→proxy sends are captured.
  2. After asserting greeting and no error, calls `getCapturedWebSocketData(page)` and asserts that **no sent message has `type === 'binary'`**.  
  So if any binary is ever sent in this flow, the test fails with a clear message. This gives supreme confidence that binary is not the cause for this failure.

**Conclusion:** With the new assertion, we can be confident that connect-only does not send binary. If the test still fails with an agent error, the cause is elsewhere (e.g. upstream "server had an error" despite correct client behavior).

---

## 2. Basic audio – send recorded audio; assert agent response: agent error

**Failure:** Same as (1): `assertNoRecoverableAgentErrors` failed (agent-error-count = 1) after sending **audio** via `loadAndSendAudioSample` and waiting for agent response.

**Question:** Do we have any other **passing** case where the test sends **audio** and validates an agent response?

**Answer:** **No.** In the OpenAI proxy E2E suite:

- The only test that sends **audio** (recorded sample via `loadAndSendAudioSample`) and then asserts on agent response is **test 5** ("Basic audio – send recorded audio..."). That test **failed** (agent error).
- The **passing** test that validates "send something → get agent response" is **"connect then send non-greeting message: agent response TTS played"** in `greeting-playback-validation.spec.js` — but that one uses **text** (`sendTextMessage('What is 2 plus 2?')`), not audio.

So we have **no other passing test** that sends audio and validates agent response. The only audio→response test is test 5, and it currently fails. Fixing the upstream/proxy error (or relaxing the error assertion when it’s recoverable) would be needed to get a passing audio→response test.

---

## 3. Repro – after reload and connection close: greeting as response to new message

**Failure:** After reload, connect, disconnect, then send "What famous people lived there?", the agent response was the **greeting** ("Hello! How can I assist you today?") instead of an answer to the question. So the user got the greeting as if it were the reply to their message.

**Interpretation:** This is a **different bug**. When re-connecting (or when the user sends a message after a new connection), the **assistant greeting should not be shown as the response** to that user message. The component controls whether/how the greeting is sent and displayed, so this is our bug.

**First step requested:** Validate that the connection is being **re-established to the same session** (vs a new session).

**Findings:**

- After **full page reload**, the browser loads a new document. The test-app and component are new instances. The client opens a **new** WebSocket to the proxy. The proxy treats each client WebSocket as a new connection and creates a **new** upstream connection to OpenAI (new session). So after reload we are **not** re-establishing to the same session — we are always a **new** session. The OpenAI Realtime API does not expose a "resume session" in this setup; the proxy does not send a session id to the client or reuse one.
- So after reload, the backend (OpenAI) will send a **greeting** for that new session. The bug is not "we reused the same session and wrongly got a greeting" — it is that the **component (or test-app)** is **displaying** that greeting as the **response** to the user’s message "What famous people lived there?" instead of treating it as the initial greeting and waiting for the real reply.
- **Validation to add (recommended):** To explicitly confirm same vs new session in the test-app or E2E:
  - If the upstream or proxy ever sends a session identifier (e.g. in `session.created` or similar), expose it in the test-app (e.g. `data-testid="session-id"`) and in the repro test assert: after reload + connect, the session id is **different** from the one before reload (confirming new session). If we do not have a session id in the client today, the proxy could log or forward it for E2E only so the test can assert "new session after reload."

**Root cause (component side):** After a new connection (and thus new session), the first assistant message is the greeting. If the user has already sent a message (e.g. "What famous people lived there?") before or while that greeting arrives, the UI must not show the greeting as the **reply** to that message. So the component (or test-app) should:
- Either not treat the first assistant message after a user send as the "agent response" for that turn when it matches the configured greeting, or
- Order/associate messages so that the greeting is shown as the initial greeting and the next assistant message is shown as the response to "What famous people lived there?"

**Next steps:**

1. Validate in code: after reload, is the client explicitly reconnecting to the same session (e.g. sending a stored session id)? If not, document that we always get a new session after reload.
2. Fix the component/test-app so that when the first assistant message after a user message is the greeting text, it is not displayed as the response to that user message; wait for or display the following assistant message as the response.

---

## References

- E2E run summary: [E2E-RUN-RESULTS.md](./E2E-RUN-RESULTS.md) §2b  
- NEXT-STEPS: [NEXT-STEPS.md](./NEXT-STEPS.md)  
- Repro tests: `openai-proxy-e2e.spec.js` — Test 9 (no reload, session retained); Test 10 (reload, session change). Both assert response to "What famous people lived there?" is not greeting and not stale. See [OPENAI-REALTIME-AUDIO-TESTING.md](./OPENAI-REALTIME-AUDIO-TESTING.md) §4.

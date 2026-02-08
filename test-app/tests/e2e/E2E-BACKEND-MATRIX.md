# E2E Backend Matrix (Deepgram vs OpenAI Proxy)

This document flags which E2E specs assume **Deepgram** (direct or Deepgram proxy) vs **OpenAI Realtime proxy** vs backend-agnostic. Use it when running a "full E2E pass" to know which tests apply to which backend.

**Capture full E2E output to a file (recommended for long runs):**
```bash
npm run test:e2e:log
```
Output is printed and saved to `e2e-run.log` in the project root.

---

## OpenAI-proxy-only (Issue #381)

These specs require **VITE_OPENAI_PROXY_ENDPOINT** and the OpenAI proxy (`npm run openai-proxy`). They are skipped when that env is not set. E2E tests are aligned with the [OpenAI proxy protocol](OPENAI-PROTOCOL-E2E.md); see that doc for protocol → test-app mapping.

| Spec | Description |
|------|-------------|
| `openai-proxy-e2e.spec.js` | Connection, messages, multi-turn, reconnection, basic audio, **VAD (Issue #414 test 5b)**, function calling, error handling; protocol user echo |
| `openai-proxy-tts-diagnostic.spec.js` | TTS binary received, wire contract (only PCM as binary), playback status |
| `greeting-playback-validation.spec.js` | Greeting path (connect-only) and agent response TTS; session ordering |
| `openai-inject-connection-stability.spec.js` | Connection stability after injectUserMessage (real OpenAI proxy) |

---

## Deepgram-only (or Deepgram proxy)

These specs assume **Deepgram** backend behavior (e.g. Deepgram server timeouts, Deepgram-specific errors like CLIENT_MESSAGE_TIMEOUT, or direct Deepgram API / Deepgram proxy). When running with **only** the OpenAI proxy (e.g. `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai`), they may fail or behave differently because:

- OpenAI does not send CLIENT_MESSAGE_TIMEOUT; it may send a different error or close the connection.
- Timeouts, VAD, and some message shapes are Deepgram-specific.
- Some specs use `window.deepgramRef` or Deepgram proxy URL (`deepgram-proxy`).

| Spec | Why Deepgram-only |
|------|--------------------|
| `deepgram-client-message-timeout.spec.js` | Assumes **CLIENT_MESSAGE_TIMEOUT** from Deepgram; "Waiting for Deepgram server timeout (~60s)". Skips when `VITE_OPENAI_PROXY_ENDPOINT` is set. |
| `deepgram-text-session-flow.spec.js` | Uses `setupTestPageWithDeepgramProxy`; real Deepgram API. |
| `deepgram-backend-proxy-mode.spec.js` | Expects `deepgram-proxy` endpoint. Skips when `VITE_OPENAI_PROXY_ENDPOINT` is set. |
| `deepgram-callback-test.spec.js` | onTranscriptUpdate, onUserStartedSpeaking, onUserStoppedSpeaking rely on Deepgram transcript/VAD events. Skips those tests when `VITE_OPENAI_PROXY_ENDPOINT` is set. (OpenAI proxy also sends UserStartedSpeaking/UtteranceEnd per Issue #414; see `openai-proxy-e2e.spec.js` test 5b.) |
| `declarative-props-api.spec.js` | Function-call test runs with OpenAI proxy; proxy sends **FunctionCallRequest** on `response.function_call_arguments.done` and maps **FunctionCallResponse** → `conversation.item.create` (function_call_output). |
| `context-retention-agent-usage.spec.js` | Context test runs with OpenAI proxy; proxy maps **Settings.agent.context.messages** → sequence of **conversation.item.create** (OpenAI does not send context in session.update). |
| `context-retention-with-function-calling.spec.js` | Same as above; proxy handles both function-call path and context on reconnect. |
| `deepgram-backend-proxy-authentication.spec.js` | Deepgram proxy auth. |
| `api-key-security-proxy-mode.spec.js` | Deepgram proxy; validates no direct Deepgram connection. |
| `issue-373-idle-timeout-during-function-calls.spec.js` | Real Deepgram API key; proxy endpoint Deepgram. |
| `issue-351-function-call-proxy-mode.spec.js` | Real Deepgram API; Deepgram proxy. |
| `issue-353-binary-json-messages.spec.js` | Simulates Deepgram FunctionCallRequest; Deepgram proxy. |
| `context-retention-with-function-calling.spec.js` | Requires real Deepgram API key. |
| `context-retention-agent-usage.spec.js` | Requires real Deepgram API key; "Deepgram may send greeting...". |
| `dual-channel-text-and-microphone.spec.js` | Real Deepgram API; proxy mode Deepgram. |
| `deepgram-vad-configuration-optimization.spec.js` | VAD requires real Deepgram API. |
| `deepgram-manual-vad-workflow.spec.js` | Real Deepgram APIs for VAD. |
| `deepgram-greeting-idle-timeout.spec.js` | Uses deepgramRef / connection close after idle. |
| `agent-state-transitions.spec.js` | "AgentThinking message is sent by Deepgram". |
| `audio-odd-length-buffer.spec.js` | Uses deepgramRef, getAudioContext. |
| `component-remount-reconnection.spec.js` | Uses deepgramRef. |
| `component-remount-customer-scenario.spec.js` | DeepgramVoiceInteraction logs; deepgramRef. |
| `component-remount-detection.spec.js` | Component logs. |
| `strict-mode-behavior.spec.js` | DeepgramVoiceInteraction init logs. |
| `audio-interruption-timing.spec.js` | deepgramRef.interruptAgent. |
| `deepgram-vad-redundancy-and-agent-timeout.spec.js` | deepgramRef; mock AgentThinking. |
| `deepgram-interim-transcript-validation.spec.js` | "Deepgram sends word-by-word final transcripts". Skips when OpenAI proxy. |
| `deepgram-extended-silence-idle-timeout.spec.js` | VAD/speech detection and idle timeout flow (was `extended-silence-idle-timeout.spec.js`). Skips when OpenAI proxy. |
| `greeting-audio-timing.spec.js` | deepgramRef.current.start. |
| `function-calling-e2e.spec.js` | Test **"Deepgram: should test minimal function definition for SettingsApplied issue"** is Deepgram-only; skips when OpenAI proxy. Other tests may run with either backend. |
| (Others with deepgramRef / skipIfNoRealAPI / Deepgram proxy) | Same pattern. |

**Recommendation:** When running a full E2E pass with **real APIs**, either:

1. Run **Deepgram-backed** tests with Deepgram proxy/API (e.g. `USE_PROXY_MODE=true VITE_DEEPGRAM_PROXY_ENDPOINT=... npm run test:e2e:log`), or  
2. Run **OpenAI-backed** tests only: `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e:log -- openai-proxy-e2e openai-inject-connection-stability`.

Mixing both backends in one run (e.g. only setting VITE_OPENAI_PROXY_ENDPOINT) will cause Deepgram-only specs to hit the wrong backend and produce errors (e.g. OpenAI "server had an error" instead of Deepgram CLIENT_MESSAGE_TIMEOUT).

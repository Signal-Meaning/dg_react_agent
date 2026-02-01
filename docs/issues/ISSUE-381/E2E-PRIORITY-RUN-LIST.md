# E2E Tests: Priority Run List (OpenAI Proxy Change)

**Scope:** This document covers **only the OpenAI proxy E2E suite** — 8 tests in 2 spec files. The repo has many other E2E specs (Deepgram-only or backend-agnostic); those are run separately and are described in [E2E-BACKEND-MATRIX.md](../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md) and in `test-app/tests/e2e/`.

Run these 8 tests **one at a time** in this order when validating the OpenAI proxy change (Issue #381). Tests are ordered from **most likely to fail** (new/changed behavior) to **least likely** (existing flows).

**Prerequisites:**
- **OpenAI proxy running:** `npm run openai-proxy` (from project root). The proxy is **HTTP** by default (`ws://localhost:8080/openai`). Restart the proxy if you restarted the dev server or changed env.
- Run Playwright from **project root** so `test-app` and env are correct.
- Set `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai` (or `wss://` only if you started the proxy with `HTTPS=1`).

**HTTP vs HTTPS (test-app only):** `HTTPS=0` applies to the **test-app dev server** (Vite on port 5173), not the proxy. Use it so the *browser* can load the app over HTTP and avoid TLS/self-signed issues. The proxy stays `ws://` unless you run it with `HTTPS=1`.

---

## Current report

**Run:** 2026-02-01  
**Config:** Option A (Playwright started test-app with `HTTPS=0`), proxy on `ws://localhost:8080/openai`.

| # | Test | Spec (path) | Result |
|---|------|-------------|--------|
| 1 | Basic audio | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |
| 2 | Simple function calling | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |
| 3 | injectUserMessage connection stability | `test-app/tests/e2e/openai-inject-connection-stability.spec.js` | pass |
| 4 | Connection | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |
| 5 | Single message | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |
| 6 | Multi-turn | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |
| 7 | Reconnection | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |
| 8 | Error handling | `test-app/tests/e2e/openai-proxy-e2e.spec.js` | pass |

**Summary:** 8 run, 8 passed. No failing tests. (These are the only E2E tests run for this OpenAI proxy validation.)

---

## How to run

**Option A – Playwright starts the dev server (recommended)**  
When port 5173 is **free**, let Playwright start the test-app. Use `HTTPS=0` so the **test-app** runs over HTTP and Chromium can connect (avoids TLS/self-signed issues with Vite):

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/<spec> --grep "<test title>"
```

**Option B – Pre-started dev server**  
When port 5173 is **already in use** (e.g. you run `npm run dev` in test-app), set `E2E_USE_EXISTING_SERVER=1` so Playwright does not start it again:

```bash
E2E_USE_EXISTING_SERVER=1 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/<spec> --grep "<test title>"
```

- If the app is **HTTP**, the command above is enough.
- If the app is **HTTPS** (e.g. `HTTPS=true` in test-app/.env), set `VITE_BASE_URL=https://localhost:5173`. Note: Chromium may still fail with `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` on some setups; use Option A (stop dev server, run with `HTTPS=0`) for reliable E2E.

---

## Tier 1: Highest risk (new proxy behavior)

These touch binary audio translation, function-call translation, or connection stability and are most likely to fail after the OpenAI change.

| # | Spec | Test (grep) | Why high priority |
|---|------|-------------|-------------------|
| 1 | `openai-proxy-e2e.spec.js` | `Basic audio` | Binary audio → `input_audio_buffer.append` + commit; re-enabled after fix |
| 2 | `openai-proxy-e2e.spec.js` | `Simple function calling` | Function-call translation to ConversationText; new mapper |
| 3 | `openai-inject-connection-stability.spec.js` | `should receive agent response after first text message` | Connection stability after injectUserMessage (Issue #380) |

**Commands (copy-paste; Option A – Playwright starts server with HTTP):**
```bash
# 1. Basic audio
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Basic audio"

# 2. Simple function calling
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Simple function calling"

# 3. injectUserMessage connection stability
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-inject-connection-stability.spec.js
```
*(Option B: prefix with `E2E_USE_EXISTING_SERVER=1` and omit `HTTPS=0` when using a pre-started dev server.)*

---

## Tier 2: Core OpenAI proxy flows

Same spec; connection, messaging, and reconnection. Failures here indicate regressions in core proxy or component behavior.

| # | Spec | Test (grep) | Why |
|---|------|-------------|-----|
| 4 | `openai-proxy-e2e.spec.js` | `Connection` | Connect + settings; baseline |
| 5 | `openai-proxy-e2e.spec.js` | `Single message` | One user message → one agent response |
| 6 | `openai-proxy-e2e.spec.js` | `Multi-turn` | Sequential messages and responses |
| 7 | `openai-proxy-e2e.spec.js` | `Reconnection` | Disconnect then send; reconnects and gets response |
| 8 | `openai-proxy-e2e.spec.js` | `Error handling` | Wrong proxy URL → closed/error, no hang |

**Commands (Option A – Playwright starts server):**
```bash
# 4. Connection
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Connection"

# 5. Single message
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Single message"

# 6. Multi-turn
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Multi-turn"

# 7. Reconnection
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Reconnection"

# 8. Error handling
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Error handling"
```

---

## Tier 3: Run full OpenAI proxy suite

Once Tier 1 and 2 pass, run the full OpenAI proxy suite in one go (8 tests):

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js
```
*(With pre-started server: `E2E_USE_EXISTING_SERVER=1` and omit `HTTPS=0`.)*

---

## Remaining E2E tests (real API pass)

These are the **remaining** E2E specs (all except the 8 OpenAI-proxy tests above). Run this pass with the **OpenAI proxy** (same backend as the 8 tests above). See [E2E-BACKEND-MATRIX.md](../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md) for which specs assume Deepgram vs OpenAI; some specs may skip or fail when only the OpenAI proxy is used.

**Ordering:** Table is ordered by **regression risk** — connection/auth and core flows first, then function calling/context, idle/timeout/state, audio/mic, component lifecycle, config/callbacks/misc. **VAD specs (51–59) are at the end and can be deferred** — they require Deepgram-specific behavior.

**How to run:** OpenAI proxy running (`npm run openai-proxy`), `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai`, and (when Playwright starts the test-app) `HTTPS=0`. Run one spec: `HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/<spec>`. For a full pass, `npm run test:e2e:log` (output in `e2e-run.log`).

| Order | Spec (path) | Focus | Result |
|-------|-------------|--------|--------|
| 1 | `test-app/tests/e2e/text-session-flow.spec.js` | Deepgram proxy; real API session flow | — |
| 2 | `test-app/tests/e2e/backend-proxy-mode.spec.js` | Deepgram proxy endpoint; connection | — |
| 3 | `test-app/tests/e2e/backend-proxy-authentication.spec.js` | Deepgram proxy auth | — |
| 4 | `test-app/tests/e2e/api-key-security-proxy-mode.spec.js` | No direct Deepgram connection in proxy mode | — |
| 5 | `test-app/tests/e2e/client-message-timeout.spec.js` | Deepgram CLIENT_MESSAGE_TIMEOUT (~60s) | — |
| 6 | `test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js` | Function calling via Deepgram proxy | — |
| 7 | `test-app/tests/e2e/issue-353-binary-json-messages.spec.js` | Deepgram FunctionCallRequest; binary/JSON | — |
| 8 | `test-app/tests/e2e/issue-373-idle-timeout-during-function-calls.spec.js` | Idle timeout during function calls | — |
| 9 | `test-app/tests/e2e/context-retention-with-function-calling.spec.js` | Context retention + function calling | — |
| 10 | `test-app/tests/e2e/context-retention-agent-usage.spec.js` | Context retention; agent greeting | — |
| 11 | `test-app/tests/e2e/function-calling-e2e.spec.js` | Function calling E2E | — |
| 12 | `test-app/tests/e2e/idle-timeout-behavior.spec.js` | Idle timeout behavior | — |
| 13 | `test-app/tests/e2e/idle-timeout-during-agent-speech.spec.js` | Idle timeout during agent speech | — |
| 14 | `test-app/tests/e2e/greeting-idle-timeout.spec.js` | Greeting + idle; deepgramRef / close | — |
| 15 | `test-app/tests/e2e/extended-silence-idle-timeout.spec.js` | Extended silence; idle timeout | — |
| 16 | `test-app/tests/e2e/suspended-audiocontext-idle-timeout.spec.js` | Suspended AudioContext + idle timeout | — |
| 17 | `test-app/tests/e2e/text-idle-timeout-suspended-audio.spec.js` | Text session; idle timeout; suspended audio | — |
| 18 | `test-app/tests/e2e/agent-state-transitions.spec.js` | AgentThinking / Deepgram state transitions | — |
| 19 | `test-app/tests/e2e/deepgram-ux-protocol.spec.js` | Deepgram UX protocol | — |
| 20 | `test-app/tests/e2e/agent-options-resend-issue311.spec.js` | Agent options resend (Issue #311) | — |
| 21 | `test-app/tests/e2e/audio-odd-length-buffer.spec.js` | Audio odd-length buffer | — |
| 22 | `test-app/tests/e2e/audio-interruption-timing.spec.js` | Audio interruption timing | — |
| 23 | `test-app/tests/e2e/greeting-audio-timing.spec.js` | Greeting audio timing | — |
| 24 | `test-app/tests/e2e/echo-cancellation.spec.js` | Echo cancellation | — |
| 25 | `test-app/tests/e2e/dual-channel-text-and-microphone.spec.js` | Dual channel text + microphone | — |
| 26 | `test-app/tests/e2e/microphone-control.spec.js` | Microphone control | — |
| 27 | `test-app/tests/e2e/microphone-functionality.spec.js` | Microphone functionality | — |
| 28 | `test-app/tests/e2e/microphone-functionality-fixed.spec.js` | Microphone functionality (fixed) | — |
| 29 | `test-app/tests/e2e/microphone-activation-after-idle-timeout.spec.js` | Mic activation after idle timeout | — |
| 30 | `test-app/tests/e2e/microphone-reliability.spec.js` | Microphone reliability | — |
| 31 | `test-app/tests/e2e/simple-mic-test.spec.js` | Simple mic test | — |
| 32 | `test-app/tests/e2e/component-remount-reconnection.spec.js` | Component remount; reconnection | — |
| 33 | `test-app/tests/e2e/component-remount-customer-scenario.spec.js` | Component remount customer scenario | — |
| 34 | `test-app/tests/e2e/component-remount-detection.spec.js` | Component remount detection | — |
| 35 | `test-app/tests/e2e/strict-mode-behavior.spec.js` | Strict mode behavior | — |
| 36 | `test-app/tests/e2e/lazy-initialization-e2e.spec.js` | Lazy initialization E2E | — |
| 37 | `test-app/tests/e2e/declarative-props-api.spec.js` | Declarative props API | — |
| 38 | `test-app/tests/e2e/protocol-validation-modes.spec.js` | Protocol validation modes | — |
| 39 | `test-app/tests/e2e/transcription-config-test.spec.js` | Transcription config | — |
| 40 | `test-app/tests/e2e/deepgram-instructions-file.spec.js` | Deepgram instructions file | — |
| 41 | `test-app/tests/e2e/callback-test.spec.js` | Callbacks | — |
| 42 | `test-app/tests/e2e/user-stopped-speaking-callback.spec.js` | User stopped speaking callback | — |
| 43 | `test-app/tests/e2e/user-stopped-speaking-demonstration.spec.js` | User stopped speaking demo | — |
| 44 | `test-app/tests/e2e/page-content.spec.js` | Page content | — |
| 45 | `test-app/tests/e2e/api-key-validation.spec.js` | API key validation | — |
| 46 | `test-app/tests/e2e/baseurl-test.spec.js` | Base URL | — |
| 47 | `test-app/tests/e2e/real-user-workflows.spec.js` | Real user workflows | — |
| 48 | `test-app/tests/e2e/react-error-test.spec.js` | React error handling | — |
| 49 | `test-app/tests/e2e/js-error-test.spec.js` | JS error handling | — |
| 50 | `test-app/tests/e2e/logging-behavior.spec.js` | Logging behavior | — |
| 51 | `test-app/tests/e2e/manual-diagnostic.spec.js` | Manual diagnostic | — |
| 52 | `test-app/tests/e2e/vad-events-core.spec.js` | VAD events core (deferred) | — |
| 53 | `test-app/tests/e2e/vad-configuration-optimization.spec.js` | VAD config optimization (deferred) | — |
| 54 | `test-app/tests/e2e/vad-audio-patterns.spec.js` | VAD audio patterns (deferred) | — |
| 55 | `test-app/tests/e2e/vad-redundancy-and-agent-timeout.spec.js` | VAD redundancy; agent timeout (deferred) | — |
| 56 | `test-app/tests/e2e/vad-transcript-analysis.spec.js` | VAD transcript analysis (deferred) | — |
| 57 | `test-app/tests/e2e/vad-websocket-events.spec.js` | VAD WebSocket events (deferred) | — |
| 58 | `test-app/tests/e2e/manual-vad-workflow.spec.js` | Manual VAD workflow (deferred) | — |
| 59 | `test-app/tests/e2e/interim-transcript-validation.spec.js` | Interim / word-by-word transcript (deferred) | — |
| 60 | `test-app/tests/e2e/diagnostic-vad.spec.js` | Diagnostic VAD (deferred) | — |

**Summary (fill after run):** _ of 60 passed. Record pass/fail in the Result column (e.g. pass / fail / skip). VAD specs (52–60) can be deferred.

**Remaining pass status:** A full run with the OpenAI proxy was started; it was interrupted (timeout) after ~80 of 218 tests. Partial output is in `docs/issues/ISSUE-381/e2e-remaining-run.log`. To run the full remaining pass to completion, use a long timeout or run in background, e.g. `HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e:log` (output in project root `e2e-run.log`). Many specs are Deepgram-only and will skip or fail when only the OpenAI proxy is set; fill the Result column from the final report.

---

## Troubleshooting (only when a test fails)

**Ignore this section when all tests pass.** Use the table below only when a test fails; it lists what to check or fix for that test.

| Test(s) | If fail → next steps |
|--------|----------------------|
| **1. Basic audio** | Proxy may not be translating binary → `input_audio_buffer.append` + commit. Check `scripts/openai-proxy/translator.ts` `binaryToInputAudioBufferAppend`, `server.ts` binary handling and debounce/commit. Ensure audio fixture exists (`/audio-samples/hello.wav` or `sample_hello.json`). |
| **2. Simple function calling** | Proxy may not be mapping OpenAI function-call events to ConversationText. Check `scripts/openai-proxy/translator.ts` `mapFunctionCallArgumentsDoneToConversationText` and `server.ts` sending that to client. Test mode + `enable-function-calling` must be in URL params. |
| **3. injectUserMessage connection stability** | Upstream (OpenAI) may be closing after first message (Issue #380). Check proxy doesn’t close the WebSocket prematurely; check OpenAI Realtime API behavior. |
| **4. Connection** | Proxy or test-app not reachable. Confirm proxy is running (`lsof -i :8080`), test-app or Playwright webServer is up. Check `VITE_OPENAI_PROXY_ENDPOINT`; if using a pre-started test-app, set base URL (HTTP/HTTPS for **test-app** only). |
| **5. Single message** / **6. Multi-turn** | Agent response not reaching UI. Check proxy forwards `ConversationText` / response events; check component renders `[data-testid="agent-response"]`. Timeout: increase `AGENT_RESPONSE_TIMEOUT` in spec or check OpenAI latency. |
| **7. Reconnection** | Disconnect/reconnect or component state issue. Check `disconnectComponent` helper and that sending again after disconnect triggers reconnect and response. |
| **8. Error handling** | Expects wrong proxy URL to show closed/error. If this fails, the app may be hanging instead of showing status; check connection-status element and error handling in component. |

**General:** Restart the proxy if needed. If Playwright starts the test-app (Option A), use `HTTPS=0` so the **test-app** is HTTP (proxy is already ws://). For flaky runs, run the failing test in isolation with `--retries=0` and inspect `test-results/` (screenshots, trace).

---

## Quick reference: all Tier 1 + 2 in order

1. Basic audio  
2. Simple function calling  
3. injectUserMessage connection stability  
4. Connection  
5. Single message  
6. Multi-turn  
7. Reconnection  
8. Error handling  

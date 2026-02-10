# E2E Tests: Priority Run List (OpenAI Proxy Change)

**Scope:** This document covers the **OpenAI proxy E2E suite** — **13 tests** in 4 spec files. Tests are numbered **1–13** everywhere in this doc; the same number always refers to the same test. The repo has many other E2E specs (Deepgram-only or backend-agnostic); those are in the "Remaining E2E tests" table and [E2E-BACKEND-MATRIX.md](../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md).

**Note on `e2e-remaining-run.log`:** That file is from a **previous full E2E run** (interrupted). The **priority list** (Tiers 1–4) is the source of truth for validating the OpenAI proxy (Issue #381).

Run the **13 tests** in **Tier order** (Tier 1 → Tier 2 → Tier 3 → Tier 4). Within each tier, run in the order given. Tier 1 is highest risk (new/changed behavior); Tier 4 is context retention.

**Prerequisites:**
- **Real API key set:** For safety, run these E2E only when **OPENAI_API_KEY** is set (truthy). The proxy requires it for upstream auth and will not start without it. Do not run real-API E2E without a valid key (e.g. in CI without secrets, or with an empty/placeholder env).
- **OpenAI proxy running:** `npm run openai-proxy` (from project root). The proxy is **HTTP** by default (`ws://localhost:8080/openai`). Restart the proxy if you restarted the dev server or changed env.
- Run Playwright from **project root** so `test-app` and env are correct.
- Set `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai` (or `wss://` only if you started the proxy with `HTTPS=1`).

**HTTP vs HTTPS (test-app only):** `HTTPS=0` applies to the **test-app dev server** (Vite on port 5173), not the proxy. Use it so the *browser* can load the app over HTTP and avoid TLS/self-signed issues. The proxy stays `ws://` unless you run it with `HTTPS=1`.

**Numbering (1–13):** 1 Connection | 2 Greeting | 3 Single message | 4 Multi-turn | 5 Reconnection | 6 Basic audio | 7 Simple function calling | 8 Reconnection with context | 9 Error handling | 10 injectUserMessage connection stability | 11 Context retain (agent uses context) | 12 Context format in Settings | 13 Context with function calling.

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

| # | Spec | Test (grep) | Result | Why high priority |
|---|------|-------------|--------|-------------------|
| 6 | `openai-proxy-e2e.spec.js` | `Basic audio` | pass | Binary audio → `input_audio_buffer.append` + commit; re-enabled after fix |
| 7 | `openai-proxy-e2e.spec.js` | `Simple function calling` | pass | Function-call translation to ConversationText; new mapper |
| 10 | `openai-inject-connection-stability.spec.js` | `should receive agent response after first text message` | pass | Connection stability after injectUserMessage (Issue #380) |

**Commands (copy-paste; Option A – Playwright starts server with HTTP):**
```bash
# 6. Basic audio
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Basic audio"

# 7. Simple function calling
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Simple function calling"

# 10. injectUserMessage connection stability
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-inject-connection-stability.spec.js
```
*(Option B: prefix with `E2E_USE_EXISTING_SERVER=1` and omit `HTTPS=0` when using a pre-started dev server.)*

---

## Tier 2: Core OpenAI proxy flows

Same spec; connection, messaging, and reconnection. Failures here indicate regressions in core proxy or component behavior.

| # | Spec | Test (grep) | Result | Why |
|---|------|-------------|--------|-----|
| 1 | `openai-proxy-e2e.spec.js` | `Connection` | pass | Connect + settings; baseline |
| 2 | `openai-proxy-e2e.spec.js` | `1b. Greeting` | pass | Proxy injects greeting after session.updated; component shows greeting-sent (Issue #381) |
| 3 | `openai-proxy-e2e.spec.js` | `Single message` | pass | One user message → one agent response |
| 4 | `openai-proxy-e2e.spec.js` | `Multi-turn` | pass | Sequential messages and responses |
| 5 | `openai-proxy-e2e.spec.js` | `Reconnection` | pass | Disconnect then send; reconnects and gets response |
| 8 | `openai-proxy-e2e.spec.js` | `Reconnection with context` | pass | Disconnect, reconnect; proxy sends context via conversation.item.create |
| 9 | `openai-proxy-e2e.spec.js` | `Error handling` | pass | Wrong proxy URL → closed/error, no hang |

**Commands (Option A – Playwright starts server):**
```bash
# 1. Connection
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Connection"

# 2. Greeting (proxy injects greeting; component shows greeting-sent)
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "1b. Greeting"

# 3. Single message
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Single message"

# 4. Multi-turn
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Multi-turn"

# 5. Reconnection
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Reconnection"

# 8. Reconnection with context
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Reconnection with context"

# 9. Error handling
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Error handling"
```

---

## Tier 3: Run full OpenAI proxy suite (tests 1–10)

Once Tier 1 and 2 pass, run the full OpenAI proxy suite in one go (tests 1–10):

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js
```
*(With pre-started server: `E2E_USE_EXISTING_SERVER=1` and omit `HTTPS=0`.)*

## Tier 4: Context retention (tests 11–13)

Run context retention specs with the OpenAI proxy (same env as above).

| # | Spec | Test (grep) | Result | Focus |
|---|------|-------------|--------|--------|
| 11 | `context-retention-agent-usage.spec.js` | `should retain context when disconnecting and reconnecting - agent uses context` | pass | Agent uses context after reconnect |
| 12 | `context-retention-agent-usage.spec.js` | `should verify context format in Settings message` | pass | Context format in Settings |
| 13 | `context-retention-with-function-calling.spec.js` | `should retain context when disconnecting and reconnecting with function calling enabled` | pass | Context + function calling |

```bash
# 11–12. Context retention – agent uses context
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/context-retention-agent-usage.spec.js

# 13. Context retention with function calling
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/context-retention-with-function-calling.spec.js
```

**Run all 13 tests (stabilize + context retention):**
```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js test-app/tests/e2e/context-retention-agent-usage.spec.js test-app/tests/e2e/context-retention-with-function-calling.spec.js
```

---

## Remaining E2E tests (real API pass)

These are the **remaining** E2E specs (all except the 13 tests in the tracking table above). Run with the **OpenAI proxy** when validating Issue #381. See [E2E-BACKEND-MATRIX.md](../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md) for which specs assume Deepgram vs OpenAI.

**Run order:** The **recommended plan** for Issue #381 is to run the **13 tests in Tiers 1–4** (above) in that order — not this table. The **Order** column in the table below is a **suggested order** only if you choose to run these remaining specs (e.g. to fill in "not run" or expand coverage); skip or defer Deepgram-only rows when running with the OpenAI proxy.

**Result legend:**  
- **pass** = Run with OpenAI proxy for this issue and passed.  
- **skip (OpenAI)** = Spec explicitly skips when `VITE_OPENAI_PROXY_ENDPOINT` is set (so not run against OpenAI in this pass).  
- **not run** = We have **not run** this spec in this OpenAI proxy pass; use "not run" (do not use `--`). May be expandable to both backends later.

**Naming and Backend column:**  
- Only specs that **truly** require Deepgram are labeled "Deepgram-only". Those specs are **renamed** to include `deepgram-` in the filename (e.g. `backend-proxy-mode.spec.js` → `deepgram-backend-proxy-mode.spec.js`). Specs that could be expanded to both backends are **not** labeled Deepgram-only and are not renamed.  
- **Corresponding Test:** For Deepgram-only rows, the "Corresponding Test" column gives the OpenAI priority test number (1–13) to run instead when using the OpenAI proxy, when a suitable equivalent exists; otherwise blank.
- **Why Deepgram-only:** For every renamed (Deepgram-only) spec, this column states why the test cannot be revised to work for both Voice Agent types (Deepgram and OpenAI). Blank for Both (expandable).

**Ordering:** By regression risk — connection/auth first, then function calling/context, idle/timeout, audio/mic, component lifecycle, config/callbacks. VAD specs (52–60) deferred.

**How to run:** `HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/<spec>`.

| Order | Spec (path) | Backend | Corresponding Test | Why Deepgram-only | Focus | Result |
|-------|-------------|---------|-------------------|-------------------|--------|--------|
| 1 | `deepgram-text-session-flow.spec.js` | Deepgram-only | 1–5 | Uses Deepgram proxy URL and Deepgram session lifecycle; OpenAI has different message shapes and session flow (covered by tests 1–5). | Real API session flow (Deepgram proxy today) | not run |
| 2 | `deepgram-backend-proxy-mode.spec.js` | Deepgram-only | 1 | Hard-coded to Deepgram proxy endpoint and protocol; OpenAI proxy uses different URL path and wire format. | Proxy endpoint; connection | skip (OpenAI) |
| 3 | `deepgram-backend-proxy-authentication.spec.js` | Deepgram-only | — | Asserts Deepgram proxy auth (token, optional auth). OpenAI proxy has a different auth model; no equivalent flow under test. | Proxy auth | not run |
| 4 | `api-key-security-proxy-mode.spec.js` | Both (expandable) | — | — | No direct API key in proxy mode | skip (OpenAI) |
| 5 | `deepgram-client-message-timeout.spec.js` | Deepgram-only | — | Asserts **CLIENT_MESSAGE_TIMEOUT** event (~60s) from Deepgram server. OpenAI does not emit this event; timeout/error semantics differ. | CLIENT_MESSAGE_TIMEOUT (~60s) | not run |
| 6 | `issue-351-function-call-proxy-mode.spec.js` | Both (expandable) | — | — | Function calling via proxy | skip (OpenAI) |
| 7 | `issue-353-binary-json-messages.spec.js` | Both (expandable) | — | — | FunctionCallRequest; binary/JSON | skip (OpenAI) |
| 8 | `issue-373-idle-timeout-during-function-calls.spec.js` | Both (expandable) | — | — | Idle timeout during function calls | not run |
| 9 | `context-retention-with-function-calling.spec.js` | Both (expandable) | — | — | Context retention + function calling | pass |
| 10 | `context-retention-agent-usage.spec.js` | Both (expandable) | — | — | Context retention; agent greeting | pass |
| 11 | `function-calling-e2e.spec.js` | Both (expandable) | — | — | Function calling E2E | pass (8 tests; run with --timeout=120000 --global-timeout=600000) |
| 12 | `idle-timeout-behavior.spec.js` | Both (expandable) | — | — | Idle timeout behavior | mixed (1 pass; several fail e.g. Issue #262) |
| 13 | `idle-timeout-during-agent-speech.spec.js` | Both (expandable) | — | — | Idle timeout during agent speech | not run |
| 14 | `deepgram-greeting-idle-timeout.spec.js` | Deepgram-only | 2 | Uses `deepgramRef` and Deepgram-specific connection close after idle; OpenAI has different idle/close semantics. | Greeting + idle; deepgramRef/close | not run |
| 15 | `extended-silence-idle-timeout.spec.js` | Both (expandable) | — | — | Extended silence; idle timeout | fail (speech detection / audio path) |
| 16 | `suspended-audiocontext-idle-timeout.spec.js` | Both (expandable) | — | — | Suspended AudioContext + idle timeout | not run |
| 17 | `text-idle-timeout-suspended-audio.spec.js` | Both (expandable) | — | — | Text session; idle timeout; suspended audio | not run |
| 18 | `agent-state-transitions.spec.js` | Both (expandable) | — | — | AgentThinking / state transitions | pass |
| 19 | `deepgram-ux-protocol.spec.js` | Deepgram-only | 1 | Asserts Deepgram UX protocol message shapes and ordering; OpenAI Realtime uses different message types and sequence. | UX protocol | not run |
| 20 | `agent-options-resend-issue311.spec.js` | Both (expandable) | — | — | Agent options resend (Issue #311) | pass |
| 21 | `audio-odd-length-buffer.spec.js` | Both (expandable) | — | — | Audio odd-length buffer | pass |
| 22 | `audio-interruption-timing.spec.js` | Both (expandable) | — | — | Audio interruption timing | not run |
| 23 | `greeting-audio-timing.spec.js` | Both (expandable) | — | — | Greeting audio timing | not run |
| 24 | `echo-cancellation.spec.js` | Both (expandable) | — | — | Echo cancellation | not run |
| 25 | `dual-channel-text-and-microphone.spec.js` | Both (expandable) | — | — | Dual channel text + microphone | not run |
| 26 | `microphone-control.spec.js` | Both (expandable) | — | — | Microphone control | not run |
| 27 | `microphone-functionality.spec.js` | Both (expandable) | — | — | Microphone functionality | not run |
| 28 | `microphone-functionality-fixed.spec.js` | Both (expandable) | — | — | Microphone functionality (fixed) | not run |
| 29 | `microphone-activation-after-idle-timeout.spec.js` | Both (expandable) | — | — | Mic activation after idle timeout | not run |
| 30 | `microphone-reliability.spec.js` | Both (expandable) | — | — | Microphone reliability | not run |
| 31 | `simple-mic-test.spec.js` | Both (expandable) | — | — | Simple mic test | not run |
| 32 | `component-remount-reconnection.spec.js` | Both (expandable) | — | — | Component remount; reconnection | pass |
| 33 | `component-remount-customer-scenario.spec.js` | Both (expandable) | — | — | Component remount customer scenario | pass |
| 34 | `component-remount-detection.spec.js` | Both (expandable) | — | — | Component remount detection | pass |
| 35 | `strict-mode-behavior.spec.js` | Both (expandable) | — | — | Strict mode behavior | not run |
| 36 | `lazy-initialization-e2e.spec.js` | Both (expandable) | — | — | Lazy initialization E2E | not run |
| 37 | `declarative-props-api.spec.js` | Both (expandable) | — | — | Declarative props (function-call callback); skips when OpenAI | skip (OpenAI) |
| 38 | `protocol-validation-modes.spec.js` | Both (expandable) | — | — | Protocol validation modes | pass |
| 39 | `transcription-config-test.spec.js` | Both (expandable) | — | — | Transcription config | not run |
| 40 | `instructions-e2e.spec.js` | Both (expandable) | — | — | Instructions pipeline (load, preview, VA integration); runs for Deepgram or OpenAI by env | not run |
| 41 | `callback-test.spec.js` | Deepgram-only | 6 | onTranscriptUpdate, onUserStartedSpeaking, onUserStoppedSpeaking depend on Deepgram transcript and VAD events; OpenAI does not send equivalent events (would require proxy to synthesize; not implemented). | Callbacks; transcript/VAD (audio path ≈ test 6) | skip (OpenAI) |
| 42 | `user-stopped-speaking-callback.spec.js` | Both (expandable) | — | — | User stopped speaking callback | not run |
| 43 | `user-stopped-speaking-demonstration.spec.js` | Both (expandable) | — | — | User stopped speaking demo | not run |
| 44 | `page-content.spec.js` | Both (expandable) | — | — | Page content | pass |
| 45 | `api-key-validation.spec.js` | Both (expandable) | — | — | API key validation | pass |
| 46 | `baseurl-test.spec.js` | Both (expandable) | — | — | Base URL | pass |
| 47 | `real-user-workflows.spec.js` | Both (expandable) | — | — | Real user workflows | not run |
| 48 | `react-error-test.spec.js` | Both (expandable) | — | — | React error handling | not run |
| 49 | `js-error-test.spec.js` | Both (expandable) | — | — | JS error handling | not run |
| 50 | `logging-behavior.spec.js` | Both (expandable) | — | — | Logging behavior | not run |
| 51 | `manual-diagnostic.spec.js` | Both (expandable) | — | — | Manual diagnostic | not run |
| 52 | `deepgram-vad-events-core.spec.js` | Deepgram-only | — | VAD (voice activity detection) events are Deepgram-specific; OpenAI Realtime has no equivalent VAD event stream. | VAD events core (deferred) | not run |
| 53 | `deepgram-vad-configuration-optimization.spec.js` | Deepgram-only | — | VAD config and tuning target Deepgram API; no OpenAI equivalent. | VAD config (deferred) | not run |
| 54 | `deepgram-vad-audio-patterns.spec.js` | Deepgram-only | — | Asserts Deepgram VAD audio patterns; OpenAI audio path differs. | VAD audio patterns (deferred) | not run |
| 55 | `deepgram-vad-redundancy-and-agent-timeout.spec.js` | Deepgram-only | — | Uses deepgramRef and Deepgram AgentThinking/VAD; no OpenAI equivalent. | VAD redundancy; agent timeout (deferred) | not run |
| 56 | `deepgram-vad-transcript-analysis.spec.js` | Deepgram-only | — | VAD-driven transcript analysis is Deepgram-specific. | VAD transcript analysis (deferred) | not run |
| 57 | `deepgram-vad-websocket-events.spec.js` | Deepgram-only | — | Asserts Deepgram WebSocket VAD event shapes; OpenAI protocol differs. | VAD WebSocket events (deferred) | not run |
| 58 | `deepgram-manual-vad-workflow.spec.js` | Deepgram-only | — | Manual VAD workflow targets Deepgram API; no OpenAI equivalent. | Manual VAD workflow (deferred) | not run |
| 59 | `deepgram-interim-transcript-validation.spec.js` | Deepgram-only | — | Deepgram sends word-by-word/final transcript events; OpenAI does not expose equivalent interim transcript stream. | Interim / word-by-word transcript (deferred) | not run |
| 60 | `deepgram-diagnostic-vad.spec.js` | Deepgram-only | — | Diagnostic VAD tooling is Deepgram-specific. | Diagnostic VAD (deferred) | not run |

---

### Assortment: run "Both (expandable)" specs against OpenAI (peace of mind)

Run these **Both (expandable)** specs with the OpenAI proxy to fill in "not run" and validate behavior. Update the **Result** column in the table above in place after each run. **Prerequisites:** **OPENAI_API_KEY** set (truthy), proxy running (`npm run openai-proxy`), same env as Tiers 1–4.

**Suggested assortment (one command per spec; Option A – Playwright starts server):**

```bash
# Order 4 – api-key-security-proxy-mode
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/api-key-security-proxy-mode.spec.js

# Order 6 – issue-351-function-call-proxy-mode (function calling via proxy)
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js

# Order 7 – issue-353-binary-json-messages
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/issue-353-binary-json-messages.spec.js

# Order 11 – function-calling-e2e
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/function-calling-e2e.spec.js

# Order 12 – idle-timeout-behavior
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/idle-timeout-behavior.spec.js

# Order 15 – extended-silence-idle-timeout
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/extended-silence-idle-timeout.spec.js

# Order 38 – protocol-validation-modes
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/protocol-validation-modes.spec.js

# Order 44 – page-content
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/page-content.spec.js
```

**Run the whole assortment in one go (same 8 specs):**

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/api-key-security-proxy-mode.spec.js test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js test-app/tests/e2e/issue-353-binary-json-messages.spec.js test-app/tests/e2e/function-calling-e2e.spec.js test-app/tests/e2e/idle-timeout-behavior.spec.js test-app/tests/e2e/extended-silence-idle-timeout.spec.js test-app/tests/e2e/protocol-validation-modes.spec.js test-app/tests/e2e/page-content.spec.js
```

*(With pre-started dev server: prefix with `E2E_USE_EXISTING_SERVER=1` and omit `HTTPS=0`.)*

---

**Summary (partial run):** From the interrupted run (~80 of 218 tests): **8 passed**, **47 not run**; with post-fix targeted runs: **context-retention-agent-usage** (2 tests) **pass**, **declarative-props function-call** **skip** when OpenAI, **context-retention-with-function-calling** **pass** when proxy is running and real API sends `response.function_call_arguments.done`. VAD specs (52–60) can be deferred.

**Suggested assortment (5 remaining specs) run:** **protocol-validation-modes** (2 tests) and **page-content** (2 tests) **pass**. **function-calling-e2e**: **pass** (8 tests, ~25.5s when run in isolation with `--timeout=120000 --global-timeout=600000`). **idle-timeout-behavior**: 1 test passed (“Idle timeout works correctly after agent finishes”); several failed (e.g. Issue #262 “IdleTimeoutService should start timeout countdown”, UtteranceEnd, realistic timing). **extended-silence-idle-timeout**: **fail** (speech detection / audio path with OpenAI proxy). Result column in Remaining E2E table updated for orders 11, 12, 15, 38, 44.

**Remaining pass status:** The **priority list** is **tests 1–13** in **Tiers 1–4** (see above); status is updated in place in each Tier table. The file `e2e-remaining-run.log` is from an earlier full E2E run (interrupted); ignore or archive it. **Tests 1–10** (OpenAI proxy suite) and **11–13** (context retention) **pass** when proxy running. **Skipped when OpenAI:** deepgram-backend-proxy-mode, callback-test (transcript/VAD), declarative-props (function-call — use test 7 "Simple function calling"). Deepgram-only specs (e.g. deepgram-backend-proxy-mode) keep prefix where needed; run the **Corresponding Test** (1–13) when using the OpenAI proxy. Proxy unit (28) and integration (12) tests include greeting. To run all 13: see "Run all 13 tests" under Tier 4.

---

## Plan for 5 failures (OpenAI proxy pass)

When examining these failures, use **two assumptions in order**: (1) **Defect in the OpenAI proxy** — fix or extend the proxy. (2) **Test promotes an antipattern** — impose a best practice (skip when OpenAI, relax assertion, or document backend-specific behavior).

Investigation order: **1 → 2 → 3 → 4 → 5** (declarative-props first, then callback-test, then context-retention, then deepgram-backend-proxy-mode).

| # | Spec | Failing test(s) | Assumption 1: Proxy defect? | Assumption 2: Antipattern / best practice |
|---|------|------------------|------------------------------|-------------------------------------------|
| **1** | **declarative-props-api** | `should handle function call response via callback return value` | Proxy forwards function-call events (validated by integration test: function-call round-trip). | **Done:** Skip when OpenAI proxy (`skipIfOpenAIProxy`); when run (e.g. Deepgram), test **requires** real function call (fails on timeout; no fake pass on handler-set). OpenAI function-call flow covered by openai-proxy-e2e "Simple function calling" and proxy integration test. |
| **2** | **callback-test** | `onTranscriptUpdate`, `onUserStartedSpeaking`, `onUserStoppedSpeaking` (with audio sample) | Proxy may not be emitting **transcript** or **VAD-like** events the component uses for these callbacks. OpenAI Realtime uses different events (e.g. `response.output_item.done`, no Deepgram-style interim/final transcript). **Check:** Whether proxy should map OpenAI response segments to component transcript events; whether input_audio_buffer commit or upstream events can drive onUserStartedSpeaking / onUserStoppedSpeaking. | Tests assume Deepgram transcript and VAD semantics. **Best practice:** Skip transcript/VAD callback tests when `VITE_OPENAI_PROXY_ENDPOINT` is set (mark Deepgram-only in E2E-BACKEND-MATRIX); or define and implement OpenAI-equivalent events in the proxy and document. |
| **3** | **context-retention-agent-usage** | `should retain context when disconnecting and reconnecting - agent uses context` | Proxy forwards context (Settings.agent.context.messages → conversation.item.create; validated by integration test). | **Done:** Tests use `setupTestPageWithOpenAIProxy` when env set; test app adds user message to conversationHistory optimistically in `handleTextSubmit` (dedupe in `handleUserMessage`). Both tests **pass**. |
| **4** | **context-retention-with-function-calling** | `should retain context when disconnecting and reconnecting with function calling enabled` | **Done:** Proxy delivers FunctionCallRequest when upstream sends `response.function_call_arguments.done`; context on reconnect forwarded. Passes when proxy is running and real API sends .done. | **Done:** Test asserts FCR received, handler invoked (requestCount > 0), and context retained after reconnect. E2E passes when proxy running; ensure proxy is restarted if API behavior was inconsistent. |
| **5** | **deepgram-backend-proxy-mode** | All tests (connect through endpoint, agent responses, reconnection) | Spec uses **Deepgram proxy** URL (`VITE_PROXY_ENDPOINT` default `ws://localhost:8080/deepgram-proxy`). When only `VITE_OPENAI_PROXY_ENDPOINT` is set, tests still use generic proxy config and expect deepgram-proxy; connection to OpenAI proxy at `/openai` is a different protocol. **Check:** N/A — this is not an OpenAI proxy defect. | **Best practice:** Skip when `VITE_OPENAI_PROXY_ENDPOINT` is set (Deepgram-only). Add `skipIfOpenAIProxy()` in spec or in beforeEach; document in E2E-BACKEND-MATRIX. |

**Actions (concise):**  
1. **declarative-props-api:** Skip when OpenAI proxy; when run (e.g. Deepgram), require real function call (no fake pass on handler-set). **Done:** `skipIfOpenAIProxy()` in both function-call tests; removed try/catch that passed on timeout; test fails if no function call in 45s.  
2. **callback-test:** Skip transcript/VAD tests when OpenAI proxy. **Done:** `skipIfOpenAIProxy()` in onTranscriptUpdate, onUserStartedSpeaking, onUserStoppedSpeaking.  
3. **context-retention-agent-usage:** Use OpenAI proxy URL when set; ensure user message in context. **Done:** `setupTestPageWithOpenAIProxy` when env set; test app optimistic user message in `handleTextSubmit` + dedupe in `handleUserMessage`. Both tests pass.  
4. **context-retention-with-function-calling:** Use OpenAI proxy URL + enable-function-calling when env set. **Done:** URL built with proxy params + enable-function-calling; **passes** when proxy is running and real API sends `response.function_call_arguments.done` (FCR + handler + context retention validated).  
5. **deepgram-backend-proxy-mode:** Skip when OpenAI proxy. **Done:** `skipIfOpenAIProxy()` in beforeEach.

---

## Troubleshooting (only when a test fails)

**Ignore this section when all tests pass.** Use the table below only when a test fails; it lists what to check or fix for that test.

| # | Test | If fail → next steps |
|---|------|----------------------|
| 6 | Basic audio | Proxy may not be translating binary → `input_audio_buffer.append` + commit. Check `scripts/openai-proxy/translator.ts` `binaryToInputAudioBufferAppend`, `server.ts` binary handling and debounce/commit. Ensure audio fixture exists (`/audio-samples/hello.wav` or `sample_hello.json`). |
| 7 | Simple function calling | Proxy may not be mapping OpenAI function-call events to ConversationText. Check `scripts/openai-proxy/translator.ts` `mapFunctionCallArgumentsDoneToConversationText` and `server.ts` sending that to client. Test mode + `enable-function-calling` must be in URL params. |
| 10 | injectUserMessage connection stability | Upstream (OpenAI) may be closing after first message (Issue #380). Check proxy doesn’t close the WebSocket prematurely; check OpenAI Realtime API behavior. |
| 1 | Connection | Proxy or test-app not reachable. Confirm proxy is running (`lsof -i :8080`), test-app or Playwright webServer is up. Check `VITE_OPENAI_PROXY_ENDPOINT`; if using a pre-started test-app, set base URL (HTTP/HTTPS for **test-app** only). |
| 3 | Single message / 4 Multi-turn | Agent response not reaching UI. Check proxy forwards `ConversationText` / response events; check component renders `[data-testid="agent-response"]`. Timeout: increase `AGENT_RESPONSE_TIMEOUT` in spec or check OpenAI latency. |
| 5 | Reconnection | Disconnect/reconnect or component state issue. Check `disconnectComponent` helper and that sending again after disconnect triggers reconnect and response. |
| 9 | Error handling | Expects wrong proxy URL to show closed/error. If this fails, the app may be hanging instead of showing status; check connection-status element and error handling in component. |

**General:** Restart the proxy if needed. If Playwright starts the test-app (Option A), use `HTTPS=0` so the **test-app** is HTTP (proxy is already ws://). For flaky runs, run the failing test in isolation with `--retries=0` and inspect `test-results/` (screenshots, trace).

---

## Quick reference: tests 1–13 (same numbering everywhere)

**1–10 (OpenAI proxy suite):** 1 Connection | 2 Greeting (1b) | 3 Single message | 4 Multi-turn | 5 Reconnection | 6 Basic audio | 7 Simple function calling | 8 Reconnection with context | 9 Error handling | 10 injectUserMessage connection stability

**11–13 (Context retention):** 11 Context retain (agent uses context) | 12 Context format in Settings | 13 Context with function calling

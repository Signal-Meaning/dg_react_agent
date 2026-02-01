# E2E Tests: Priority Run List (OpenAI Proxy Change)

Run E2E tests **one at a time** in this order when validating the OpenAI proxy change (Issue #381). Tests are ordered from **most likely to fail** (new/changed behavior) to **least likely** (existing flows).

**Prerequisites:**
- OpenAI proxy running: `npm run openai-proxy` (from project root)
- Set endpoint: `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai` (or `wss://` if proxy uses HTTPS)
- Run Playwright from **project root** so `test-app` and env are correct

**Run one test at a time (from project root):**
```bash
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/<spec> --grep "<test title>"
```

---

## Tier 1: Highest risk (new proxy behavior)

These touch binary audio translation, function-call translation, or connection stability and are most likely to fail after the OpenAI change.

| # | Spec | Test (grep) | Why high priority |
|---|------|-------------|-------------------|
| 1 | `openai-proxy-e2e.spec.js` | `Basic audio` | Binary audio → `input_audio_buffer.append` + commit; re-enabled after fix |
| 2 | `openai-proxy-e2e.spec.js` | `Simple function calling` | Function-call translation to ConversationText; new mapper |
| 3 | `openai-inject-connection-stability.spec.js` | `should receive agent response after first text message` | Connection stability after injectUserMessage (Issue #380) |

**Commands (copy-paste):**
```bash
# 1. Basic audio
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Basic audio"

# 2. Simple function calling
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Simple function calling"

# 3. injectUserMessage connection stability
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-inject-connection-stability.spec.js
```

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

**Commands:**
```bash
# 4. Connection
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Connection"

# 5. Single message
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Single message"

# 6. Multi-turn
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Multi-turn"

# 7. Reconnection
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Reconnection"

# 8. Error handling
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Error handling"
```

---

## Tier 3: Run full OpenAI proxy suite

Once Tier 1 and 2 pass, run the full OpenAI proxy suite in one go:

```bash
VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js
```

---

## Other specs (Deepgram-only or backend-agnostic)

- **Deepgram-only:** See [E2E-BACKEND-MATRIX.md](../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md). These assume Deepgram (e.g. CLIENT_MESSAGE_TIMEOUT, Deepgram proxy). With only `VITE_OPENAI_PROXY_ENDPOINT` set they will fail or be skipped (e.g. `client-message-timeout.spec.js` skips when OpenAI proxy is set).
- **Backend-agnostic:** Specs that don’t depend on a specific backend can be run with either Deepgram or OpenAI proxy; run them after the OpenAI suite if you want full coverage.

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

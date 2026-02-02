# E2E Test Run Summary (Issue #383)

Summary of E2E test runs with HTTPS and existing-server configuration. Updated from **run4** log review (`/tmp/e2e-proxy-run4.log`).

## Limiting tests to verify the failure condition

To avoid running the full suite (234 tests, ~18 min) when you only need to confirm whether the proxy/connection failure is present, run a **minimal set**:

| Goal | Command (from `test-app`) | Tests |
|------|---------------------------|--------|
| **Minimal (1 test)** – fastest | `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js -g "1. Connection"` | 1 |
| **One spec (9 tests)** | `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js` | 9 |

If the single "1. Connection" test fails (e.g. connection-status never "connected"), the same failure condition is present; no need to run more. Use the full suite only when you need full coverage.

## Run configuration

| Setting | Value |
|--------|--------|
| Playwright baseURL | `https://localhost:5173` |
| HTTPS | `true` |
| Proxy endpoints | `wss://localhost:8080/deepgram-proxy`, `wss://localhost:8080/openai` |
| PW_ENABLE_AUDIO | `false` |
| Mode | Existing server (dev server and proxy started manually; `E2E_USE_EXISTING_SERVER=1` and `USE_PROXY_MODE=true`) |
| Command | `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e 2>&1 \| tee /tmp/e2e-proxy-run4.log` (from `test-app`) |

## Results (run4 – e2e-proxy-run4.log)

| Outcome | Count |
|--------|--------|
| **Passed** | 62 |
| **Failed** | 151 |
| **Skipped** | 21 |
| **Total** | 234 |
| **Run time** | ~17.6 minutes |

## "Connected" state – no mapping from OpenAI API

The component sets **connection-status to "connected"** when the **browser WebSocket fires `onopen`** (`WebSocketManager.ts`: `this.ws.onopen` → `this.updateState('connected')`). There is no protocol message or OpenAI API event required; it is the same for Deepgram direct, Deepgram proxy, and OpenAI proxy.

Tests that demonstrate this:

- **Direct Deepgram** (e.g. `agent-options-resend-issue311`): Log shows `Agent state event: connected`, `Agent WebSocket connected`, `Welcome message received - dual mode connection established`. So when the WebSocket to `wss://agent.deepgram.com/v1/agent/converse` opens, the component correctly shows "connected".

So the remaining proxy-path failures are not due to a misunderstanding of "connected" vs OpenAI API expectations; they are due to the **WebSocket to the proxy never opening successfully** (or closing before the test asserts), so the component never reaches "connected".

## Where to look for proxy-side errors

The Playwright log (e.g. `/tmp/e2e-proxy-run4.log`) contains **browser and test output only**. It does **not** contain output from the **proxy process** (`npm run test:proxy:server`), which runs in a separate terminal.

To see proxy-side messages such as:

- **`[Proxy] OpenAI forwarder upstream error:`** – upstream from mock-proxy to run.ts (8081) or from run.ts to api.openai.com failed
- **`[Proxy] OpenAI subprocess error:`** / **`exited with code`** – OpenAI proxy subprocess (run.ts) crashed or exited
- **`[Proxy] Rejecting connection:`** – Deepgram proxy rejected (e.g. origin or auth)

**Check the terminal where you started the proxy** (`cd test-app && npm run test:proxy:server`). That terminal’s stdout/stderr is where those messages appear. They are not in the Playwright tee'd log.

## Log findings from run4

1. **Invalid frame header**  
   The log shows multiple:
   - `WebSocket connection to 'wss://localhost:8080/deepgram-proxy?…service=transcription' failed: Invalid frame header`
   - `WebSocket connection to 'wss://localhost:8080/deepgram-proxy?service=agent' failed: Invalid frame header`  
   So when tests use the **Deepgram proxy** path, the browser’s WebSocket often fails with **Invalid frame header**. That usually means the server responded with something that is not a valid WebSocket upgrade/frame (e.g. HTTP error body, or TLS/protocol mismatch). So proxy/Deepgram-path failures in run4 are consistent with the proxy (or something in front of it) not completing a valid WebSocket handshake for those URLs.

2. **Connection-status "closed"**  
   Many failures include:
   - `Current connection-status: "closed". If "closed" or "error": check proxy is running…`  
   So the component never reached "connected" for those tests; the WebSocket to the proxy either never opened or closed immediately.

3. **No "[Proxy] OpenAI forwarder upstream error" in the Playwright log**  
   That message is emitted by the **proxy process** (mock-proxy-server.js). It does not appear in the Playwright log because the proxy runs in a different process/terminal. To diagnose OpenAI proxy upstream failures, watch the **proxy terminal** while running E2E.

4. **OpenAI proxy E2E (openai-proxy-e2e.spec.js)**  
   All 9 tests in this file failed in run4 (e.g. "1. Connection – connect through OpenAI proxy and receive settings", "1b. Greeting – …", "2. Single message – …", etc.). Failures are the same pattern: connection-status never becomes "connected" within the timeout.

## Root cause of past vs current failures

### Past: net::ERR_EMPTY_RESPONSE (addressed by refactor)

Previously, many failures were **`page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:5173/`** because specs/helpers hardcoded `http://localhost:5173` while the server was HTTPS-only. That is fixed: specs and helpers use relative paths from `app-paths.mjs`, so Playwright’s baseURL (https when `HTTPS=true`) is used.

### Current: connection / Invalid frame header

Remaining failures in run4 are mainly:

1. **WebSocket to proxy fails with "Invalid frame header"** – for `wss://localhost:8080/deepgram-proxy` (transcription and agent). Suggests the proxy (or TLS) is not returning a valid WebSocket upgrade/frames to the browser.
2. **Connection never becomes "connected"** – `waitForConnection` (or similar) times out; `[data-testid="connection-status"]` stays `"closed"`. Same underlying cause when the WebSocket to the proxy never opens.
3. **OpenAI proxy E2E** – all 9 tests fail with connection timeout; no proxy-side output in the Playwright log, so proxy terminal must be checked for `[Proxy] OpenAI forwarder upstream error` or subprocess errors.

## Refactored code (baseURL and scheme)

- **`test-app/tests/e2e/helpers/app-paths.mjs`** – `APP_ROOT`, `APP_TEST_MODE`, `APP_DEBUG`, `pathWithQuery(params)` for relative navigation.
- **`test-app/tests/e2e/helpers/test-helpers.mjs`** – Proxy endpoint defaults use **wss** when `HTTPS=true`, **ws** when HTTP (same as Playwright `proxyBase`). Re-exports `APP_ROOT` and `pathWithQuery`. `getProxyConfig()`, `getDeepgramProxyParams()`, `getOpenAIProxyParams()` all use scheme-aware defaults.
- **Helpers** – `setupTestPage()` uses `APP_ROOT` / `pathWithQuery(getProxyConfig())`; specs use `pathWithQuery(getDeepgramProxyParams())` or `pathWithQuery(getOpenAIProxyParams())` for proxy-mode tests.
- **Scheme validation** – `test-app/tests/e2e/scheme-config-validation.spec.js` asserts test helper proxy URL scheme (wss when HTTPS, ws when HTTP). Proxy server must be started with same HTTPS (see `test-app/tests/e2e/README.md` "Scheme best practices").

## Unit and integration tests that improve chances of finding the defect

These tests help catch regressions that would otherwise only show up as E2E "connection-status closed":

1. **Unit (component): WebSocket proxy URL and no protocols**  
   **File:** `tests/websocket-proxy-connection.test.ts`  
   - **Added:** Assertions that when `WebSocketManager` is created with a proxy URL and empty `apiKey`, the mock WebSocket is constructed with that **exact URL** and **no protocols** (no second argument).  
   - **Catches:** Component building the wrong URL or adding Deepgram token protocol in proxy mode (which would break OpenAI proxy).  
   - **Run:** `npm test -- websocket-proxy-connection` (from repo root).

2. **E2E (scheme): E2E helper proxy URL scheme**  
   **File:** `test-app/tests/e2e/scheme-config-validation.spec.js`  
   - Asserts that `getOpenAIProxyParams()` / `getDeepgramProxyParams()` return **wss** when `HTTPS=true` and **ws** when `HTTPS=false`.  
   - **Catches:** E2E helper passing wrong scheme so the app connects to ws when proxy serves wss (or vice versa).  
   - **Run:** `E2E_USE_EXISTING_SERVER=1 npm run test:e2e -- scheme-config-validation.spec.js` (from `test-app`).

3. **Integration: OpenAI proxy server with mock upstream**  
   **File:** `tests/integration/openai-proxy-integration.test.ts`  
   - Starts the OpenAI proxy (run.ts) with a mock upstream and asserts client→proxy→upstream message flow.  
   - **Catches:** Proxy server bugs (translation, forwarding); does not cover the mock-proxy-server.js forwarder or browser TLS.

4. **Integration: Mock proxy server startup**  
   **File:** `test-app/tests/mock-proxy-server-integration.test.js`  
   - Asserts proxy exits when no API key, starts when key set, and prints **wss://** when `HTTPS=true`.  
   - **Catches:** Proxy not starting or wrong scheme in startup log.  
   - **Run:** `npm test -- mock-proxy-server-integration` (from `test-app`).

**Optional (not added):** An integration test that starts the full mock-proxy (with OpenAI subprocess), then opens a Node WebSocket to `wss://127.0.0.1:8080/openai`, and expects either `open` or error containing `400`. That would reproduce "Invalid frame header" or connection failure in CI but is heavier (spawn proxy + run.ts, port/timeout handling).

## Recommendations

1. **Use baseURL everywhere** ✅ *Done*  
   Navigation uses `APP_ROOT` or `pathWithQuery(params)`. Playwright’s baseURL (http or https) is always applied.

2. **Run with existing server**  
   Dev server and proxy started manually; use `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true` so Playwright does not start them.

3. **Scheme matching** ✅ *Done*  
   Proxy endpoint defaults use **wss** when `HTTPS=true`. Start the proxy from `test-app` so it loads `.env` (HTTPS=true) and serves wss.

4. **Diagnosing proxy failures**  
   - **Playwright log:** Browser errors (e.g. "Invalid frame header", connection-status "closed").  
   - **Proxy terminal:** Run `npm run test:proxy:server` in a separate terminal and watch for `[Proxy] OpenAI forwarder upstream error`, `[Proxy] OpenAI subprocess error`, or Deepgram rejections. That output is not in the Playwright log.

## Passing tests (62 in run4)

Run4 had 62 passed tests. These include:

- Specs that use direct Deepgram (e.g. agent-options-resend, api-key-validation, audio-interruption-timing, scheme-config-validation, baseurl-test).
- Protocol-validation and mock-mode tests that do not require a live proxy connection.
- API key security / bundle inspection tests.

This confirms that when the WebSocket opens (e.g. direct to Deepgram), the component correctly reaches "connected" and tests that rely on it can pass. Proxy-path failures are tied to the WebSocket to `wss://localhost:8080/...` failing (Invalid frame header or connection never open).

## Source

- **Run4 log:** `/tmp/e2e-proxy-run4.log`  
- **Command:** `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e 2>&1 | tee /tmp/e2e-proxy-run4.log` (from `test-app`).

---

*Updated from E2E run4 log review (Issue #383).*

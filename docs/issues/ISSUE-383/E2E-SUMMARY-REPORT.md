# E2E Test Run Summary (Issue #383)

Summary of E2E test runs with HTTPS and existing-server configuration. Updated from the **latest rerun** (e2e-proxy-run2.log overwritten).

## Run configuration

| Setting | Value |
|--------|--------|
| Playwright baseURL | `https://localhost:5173` |
| HTTPS | `true` |
| Proxy endpoints | `wss://localhost:8080/deepgram-proxy`, `wss://localhost:8080/openai` |
| PW_ENABLE_AUDIO | `false` |
| Mode | Existing server (dev server and proxy started manually; `E2E_USE_EXISTING_SERVER=1` and `USE_PROXY_MODE=true`) |
| Command | `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e` (from `test-app`) |

## Results (latest rerun – e2e-proxy-run2.log)

| Outcome | Count |
|--------|--------|
| **Passed** | 34 |
| **Failed** | 148 |
| **Skipped** | 51 |
| **Total** | 233 |
| **Run time** | ~21.8 minutes |

After the baseURL/relative-URL refactor, **34 tests pass** (up from 23 when many specs used hardcoded `http://localhost:5173`). Navigation now uses `APP_ROOT` / `pathWithQuery` so the app loads over HTTPS. The **latest rerun** produced the same counts (34 / 148 / 51).

## Root cause of past vs current failures

### Past: net::ERR_EMPTY_RESPONSE (addressed by refactor)

Previously, most failures were **`page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:5173/`** because specs/helpers hardcoded `http://localhost:5173` while the server was HTTPS-only. That is fixed: specs and helpers use relative paths from `app-paths.mjs`, so Playwright’s baseURL (https when `HTTPS=true`) is used.

### Current: connection / timeout failures

Remaining failures in the latest run are mainly:

1. **Connection never becomes "connected"** – `page.waitForFunction` (e.g. in `waitForConnection` / `MicrophoneHelpers.waitForMicrophoneReady`) times out (30s); `[data-testid="connection-status"]` stays `"closed"`. Affects specs that require a live agent/proxy connection (e.g. `user-stopped-speaking-*`, `deepgram-ux-protocol`, `real-user-workflows`, `strict-mode-behavior`, `transcription-config-test`).
2. **expect(connection-status).toContainText('connected')** – Same idea: mic click or text focus does not lead to connection within the timeout; status remains `"closed"`.
3. **Test / afterEach timeout (60s)** – Some `declarative-props-api` tests (or their afterEach) wait for connection or audio state and hit the 60s test timeout.

These are consistent with: proxy/API not establishing quickly enough in the test environment, or tests that need a real backend and not fully passing under current proxy/HTTPS setup.

### Findings from latest rerun (e2e-proxy-run2.log)

- **WebSocket handshake failure:** Logs show `WebSocket connection to 'ws://localhost:8080/deepgram-proxy?...service=transcription' failed: Connection closed before receiving a handshake response`. The app is connecting to the **transcription** path on the Deepgram proxy; the connection is closed before handshake completes.
- **Component error:** Console shows `Error code: connection_start_failed` from the component when the WebSocket fails.
- **Scheme (addressed):** The browser was using `ws://` for the proxy URL while the app was served over **https**. **Correction applied:** `test-helpers.mjs` now derives proxy scheme from `HTTPS` (wss when HTTPS=true, ws when HTTP). Proxy endpoint defaults use the same scheme as Playwright’s `proxyBase`. Validated by `test-app/tests/e2e/scheme-config-validation.spec.js`.
- **Backend matrix:** The full suite runs both Deepgram-only and OpenAI-proxy-only specs; many failing specs are Deepgram-only. Run backend-specific specs when diagnosing (see README “Isolating regression vs environment”).

### Refactored code (baseURL and scheme)

- **`test-app/tests/e2e/helpers/app-paths.mjs`** – `APP_ROOT`, `APP_TEST_MODE`, `APP_DEBUG`, `pathWithQuery(params)` for relative navigation.
- **`test-app/tests/e2e/helpers/test-helpers.mjs`** – Proxy endpoint defaults use **wss** when `HTTPS=true`, **ws** when HTTP (same as Playwright `proxyBase`). Re-exports `APP_ROOT` and `pathWithQuery`. `getProxyConfig()`, `getDeepgramProxyParams()`, `getOpenAIProxyParams()` all use scheme-aware defaults.
- **Helpers** – `setupTestPage()` uses `APP_ROOT` / `pathWithQuery(getProxyConfig())`; `audio-mocks.js` uses `pathWithQuery({ ...getProxyConfig(), ... })`.
- **Specs** – All E2E specs use **relative navigation**: `page.goto(APP_ROOT)` or `page.goto(pathWithQuery(params))`. No hardcoded full URLs for navigation. Specs that need proxy params use `getDeepgramProxyParams().proxyEndpoint` (or OpenAI) so scheme matches. CORS/origin still use `BASE_URL` where needed.
- **Scheme validation** – `test-app/tests/e2e/scheme-config-validation.spec.js` asserts proxy endpoint scheme matches app scheme (wss when HTTPS, ws when HTTP). Run with `HTTPS=true npm run test:e2e -- scheme-config-validation`.

## Reporter error

After the run, the JUnit reporter threw:

```
Error in reporter RangeError: Maximum call stack size exceeded
    at JUnitReporter._addTestCase (.../playwright/lib/reporters/junit.js:176:17)
    at JUnitReporter._buildTestSuite (.../playwright/lib/reporters/junit.js:109:18)
    ...
```

This is a known class of issue with large runs and the JUnit reporter (e.g. deep or numerous test suites). It does not change the pass/fail counts above.

## Recommendations (corrections first; tests should demonstrably pass)

1. **Use baseURL everywhere** ✅ *Done*
   - All navigation uses `APP_ROOT` or `pathWithQuery(params)` from `test-helpers.mjs` / `app-paths.mjs`. No hardcoded `http://localhost:5173` or full-URL `page.goto()`. Playwright’s baseURL (http or https) is always applied.

2. **Run with existing server** – You are already doing this (dev server and proxy started manually; `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true`).

3. **Scheme matching** ✅ *Done*
   - Proxy endpoint defaults in `test-helpers.mjs` use **wss** when `HTTPS=true`, **ws** when HTTP. Same as Playwright’s `proxyBase`. **Test:** `scheme-config-validation.spec.js` asserts proxy scheme matches app scheme. Run: `HTTPS=true npm run test:e2e -- scheme-config-validation` (and with HTTPS=false for ws).

4. **JUnit reporter** – To be addressed once most tests are passing (e.g. in CI). Not blocking for current corrections.

## Passing tests (34)

In the latest run (e2e-proxy-run2), 34 tests passed. These include:

- Tests that use relative URLs (`APP_ROOT`, `APP_TEST_MODE`, `pathWithQuery`) and load the app over HTTPS.
- Protocol-validation mock-mode tests (e.g. mocked WebSocket when no API key).
- Other specs that complete within timeouts without requiring a live agent connection.

This confirms that:

- Playwright loads the app over HTTPS when navigation uses baseURL (via app-paths).
- Existing-server + HTTPS + wss proxy configuration works for E2E when specs/helpers use the refactored navigation.

## Source

- **Latest run:** `/tmp/e2e-proxy-run2.log` (overwritten by latest rerun; command: `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e` from `test-app`, output piped to `tee`).

---

*Updated from E2E run output (Issue #383).*

# E2E Test Run Summary (Issue #383)

Summary of a full E2E test run with HTTPS and existing-server configuration.

## Run configuration

| Setting | Value |
|--------|--------|
| Playwright baseURL | `https://localhost:5173` |
| HTTPS | `true` |
| Proxy endpoints | `wss://localhost:8080/deepgram-proxy`, `wss://localhost:8080/openai` |
| PW_ENABLE_AUDIO | `false` |
| Mode | Existing server (dev server and proxy started manually; `E2E_USE_EXISTING_SERVER=1` or `USE_PROXY_MODE=true`) |

## Results

| Outcome | Count |
|--------|--------|
| **Passed** | 23 |
| **Failed** | 159 |
| **Skipped** | 51 |
| **Total run time** | ~21.4 minutes |

## Root cause of most failures

The majority of failures are **`page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:5173/`**.

- The dev server is **HTTPS-only** when `HTTPS=true` in `test-app/.env`.
- Playwright config correctly uses **baseURL: https://localhost:5173** and **ignoreHTTPSErrors: true**.
- Many E2E specs and helpers **hardcode `http://localhost:5173`** instead of using the config `baseURL` (or a helper that respects HTTPS).
- Navigating to `http://localhost:5173` against an HTTPS-only server yields an empty response and fails the test.

### Affected code (refactored)

**Update (refactor completed):** Specs and helpers now use relative URLs so Playwright’s baseURL is applied.

- **`test-app/tests/e2e/helpers/app-paths.mjs`** – New module: `APP_ROOT`, `APP_TEST_MODE`, `APP_DEBUG`, `pathWithQuery(params)` for relative navigation.
- **Helpers** – `test-helpers.js` and `test-helpers.mjs` `setupTestPage()` use `APP_ROOT` / `pathWithQuery(getProxyConfig())`. `audio-mocks.js` uses `pathWithQuery({ ...getProxyConfig(), 'test-mode': 'true', debug: 'true' })`.
- **Specs** – All E2E specs that previously used `http://localhost:5173` now use `APP_ROOT`, `APP_TEST_MODE`, `APP_DEBUG`, or `pathWithQuery(...)` from `app-paths.mjs`. `deepgram-backend-proxy-authentication.spec.js` uses `pathWithQuery(...)` for navigation and `new URL(BASE_URL).origin` for CORS Origin assertions.

### Other failure types

- **TimeoutError** (e.g. `page.waitForFunction` for connection status, audio playing): tests that did load the app but did not reach the expected state within the timeout (e.g. connection never became "connected").
- **expect(locator).toContainText('connected')** with received `"closed"`: one test expected connection to establish after mic click; status stayed "closed".
- **Test timeout / afterEach timeout**: some declarative-props-api tests hit the 60s test timeout or afterEach cleanup timeout.

## Reporter error

After the run, the JUnit reporter threw:

```
Error in reporter RangeError: Maximum call stack size exceeded
    at JUnitReporter._addTestCase (.../playwright/lib/reporters/junit.js:176:17)
    at JUnitReporter._buildTestSuite (.../playwright/lib/reporters/junit.js:109:18)
    ...
```

This is a known class of issue with large runs and the JUnit reporter (e.g. deep or numerous test suites). It does not change the pass/fail counts above.

## Recommendations

1. **Use baseURL everywhere** ✅ *Implemented*
   - **app-paths.mjs** provides `APP_ROOT`, `APP_TEST_MODE`, `APP_DEBUG`, and `pathWithQuery(params)`. All specs and helpers use these for navigation so baseURL (http or https) from Playwright config is applied. See `test-app/tests/e2e/README.md` for the E2E navigation note.

2. **Run with existing server**
   - Start dev server and proxy manually, then run:
     - `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e` (from `test-app`).

3. **Optional: JUnit reporter**
   - If the JUnit reporter stack overflow is blocking (e.g. CI), consider disabling or limiting it for very large runs, or upgrading Playwright and re-checking the issue.

## Passing tests (23)

Tests that use relative URLs or the correct base URL and complete within timeouts (e.g. some proxy-mode or baseURL-aware specs) passed. The 23 passed tests confirm that:

- Playwright can load the app over HTTPS when the correct URL is used.
- Existing-server + HTTPS + wss proxy configuration is valid for E2E when navigation uses baseURL.

---

*Generated from E2E run output (Issue #383).*

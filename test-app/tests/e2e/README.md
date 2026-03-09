# E2E Tests for Deepgram Voice Agent

## Working directory: run E2E from test-app only

**All E2E commands in this document must be run from the `test-app` directory.** The Playwright config (`tests/playwright.config.mjs`), `testDir`, and env loading are defined relative to test-app. Running Playwright from the repository root (e.g. the root `npm run test:e2e`) uses a different cwd and can run the full suite with ambiguous paths; it is error-prone for targeted runs. **Standard practice: `cd test-app` first, then run any `npm run test:e2e` variant.**

## CI subset vs full suite

- **CI (essential subset only):** The Test and Publish workflow runs only the **essential** E2E specs (mock-only, no real API keys). From test-app: `npm run test:e2e:ci`. See [CI-E2E-SUBSET.md](./CI-E2E-SUBSET.md) for the list and how to change it.
- **Full suite:** From test-app, `npm run test:e2e` with no further arguments runs **all** E2E specs (e.g. 210+ tests). Use for full regression locally; many specs require real API keys or specific backends.

## Running only specific specs (not the full suite)

- **Full suite (all specs):** From test-app, `npm run test:e2e` with no further arguments runs **all** E2E specs (e.g. 210+ tests). Use for full regression.
- **Specific specs:** From test-app, pass spec file names after `--` so only those specs run. Example — only the OpenAI proxy E2E spec and the issue-373 idle-timeout spec:
  ```bash
  cd test-app
  npm run test:e2e -- openai-proxy-e2e.spec.js issue-373-idle-timeout-during-function-calls.spec.js
  ```
- **With real APIs and existing server:** Start the backend and dev server first (see below), then from test-app:
  ```bash
  E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js issue-373-idle-timeout-during-function-calls.spec.js
  ```
- **Single spec:** `npm run test:e2e -- openai-proxy-e2e.spec.js`
- **Only the 2 failing tests (6 and 6b):** `npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6. Simple function calling|6b. Issue #462"`
- **One test by name:** `npm run test:e2e -- openai-proxy-e2e.spec.js --grep "Simple function calling"`

Do **not** run `npm run test:e2e` without spec names when you only want to verify a subset (e.g. previously failing tests); that runs the entire suite.

## ⚠️ IMPORTANT: Real API Key Required

These E2E tests use **REAL Deepgram WebSocket connections**, not mocks. This provides authentic integration testing but requires a valid Deepgram API key.

**Backend matrix:** Some specs assume **Deepgram** only (e.g. CLIENT_MESSAGE_TIMEOUT, Deepgram proxy); others are **OpenAI-proxy-only** (Issue #381). See [E2E-BACKEND-MATRIX.md](./E2E-BACKEND-MATRIX.md) for which specs to run with which backend. For OpenAI proxy E2E, see [OPENAI-PROTOCOL-E2E.md](./OPENAI-PROTOCOL-E2E.md) for how tests align with the proxy protocol and the test-app.

**Run only one backend (from `test-app`):**
- **OpenAI proxy specs only:** `npm run test:e2e:openai` (requires `VITE_OPENAI_PROXY_ENDPOINT` or default). Runs the 4 OpenAI-only specs plus the callback suite (`callback-test.spec.js`); all must pass (Issue #414).
- **Deepgram-backed specs only:** `npm run test:e2e:deepgram` (use `VITE_DEEPGRAM_PROXY_ENDPOINT`; do not set `VITE_OPENAI_PROXY_ENDPOINT`). Runs all specs except the 4 OpenAI-only ones (includes the callback suite).

## Playwright and Cursor Agent

- **Runner behavior:** Playwright uses a **project-local** browser install at `test-app/.playwright-browsers`. The npm scripts set `PLAYWRIGHT_BROWSERS_PATH` to that directory (absolute) **before** starting Playwright, so both Cursor’s agent sandbox and local runs use the same install. (Playwright reads this env when its module loads, so it must be set in the script, not only in the config.)
- **Why “reinstall browsers?”:** Cursor’s agent runs in a sandbox that can only read/write the workspace and `/tmp`. It cannot write to the default Playwright cache (e.g. `~/Library/Caches/ms-playwright` on macOS). Using a project-local path fixes that.
- **One-time setup:** From **test-app** run `npm run playwright:install-browsers` (or from repo root: `npm run playwright:install-browsers`). If the agent runs in sandbox with no network, run that once locally; the next `npm run test:e2e` will use the existing binaries.
- **Scripts:** All `test:e2e*` and related Playwright scripts in `test-app/package.json` (and root `package.json` when running from root) set `PLAYWRIGHT_BROWSERS_PATH` so the path is correct regardless of cwd. The config files also set it when unset, as a fallback when running `npx playwright test ...` directly.

## Setup

### 1. Get a Deepgram API Key
- Sign up at [https://deepgram.com](https://deepgram.com)
- Get a free API key (includes free credits for testing)

### 2. Configure Environment Variables
Create or update `test-app/.env` with your real API credentials:

```bash
# Required for E2E tests
VITE_DEEPGRAM_API_KEY=your-real-deepgram-api-key-here
VITE_DEEPGRAM_PROJECT_ID=your-real-project-id-here

# Optional configuration
VITE_DEEPGRAM_MODEL=nova-2
VITE_DEEPGRAM_LANGUAGE=en-US
VITE_DEEPGRAM_VOICE=aura-asteria-en
```

### 3. Run Tests

All commands below are from the **test-app** directory.

```bash
cd test-app

# Run all E2E tests (foreground, blocks terminal)
npm run test:e2e

# Run all E2E tests and capture output to a file (recommended for long runs)
npm run test:e2e:log

# Run all E2E tests in background (monitorable, for long test runs)
npm run test:e2e:background

# Monitor test progress (in another terminal)
npm run test:e2e:monitor

# Run only specific spec(s) (recommended for debugging or verifying a subset)
npm run test:e2e -- text-only-conversation.spec.js
npm run test:e2e -- openai-proxy-e2e.spec.js issue-373-idle-timeout-during-function-calls.spec.js

# Run with UI
npm run test:e2e:ui

# Run specific test categories (full suite filtered by grep)
npm run test:e2e -- --grep "Timeout"
npm run test:e2e -- --grep "Idle Timeout"
npm run test:e2e -- --grep "Microphone"
```

### Proxy-mode E2E: idle timeout and reconnection specs

With **USE_PROXY_MODE=true** (default for full E2E), these specs validate idle timeout and reconnection behavior; they have been verified passing with both 1s idle (Playwright-started dev server) and 10s idle (existing server with default frontend):

- **deepgram-greeting-idle-timeout** — Idle timeout after greeting (Issue #139); scales with `window.__idleTimeoutMs` (1s or 10s).
- **deepgram-manual-vad-workflow** — Speak → silence → timeout (manual VAD).
- **context-retention-agent-usage** — Context retained after disconnect/reconnect; Settings format.
- **deepgram-text-session-flow** — Auto-connect and re-establish when WebSocket closes; rapid/sequential message exchange.

Optional spot-check (from `test-app`):

```bash
USE_PROXY_MODE=true npm run test:e2e -- --grep "deepgram-greeting-idle-timeout|context-retention-agent-usage|deepgram-text-session-flow|deepgram-manual-vad-workflow"
```

With an existing server (e.g. default 10s idle): `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- --grep "deepgram-greeting-idle-timeout"`. See [E2E-FAILURES-RESOLUTION.md](../../../docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md) for current status and verification commands.

### E2E navigation: use baseURL (relative URLs)

**Do not hardcode `http://localhost:5173` in specs or helpers.** The app may run over HTTPS when `HTTPS=true` in `test-app/.env`. Playwright’s `baseURL` is set in `playwright.config.mjs` (http or https). Use relative paths so navigation always matches the server:

- **Helpers:** `test-app/tests/e2e/helpers/app-paths.mjs` exports `APP_ROOT` (`/`), `APP_TEST_MODE`, `APP_DEBUG`, and `pathWithQuery(params)` for query strings. Use `page.goto(APP_ROOT)` or `page.goto(pathWithQuery({ 'test-mode': 'true' }))`.
- **Specs:** Import `APP_ROOT`, `APP_TEST_MODE`, `APP_DEBUG`, or `pathWithQuery` from `./helpers/app-paths.mjs` and use them for all `page.goto(...)` calls. For CORS/Origin assertions, use the app origin from `BASE_URL` in `test-helpers.mjs` (e.g. `new URL(BASE_URL).origin`).

### When does Playwright start the dev server and proxy?

Only **`E2E_USE_EXISTING_SERVER`** controls whether Playwright starts them:

- **`E2E_USE_EXISTING_SERVER=1`** (or `true`): Playwright does **not** start the dev server or the proxy. It runs `globalSetup`, which checks that the app is reachable (and, when `USE_PROXY_MODE` is set, that the proxy is reachable). You must start the server(s) yourself before running tests.
- **Otherwise**: Playwright starts both (`npm run dev` and `npm run backend`), waits for them to be ready, then runs tests.

**`USE_PROXY_MODE`** is separate: it only controls whether the Deepgram setup uses the proxy (and, when using existing server, whether globalSetup also checks that the proxy is reachable). It does **not** control whether Playwright starts the servers.

**`USE_REAL_APIS`**: When set to `true`, these tests expect **real** API keys (e.g. `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY` in `test-app/.env`) so the proxy can call real upstreams. Include it in commands for openai-proxy and other proxy E2E that hit real APIs (see examples below).

### Using a pre-started dev server

If you already run the test-app dev server (e.g. `npm run dev` in test-app), Playwright will try to start it again by default and fail with "Port 5173 is already in use". Use a **preconfigured server** instead:

1. **Start the dev server first** (required). If you run with `E2E_USE_EXISTING_SERVER=1` but nothing is serving the app, every test will fail with `net::ERR_EMPTY_RESPONSE` at the app URL.

   **When a test fails**, open the last run’s report or trace to inspect:
   - **HTML report** (screenshots, error context, test list): from `test-app`, run `npx playwright show-report`.
   - **Trace** (network, console, DOM, steps): traces are recorded on first failure (`trace: 'retain-on-first-failure'`). From `test-app`, run `npx playwright show-trace test-results/…/trace.zip` (path is printed in the report), or open the trace from the HTML report.
   ```bash
   cd test-app && npm run dev
   ```
   For proxy-mode tests, also start the proxy (in another terminal). The proxy must use the same scheme as the app: if `HTTPS=true` in `.env`, the proxy serves **wss** and the app will connect to `wss://localhost:8080/openai`. If the proxy is not running when you use `E2E_USE_EXISTING_SERVER=1` and `USE_PROXY_MODE=true`, globalSetup will fail with a clear "proxy not reachable" message.
   ```bash
   cd test-app && npm run backend
   ```
2. Run Playwright with `E2E_USE_EXISTING_SERVER=1` so it does not start the webServer. **Canonical command for OpenAI proxy E2E with real APIs** (run from **test-app**):
   ```bash
   E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e openai-inject-connection-stability
   ```
   These tests assert **no upstream agent errors** (recoverable or not); a test fails if the app receives any agent error during the run.

   To run all E2E (not just OpenAI proxy specs) with existing server, from **test-app**:
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e
   ```
   To run only the OpenAI proxy E2E spec from **test-app**:
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js
   ```
   When `E2E_USE_EXISTING_SERVER=1` is set, a startup check verifies the app is reachable and exits with a clear error if not.

If the app uses **HTTPS** (e.g. `HTTPS=true` in test-app/.env), set the base URL when running Playwright:
   ```bash
   E2E_USE_EXISTING_SERVER=1 VITE_BASE_URL=https://localhost:5173 npx playwright test ...
   ```

**Note:** Safari may refuse self-signed HTTPS for localhost. For manual browsing use Chrome, or trust the self-signed cert in Keychain. Playwright runs in Chromium by default, so E2E tests are unaffected.

### Port, scheme, and backend (E2E environment)

- **Function-call tests (openai-proxy-e2e 6, 6b):** Tests **"6. Simple function calling"** and **"6b. Issue #462 / #470"** use the same backend as other proxy E2E tests (same host:port for proxy and `POST /function-call`). They use `setupTestPageForBackend` with `enable-function-calling` and wait for the function-call-tracker (request received) before asserting on the time in agent-response. If the tracker never increments, the component did not receive a FunctionCallRequest (protocol/setup). If the tracker increments but the model replies with fallback text, the issue is backend/proxy/API delivery. See (from repo root) `docs/issues/ISSUE-489/TDD-PLAN-3-REMAINING-OPENAI-PROXY-FAILURES.md` § E2E test alignment. To capture backend logs: `npm run backend:log` (test-app) writes a timestamped log file. With `LOG_LEVEL=debug`, the proxy writes `function_call_output` to `test-results/e2e-function-call-output.json` for manual inspection (test 6d does not assert on it).
- **Proxy port:** Playwright and helpers default to **port 8080**. If you start the proxy on a different port (e.g. `PROXY_PORT=8081`), set `VITE_OPENAI_PROXY_ENDPOINT` and/or `VITE_DEEPGRAM_PROXY_ENDPOINT` in the same env as Playwright so the app uses that port. Otherwise connection will never become "connected".
- **Scheme:** If the app is **HTTPS** (`HTTPS=true`), the proxy must serve **wss**. If the app is HTTP, the proxy must serve **ws**. Mismatch causes connection failures (connection never becomes "connected").
- **Backend matrix:** The full suite includes both **Deepgram-only** and **OpenAI-proxy-only** specs. See [E2E-BACKEND-MATRIX.md](./E2E-BACKEND-MATRIX.md) and run backend-specific specs when diagnosing failures. With **USE_PROXY_MODE=true** (OpenAI proxy default), the full run is **210 passed, 24 skipped** (0 failures): three Deepgram-only specs skip via `skipIfOpenAIProxy`—`deepgram-interim-transcript-validation.spec.js`, `deepgram-extended-silence-idle-timeout.spec.js` (renamed from `extended-silence-idle-timeout.spec.js`), and the test **"Deepgram: should test minimal function definition for SettingsApplied issue"** in `function-calling-e2e.spec.js`.

### Scheme best practices (app, proxy, test URL must match)

1. **Single source of truth:** Use **one** value for HTTPS for the whole run. Set `HTTPS=true` (or `1`) in `test-app/.env` so that:
   - The **dev server** (Vite) serves the app over HTTPS.
   - The **proxy** (`npm run backend`) loads `.env` and serves **wss** on 8080 when started from `test-app`.
   - The **E2E helpers** (`test-helpers.mjs`) read `process.env.HTTPS` and build proxy URLs with **wss** when HTTPS is true.

2. **Start the proxy from test-app** so it loads `.env`:
   ```bash
   cd test-app && npm run backend
   ```
   If you start the proxy from elsewhere or with different env, scheme can diverge (e.g. proxy on ws, app on https → connection fails).

3. **Verify alignment before running E2E:**
   - **Proxy startup log:** Must show `wss://localhost:8080/...` when using HTTPS. If it shows `ws://`, the proxy is not using the same scheme as the app.
   - **E2E scheme test:** Run `HTTPS=true npm run test:e2e -- scheme-config-validation.spec.js` (with `E2E_USE_EXISTING_SERVER=1` if the dev server is already up). It asserts the test helper builds wss URLs when HTTPS=true.
   - **Proxy integration test:** `npm test -- mock-proxy-server-integration` includes a test that the proxy prints `wss://` when started with `HTTPS=true`.

4. **If `page.goto` fails with `net::ERR_CERT_AUTHORITY_INVALID` (app URL https://localhost:5173):**  
   The config sets `ignoreHTTPSErrors: true` and Chromium args `--ignore-certificate-errors` / `--allow-insecure-localhost`. If it still fails, **run E2E over HTTP** so there is no TLS:
   - In `test-app/.env`, set `HTTPS=` (empty) or remove the line, then **restart** the dev server and proxy so they serve `http`/`ws`.
   - Run the test; if `HTTPS=` is already unset in `.env`, the test will use `http`/`ws` automatically. To force http for this run without editing `.env`, add **`E2E_USE_HTTP=1`**:
     ```bash
     USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npx playwright test openai-proxy-e2e.spec.js -g "1. Connection" --trace on
     ```
     (Or prefix with `E2E_USE_HTTP=1` if your servers are on HTTP but `.env` still has `HTTPS=true`.)

5. **If connection never becomes "connected":**
   - **When using HTTP (HTTPS disabled):** Restart **both** the dev server and the proxy after changing `.env` so they serve `http`/`ws`. Run the test with **`E2E_USE_HTTP=1`** so the test uses `http://localhost:5173` and `ws://localhost:8080/openai`. Check the proxy terminal for errors (e.g. `[Proxy] OpenAI forwarder upstream error`).
   - Confirm the proxy was started with the same HTTPS as the app (check proxy startup log for `wss://` when app is https).
   - Confirm port: app proxy URL must match proxy port (default 8080).
   - **OpenAI proxy only:** The proxy spawns an OpenAI subprocess (run.ts on port 8081) that connects to api.openai.com. Ensure `OPENAI_API_KEY` (or `VITE_OPENAI_API_KEY`) is set in `test-app/.env` and valid; if the upstream rejects the connection (e.g. 400), the component will never reach "connected". Check the proxy terminal for upstream errors (e.g. `[Proxy] OpenAI forwarder upstream error`).
   - Browser may reject self-signed cert for `wss://localhost:8080`; Playwright’s `ignoreHTTPSErrors` applies to the page; if wss still fails, the proxy’s TLS cert may need to be accepted by the browser context.

### Diagnosing why connection never becomes "connected"

The OpenAI proxy **"1. Connection"** test is now passing: the mock proxy routes upgrade by path (`/openai` vs `/deepgram-proxy`) so `ws://localhost:8080/openai?service=agent` is no longer rejected with 400. If connection issues recur (e.g. after env or proxy changes), use the steps below.

Use these in order; each gives a LOC (this README) and the exact command(s).

1. **See the browser-side WebSocket error**  
   By the time you open DevTools manually, the test has often already run and the error is gone. Use one of these so the error is capturable:

   **1a. Trace (recommended – no timing, no code change)**  
   Run with `--trace on`. After the test fails, open the trace; the trace viewer shows Console and Network for the whole run, so you can see the WebSocket error after the fact.  
   **Command (from `test-app`):**
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npx playwright test openai-proxy-e2e.spec.js -g "1. Connection" --trace on
   ```
   When it fails, the output will show the path to the trace zip (e.g. `test-results/.../trace.zip`). Open it:
   ```bash
   npx playwright show-trace test-results/openai-proxy-e2e-OpenAI-Pr-32dce--proxy-and-receive-settings-chromium/trace.zip
   ```
   (Use the path from your run.) In the trace viewer: **Console** tab for errors; **Network** tab and filter by "WS" or the proxy URL to see the WebSocket request and response.

   **1b. Pause before the connection (so DevTools is ready)**  
   Add a temporary `await page.pause()` in the spec *before* the line that triggers the connection, so the run stops with the page loaded and the Inspector open. Then open DevTools in the browser, then resume.  
   In `openai-proxy-e2e.spec.js`, in the test "1. Connection – connect through OpenAI proxy and receive settings", add after `setupTestPageWithOpenAIProxy(page)` and *before* `establishConnectionViaText(page, 30000)`:
   ```js
   await page.pause();  // remove after debugging
   ```
   **Command (from `test-app`):**
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npx playwright test openai-proxy-e2e.spec.js -g "1. Connection"
   ```
   When it pauses: (1) Click the browser window Playwright opened. (2) Open DevTools (F12 or Cmd+Option+I). (3) Open **Console** and **Network** (filter by "WS" or "localhost:8080"). (4) In the Playwright Inspector, click **Resume**. The test will focus the text input, the app will try to connect, and the WebSocket error will appear in Console/Network. Remove `await page.pause()` when done.

   **1c. Debug mode (open DevTools before first step)**  
   Run with `--debug`. When the Inspector appears, *do not* click Step or Resume yet. First: focus the **browser** window → open DevTools (Console + Network, filter WS) → then in the Inspector, click **Step** repeatedly until the step that runs "focus" on the text input (that triggers the connection). Watch Console/Network when that step runs.  
   **Command (from `test-app`):**
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npx playwright test openai-proxy-e2e.spec.js -g "1. Connection" --debug
   ```

2. **Confirm the app is using the right proxy URL**  
   After navigation, assert the displayed proxy URL (e.g. the test-app span that shows `→ wss://localhost:8080/openai`). Add a temporary assertion in the spec or run once in headed mode and check the UI.  
   **Command (headed, from `test-app`):**
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npx playwright test openai-proxy-e2e.spec.js -g "1. Connection" --headed
   ```
   Check the on-screen proxy URL (e.g. "→ wss://localhost:8080/openai") before the connection times out.

3. **Capture proxy-side output**  
   Start the proxy with output tee'd to a file; run the single E2E test in another terminal; then inspect the proxy log for `[Proxy] OpenAI forwarder upstream error` or other messages.  
   **Commands:**  
   Terminal 1 (from `test-app`):
   ```bash
   npm run backend 2>&1 | tee /tmp/proxy.log
   ```
   Terminal 2 (from `test-app`):
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js -g "1. Connection"
   ```
   Then:
   ```bash
   grep -E '\[Proxy\]|openai|upstream|error' /tmp/proxy.log
   ```

4. **Optional: integration test that proxy accepts a Node WebSocket**  
   Add a test that starts the mock-proxy (with `OPENAI_API_KEY` and `HTTPS=true`), opens a Node WebSocket to `wss://127.0.0.1:8080/openai`, and expects either `open` or error containing `400`. If this passes but E2E fails, the issue is likely browser-specific (e.g. TLS).  
   **Location:** e.g. `test-app/tests/mock-proxy-server-integration.test.js` or a new integration spec; no one-off command (run via `npm test` or `npm run test:e2e`).

5. **Ship despite E2E: minimal run + unit/integration**  
   Use the minimal run (1 test) as the standard proxy/connection check; rely on unit (`npm test -- websocket-proxy-connection` from repo root) and integration tests; document openai-proxy-e2e as environment-dependent and optionally skip in CI.  
   **Minimal run command (from `test-app`):** see "Limiting test count" below (README ~132–141).

### Limiting test count (verify failure condition only)

From **test-app**, to avoid running the full suite when you only need to confirm the proxy/connection failure:

- **Minimal (1 test):**  
  `USE_REAL_APIS=1 E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep "1. Connection"`
- **One spec:**  
  `USE_REAL_APIS=1 E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js`

If the single "1. Connection" test fails, the same failure condition is present; run the full suite only when you need full coverage. See also `docs/issues/ISSUE-383/E2E-SUMMARY-REPORT.md` ("Limiting tests to verify the failure condition").

### Isolating regression vs environment

To tell connection/timeout failures apart from environment (port, scheme, backend):

1. **Run only OpenAI proxy E2E** (from `test-app`):
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js
   ```
   If this passes, the OpenAI connection path is likely fine; full-suite failures may be backend matrix or port/scheme.

2. **Run only one Deepgram proxy spec** (from `test-app`):
   ```bash
   USE_REAL_APIS=true E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_BACKEND=deepgram npm run test:e2e -- deepgram-backend-proxy-mode.spec.js
   ```
   If this passes, the Deepgram connection path is likely fine.

3. **Interpret:** OpenAI-only pass + Deepgram-only pass → environment (e.g. wrong backend when running full suite). Either-only fail → possible regression in that provider’s connection path.

### Running Tests in Background (Monitorable Mode)

For comprehensive test runs (all 217 tests, takes 2-3 hours), use background mode:

```bash
cd test-app

# Start tests in background with logging (recommended - more robust)
bash -c 'mkdir -p ../test-results/e2e-runs && USE_PROXY_MODE=true npm run test:e2e > ../test-results/e2e-runs/e2e-$(date +%Y%m%d-%H%M%S).log 2>&1' &

# Alternative: Simple version (if the above doesn't work in your shell)
mkdir -p ../test-results/e2e-runs
USE_PROXY_MODE=true npm run test:e2e > ../test-results/e2e-runs/e2e-$(date +%Y%m%d-%H%M%S).log 2>&1 &

# In another terminal, monitor progress
npm run test:e2e:monitor
```

**Background Mode Features:**
- ✅ Non-blocking - terminal remains available
- ✅ Logged output - all test output saved to timestamped log file
- ✅ Monitorable - real-time progress monitoring
- ✅ Automatic log file naming - `test-results/e2e-runs/e2e-YYYYMMDD-HHMMSS.log`

**Monitoring Test Progress:**
```bash
# Monitor most recent test run
npm run test:e2e:monitor

# Monitor specific log file
../scripts/monitor-e2e-tests.sh test-results/e2e-runs/e2e-20260120-064800.log
```

The monitor displays:
- Test progress (passed/failed counts)
- Recent test activity (last 15 lines)
- Test status updates
- Updates every 5 seconds

**Note:** Tests are NOT automatically set to run in background mode. Use the background operator (`&`) explicitly when you need monitorable long-running test suites (e.g., for release validation).

## Why Real API Key Instead of Mocks?

| Real API Key | Mocked API |
|--------------|------------|
| ✅ Authentic integration testing | ❌ Mock behavior may drift from real |
| ✅ Catches real connection issues | ❌ Misses integration problems |
| ✅ Tests actual WebSocket protocols | ❌ Complex mock maintenance |
| ✅ Zero mock development time | ❌ 13-19 hours of mock development |
| ✅ Always up-to-date with API changes | ❌ Mocks need constant updates |

## Test Files

### Protocol & Connection Tests
- **`deepgram-ux-protocol.spec.js`** - UX-focused protocol validation tests (3 tests)
- **`protocol-validation-modes.spec.js`** - Real API + Mock mode validation (2 tests)
- **`api-key-validation.spec.js`** - API key validation and error handling
- **`lazy-initialization-e2e.spec.js`** - Lazy initialization behavior (no auto-connect, Issue #206)

### Security & Authentication Tests
- **`deepgram-backend-proxy-authentication.spec.js`** - Backend proxy authentication and security tests (11 tests)
  - Basic authentication (Issue #242)
  - Invalid token rejection (Issue #363)
  - Token expiration handling (Issue #363)
  - CORS/security headers validation (Issue #363)
  - ⚠️ **Requires real APIs - skips in CI**
- **`api-key-security-proxy-mode.spec.js`** - API key security validation (11 tests) (Issue #369)
  - Bundle, network, DOM, console, and proxy backend security validation
  - ⚠️ **Requires real APIs - skips in CI**

### Timeout & Reconnection Tests
- **`websocket-timeout-context-preservation.spec.js`** - Context preservation across timeout with TEXT input (accelerated time)
- **`idle-timeout-behavior.spec.js`** - Idle timeout behavior in various scenarios (reconnection, active conversation)
- **`microphone-reliability.spec.js`** - Microphone state reliability with manual timeout trigger

### Microphone & Audio Tests
- **`microphone-control.spec.js`** - Microphone enable/disable and state management  
- **`microphone-functionality.spec.js`** - Microphone feature validation
- **`simple-mic-test.spec.js`** - Simple microphone state tests
- **`greeting-audio-timing.spec.js`** - Audio greeting timing and AudioContext initialization

### Conversation & Interaction Tests
- **`text-only-conversation.spec.js`** - Text-only conversation without audio
- **`real-user-workflows.spec.js`** - Real-world user interaction workflows (includes error handling)
- **`page-content.spec.js`** - Basic component rendering validation
- **`dual-channel-text-and-microphone.spec.js`** - Dual channel (text + microphone) tests (5 tests) (Issue #369)
  - Channel switching scenarios
  - Connection stability during channel switching
  - Proxy mode support for both channels

### VAD (Voice Activity Detection) Tests
- **`vad-websocket-events.spec.js`** - VAD event WebSocket validation
- **`vad-realistic-audio.spec.js`** - Realistic TTS audio simulation for VAD testing ⚠️ **CI SKIPPED**
- **`vad-advanced-simulation.spec.js`** - Advanced VAD audio simulation patterns ⚠️ **CI SKIPPED**
- **`manual-vad-workflow.spec.js`** - Manual VAD workflow testing ⚠️ **CI SKIPPED**
- **`diagnostic-vad.spec.js`** - VAD diagnostic tests

### Configuration & Setup Tests
- **`deepgram-instructions-file.spec.js`** - Custom instructions file loading

### Diagnostic & Error Tests
- **`manual-diagnostic.spec.js`** - Manual testing diagnostics
- **`js-error-test.spec.js`** - JavaScript error detection
- **`react-error-test.spec.js`** - React error boundary testing
- **`page-content.spec.js`** - Basic page content validation

### Test Utilities
- **`helpers/test-helpers.js`** - Shared test utilities (see below)
- **`helpers/audio-mocks.js`** - Audio API mocking utilities

## Writing New Tests

**📖 See [E2E_TEST_DEVELOPMENT_GUIDE.md](./E2E_TEST_DEVELOPMENT_GUIDE.md) for comprehensive guide on:**
- Available fixtures and their usage
- Best practices and common patterns
- Common pitfalls to avoid
- Migration examples
- Test structure guidelines

### Using Test Helpers

All tests should use the shared helpers in `helpers/test-helpers.js` for consistency:

```javascript
const {
  SELECTORS,                    // Centralized UI selectors
  setupTestPage,                // Navigate and wait for component load
  waitForConnection,            // Wait for protocol handshake
  waitForAgentGreeting,         // Wait for agent greeting
  sendTextMessage,              // Send text via UI
  installWebSocketCapture,      // Capture WebSocket messages
  getCapturedWebSocketData,    // Retrieve captured sent/received messages
  getLastSettingsFromCapture,  // Get last sent Settings from capture (Issue #379 diagnostics)
  assertSettingsStructureE2E,  // Assert Settings message structure (Issue #379)
  installMockWebSocket,        // Mock WebSocket for tests
  assertConnectionHealthy,     // Verify connection state
} = require('./helpers/test-helpers');

test('my new test', async ({ page }) => {
  // Setup
  await setupTestPage(page);
  await waitForConnection(page);
  
  // Action
  await sendTextMessage(page, 'Hello');
  
  // Assert
  await assertConnectionHealthy(page, expect);
});
```

### Failure diagnostics

Helpers and attachments for diagnosing E2E failures (Settings, idle timeout, etc.).

#### Issue #379 – WebSocket capture and Settings verification

- **When capture is available:** Call `installWebSocketCapture(page)` before navigating or connecting so that all WebSocket messages (sent and received) are captured. After a flow that sends Settings (e.g. connection established), use `getCapturedWebSocketData(page)` then `getLastSettingsFromCapture(wsData)` to get the last sent Settings payload for diagnostics or structure assertions.
- **When to use:** Direct mode and proxy mode both support capture when the test app uses the patched `WebSocket` (install capture before the page creates the WebSocket). In proxy mode, capture may see the client→proxy WebSocket; in direct mode, client→Deepgram. Use `assertSettingsStructureE2E(settings)` to validate `type`, `agent`, `agent.think`, optional `agent.context` shape, and optional `requireFunctions` / `requireContext`.
- **Fallback:** If capture has no Settings (e.g. connection failed or different code path), prefer window variables (e.g. `__e2e*`) where documented; see Issue #329 for proxy-mode fallbacks.

#### Issue #346 – Idle timeout failure diagnostics

When the four direct-mode idle-timeout E2E tests fail, the tests attach JSON to the Playwright report so you can inspect user/assistant text and VAD state before changing timeouts or thresholds. Use **test report attachments** (e.g. in `test-results/` or the HTML report) after a run:

- **Helpers:** `attachIdleTimeoutDiagnostics(page, testInfo, { attachmentName, eventsDetected?, sampleSent?, userMessageSent? })` captures the same snapshot, attaches it to the report, and returns it (use this in specs). `getIdleTimeoutDiagnostics(page, { userMessageSent? })` returns the snapshot only when you need to attach or log elsewhere.
- **idle-timeout-during-agent-speech.spec.js:** On timeout waiting for agent response >100 chars, attachment `idle-timeout-during-agent-speech-failure.json` includes the sent user message and current agent response state.
- **idle-timeout-behavior.spec.js** (three tests): Before asserting VAD events, attachments `idle-timeout-vad-failure-*.json` include `eventsDetected`, `sampleSent`, and the same snapshot. Inspect `vad.*` to see whether the test app rendered VAD elements in direct mode.
- **Targeted runs (direct mode):** Use `--grep` with `npm run test:e2e:direct` to run a subset of tests (e.g. the 4 failing Issue #346 tests).

### Benefits of Using Helpers

- ✅ **DRY**: No duplicated setup/assertion code
- ✅ **Consistent**: All tests follow same patterns
- ✅ **Maintainable**: Change once, affects all tests
- ✅ **Readable**: High-level actions instead of low-level Playwright calls

## Notable Test Scenarios

### Idle Timeout Behavior

**File:** `idle-timeout-behavior.spec.js`

**Purpose:** Comprehensive test suite for idle timeout behavior in realistic conversation scenarios.

**Test Cases:**

#### 1. Microphone Activation After Idle Timeout (Issue #58)
Validates that users can reactivate the microphone after connection times out.

**Scenario:**
1. Component auto-connects successfully
2. No user activity for 12 seconds (triggers 10s idle timeout)
3. User clicks microphone button to start voice input
4. Expected: Connection re-establishes and microphone enables

**Status:** ✅ PASSING (Issue #58 fixed)

#### 2. Active Conversation Continuity
Validates that connection stays alive during active conversation with natural pauses.

**Scenario:**
1. User speaks (triggers UtteranceEnd after brief pause)
2. User continues speaking after pause
3. Expected: Connection stays alive, doesn't timeout mid-conversation
4. Tests that idle timeout resets on any activity (user OR agent)

**Status:** ✅ PASSING (validates fix for premature timeout bug)

**Why These Tests are Important:**
- **Real-world scenarios**: Tests natural conversation flows with pauses
- **Different from `websocket-timeout-context-preservation.spec.js`**: That test uses TEXT input with accelerated time (15 min keepalive timeout)
- **Different from `microphone-reliability.spec.js`**: That test uses manual "Trigger Timeout" button

**Run:**
```bash
npx playwright test tests/e2e/idle-timeout-behavior.spec.js
```

### VAD Test Status

**File:** `vad-realistic-audio.spec.js`, `vad-advanced-simulation.spec.js`, `manual-vad-workflow.spec.js`

**Purpose:** Test Voice Activity Detection (VAD) events with realistic audio simulation.

**Current Status:**
- ✅ **Audio Simulation**: Working (121,600 bytes generated and transmitted)
- ✅ **Agent Service**: Connected successfully  
- ✅ **Microphone**: Enabled properly
- ❌ **Transcription Service**: Not connecting (required for VAD events)
- ❌ **VAD Events**: Not triggered (depends on transcription service)

**CI Behavior:**
- **Local Development**: Tests run but fail due to transcription service issue
- **CI Environment**: Tests are properly skipped with message: *"VAD tests require real Deepgram API connections - skipped in CI"*

**Related Issues:**
- [Issue #95](https://github.com/Signal-Meaning/dg_react_agent/issues/95): VAD Events Not Triggered by Simulated Audio in Tests
- [Issue #99](https://github.com/Signal-Meaning/dg_react_agent/issues/99): Add Mock Feature Extensions for CI Testing

**Run:**
```bash
# Run VAD tests locally (will fail due to transcription service issue)
npx playwright test tests/e2e/vad-realistic-audio.spec.js

# Verify CI skip behavior
CI=true npx playwright test tests/e2e/vad-realistic-audio.spec.js
```

## Troubleshooting

### Tests Fail with "Connection Closed"
- Check that `VITE_DEEPGRAM_API_KEY` is set in `test-app/.env`
- Verify the API key is valid and has credits
- Ensure the API key is not a placeholder value

### Tests Fail with "API Key Required"
- The test app will show a red error banner if the API key is missing
- Follow the instructions in the error banner to set up your `.env` file

### Component Not Ready / Microphone Button Disabled
- This usually means the component couldn't connect to Deepgram
- Check your API key and network connection
- Look for console errors in the browser

## Alternative Testing

If you need to run tests without a real API key:

1. **Use Jest Unit Tests**: `npm test` (uses mocks)
2. **Use Component Tests**: `npm run test:components` (isolated testing)
3. **Set up Test Account**: Get a free Deepgram account for testing

## Cost Considerations

- Deepgram offers free credits for new accounts
- E2E tests use minimal API calls (just connection + greeting)
- Estimated cost: < $1/month for regular testing
- Much cheaper than 13-19 hours of mock development time

# Phase 3: Tests and E2E (Issue #407)

## Unit / integration tests (backend execution path)

- **Backend endpoint:** `test-app/tests/function-call-endpoint-integration.test.js` — integration tests for `POST /function-call` (contract in [BACKEND-FUNCTION-CALL-CONTRACT.md](./BACKEND-FUNCTION-CALL-CONTRACT.md)). Run: `npm test -- function-call-endpoint-integration` (from test-app).
- **Frontend forwarding:** `test-app/tests/functionCallBackend.test.ts` — unit tests for `getFunctionCallBackendBaseUrl` and `forwardFunctionCallToBackend`. Run: `npm test -- functionCallBackend` (from test-app).
- **Proxy protocol:** `tests/integration/openai-proxy-integration.test.ts` — function-call–related tests (FunctionCallRequest / FunctionCallResponse, message order) still pass. They assert proxy behavior; the client that sends `FunctionCallResponse` can be the test-app frontend using either the in-browser handler or the backend path.

All of the above pass with the Phase 1.2 and 1.3 implementation.

## E2E: demo handler vs backend path

- **Demo path (in-browser handler):** E2E that call `setupFunctionCallingTest()` (e.g. in `function-calling-e2e.spec.js`, `context-retention-with-function-calling.spec.js`, `issue-351-function-call-proxy-mode.spec.js`, `issue-353-binary-json-messages.spec.js`) set `window.handleFunctionCall`. Those tests explicitly use the **demo-only** in-browser handler for function execution.
- **Backend path:** E2E that **do not** set `window.handleFunctionCall` and connect via proxy use the **app backend** for function execution (frontend forwards to `POST /function-call`). The backend must be running with the test-app server (e.g. `cd test-app && npm run backend`) so that `POST /function-call` is available.
  - **OpenAI proxy E2E test "6. Simple function calling"** (`openai-proxy-e2e.spec.js`) does **not** set `window.handleFunctionCall`. It navigates with `enable-function-calling=true`, connects via OpenAI proxy, and sends "What time is it?". The app therefore forwards the function call to the backend. This test **validates the backend execution path** when the backend (with `/function-call`) is running.

## How to run E2E with backend execution

1. Start the test-app backend (includes `/function-call`): `cd test-app && npm run backend`
2. Run OpenAI proxy E2E (e.g. test 6):  
   `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e -- openai-proxy-e2e -g "Simple function calling"`  
   Or let Playwright start the backend via `webServer` and run the full `openai-proxy-e2e` suite.

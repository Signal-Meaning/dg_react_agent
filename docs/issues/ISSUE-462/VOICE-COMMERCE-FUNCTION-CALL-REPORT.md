# voice-commerce report: Our function-call tests vs theirs

**Date:** 2026-02-16  
**Re:** Their claim that our function-call implementation is in-test only, hardcoded; theirs uses real app and backend HTTP.

---

## Their statement (paraphrased)

- **Ours:** In-test only — on `FunctionCallRequest` the client sends a **hardcoded** `FunctionCallResponse` (`{ time: '12:00', timezone: 'UTC' }`). No HTTP, no backend.
- **Theirs:** Real app → `POST /api/functions/search-products` → SERP → 500 if `SERP_API_KEY` is missing.

---

## Our assessment: **The report is correct**

### Integration test (real-API function-call qualification)

The test we use for real-API function-call qualification is in **`tests/integration/openai-proxy-integration.test.ts`**:  
**"Issue #470 real-API: function-call flow completes without conversation_already_has_active_response (USE_REAL_APIS=1)"**.

In that test:

- The client is a **raw WebSocket** in Node (no test-app, no browser).
- On `FunctionCallRequest` it immediately sends:
  ```ts
  client.send(JSON.stringify({
    type: 'FunctionCallResponse',
    id: fn.id,
    name: fn.name,
    content: JSON.stringify({ time: '12:00', timezone: 'UTC' }),
  }));
  ```
- There is **no HTTP request**, **no POST to any backend**, **no backend server** in that test. The response is **hardcoded** in the test file.

So for the **integration** test: **in-test only, hardcoded `FunctionCallResponse`, no HTTP, no backend.** Voice-commerce’s description is accurate.

### E2E test 6b (partner scenario)

The **test-app** (used by E2E 6b) does use the backend when a proxy endpoint is set: it derives `baseUrl` from the proxy URL and calls `forwardFunctionCallToBackend()`, which **POSTs** to `{baseUrl}/function-call`. So when E2E 6b runs with `npm run backend`, the test-app does perform HTTP to the backend and the backend runs `function-call-handlers.js`. So E2E 6b is **not** hardcoded in the same way.

However:

- The **release qualification** path we document (and that runs in CI with `USE_REAL_APIS=1`) for the function-call flow is the **integration** test, not E2E 6b.
- Their production flow is **real app → POST /api/functions/search-products → SERP** (and can 500). Ours is either (integration) no backend at all, or (E2E 6b) POST to our test-app’s `/function-call` with a trivial handler. We do **not** exercise a partner-style path: real app, real backend route, external API (SERP), or error paths (e.g. 500).

---

## Conclusion

- **Report is not false.** Our primary real-API function-call test sends a hardcoded `FunctionCallResponse` with no HTTP and no backend. Theirs uses the real app and a real backend HTTP call (search-products → SERP, with possible 500). The gap in coverage is real and may explain why they still see failures after our fixes.

---

## What we did (Issue #462 follow-up)

1. **Integration test now uses real backend HTTP.** The real-API function-call test (`Issue #470 real-API: function-call flow completes without conversation_already_has_active_response`) no longer sends a hardcoded FunctionCallResponse. It starts an in-process minimal HTTP server (POST /function-call); on FunctionCallRequest the test **POSTs** to that backend and sends the backend's response as FunctionCallResponse. So the path is client → proxy → real API → FunctionCallRequest → **HTTP POST to backend** → FunctionCallResponse → proxy → API. See `tests/integration/openai-proxy-integration.test.ts` and `createMinimalFunctionCallBackend()`.
2. **Process guards.** `.cursorrules` and `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md` now require that function-call flow qualification use real backend HTTP (no in-test-only hardcoded response). Release checklist and docs reference this.

## What we should still do

1. **Qualify** any fix for #462 using the updated integration test (with backend HTTP) and/or E2E 6b with real backend.
2. **Partner scenario:** Where possible, run or add coverage that mirrors the partner's flow (real app → POST to their-style endpoint → external service or 500 path).

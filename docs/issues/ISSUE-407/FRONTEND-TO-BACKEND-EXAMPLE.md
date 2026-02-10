# Example: Frontend → app backend function-call flow (Issue #407, Phase 4)

This example shows how the test-app forwards `FunctionCallRequest` to the app backend and sends `FunctionCallResponse` with the result. Proxies are not involved in function execution.

---

## 1. Component delivers request to the host

The component calls `onFunctionCallRequest(functionCall, sendResponse)` when it receives a `FunctionCallRequest` from the agent (Deepgram or via OpenAI proxy). The host receives:

- `functionCall`: `{ id, name, arguments }` (see `FunctionCallRequest` in `src/types/index.ts`)
- `sendResponse`: callback to invoke with `{ id, result? }` or `{ id, error? }` (see `FunctionCallResponse`)

---

## 2. Frontend forwards to app backend (no in-browser execution)

Instead of running function logic in the browser, the frontend POSTs the request to the app backend and then calls `sendResponse` with the backend’s result.

**Derive backend base URL** from the WebSocket proxy endpoint (same host as the proxy, HTTP(S) scheme):

```ts
// test-app/src/utils/functionCallBackend.ts
export function getFunctionCallBackendBaseUrl(proxyEndpoint: string | undefined): string {
  if (!proxyEndpoint?.trim()) return '';
  const trimmed = proxyEndpoint.trim();
  const httpScheme = trimmed.startsWith('wss://') ? 'https://' : 'http://';
  const withoutScheme = trimmed.replace(/^wss?:\/\//, '');
  const hostPort = withoutScheme.split('/')[0] ?? '';
  return hostPort ? `${httpScheme}${hostPort}` : '';
}
// e.g. ws://localhost:8080/openai → http://localhost:8080
```

**POST to `/function-call` and call `sendResponse`** with the parsed result or error:

```ts
// test-app/src/utils/functionCallBackend.ts (excerpt)
const res = await fetch(`${baseUrl}/function-call`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: request.id,
    name: request.name,
    arguments: request.arguments ?? '{}',
  }),
});
const body = await res.json();
if (body.error != null) {
  sendResponse({ id: request.id, error: String(body.error) });
  return;
}
if (body.content != null) {
  const result = JSON.parse(body.content);
  sendResponse({ id: request.id, result });
}
```

Full implementation: `test-app/src/utils/functionCallBackend.ts` (`forwardFunctionCallToBackend`).

---

## 3. Host wires the handler (when using proxy, no demo handler)

In the test-app, when there is no E2E/demo handler (`window.handleFunctionCall` or `__testFunctionCallHandler`), the default path is to use the backend:

```ts
// test-app/src/App.tsx (excerpt)
const baseUrl = getFunctionCallBackendBaseUrl(proxyEndpoint);
if (baseUrl) {
  forwardFunctionCallToBackend(request, sendResponse, baseUrl);
  return;
}
```

So when the user connects via `proxyEndpoint` (e.g. `ws://localhost:8080/openai`), function calls are executed on the app backend at `http://localhost:8080/function-call`.

---

## 4. Backend executes and returns content (or error)

The app backend implements the contract in [BACKEND-FUNCTION-CALL-CONTRACT.md](./BACKEND-FUNCTION-CALL-CONTRACT.md): one set of handlers (e.g. `get_current_time`) shared by both Deepgram and OpenAI. Example route and handler:

- **Route:** `test-app/scripts/backend-server.js` — `POST /function-call` parses body, calls `executeFunctionCall(name, args)`, responds with `{ content }` or `{ error }`.
- **Handlers:** `test-app/scripts/function-call-handlers.js` — `executeFunctionCall(name, args)` runs the named function and returns `{ content: JSON.stringify(result) }` or `{ error: string }`.

---

## End-to-end

1. Agent sends `FunctionCallRequest` (via Deepgram or OpenAI proxy).
2. Component invokes `onFunctionCallRequest(request, sendResponse)`.
3. Frontend calls `forwardFunctionCallToBackend(request, sendResponse, baseUrl)` (baseUrl from proxy endpoint).
4. Frontend POSTs `{ id, name, arguments }` to `POST /function-call`.
5. Backend runs the function, returns `{ content }` or `{ error }`.
6. Frontend calls `sendResponse({ id, result })` or `sendResponse({ id, error })`.
7. Component sends `FunctionCallResponse` to the agent.

No function logic runs in the browser; proxies only forward WebSocket messages.

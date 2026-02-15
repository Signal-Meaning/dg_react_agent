# Backend function-call contract

**Proxies are not involved with function execution.** The app backend owns execution. The frontend receives `FunctionCallRequest` from the component, calls this HTTP endpoint, then sends `FunctionCallResponse` using the returned content.

**TDD:** Implementation of this contract follows test-first: write integration tests for `POST /function-call`, then implement the endpoint and common handlers to make them pass. See this directory's [README](./README.md) and the test-app backend server for implementation.

---

## Intent and third-party scope (Epic #455)

- **This contract is intentional.** The single `POST /function-call` endpoint with request `{ id, name, arguments }` and response `{ content }` or `{ error }` is the intended API for this repo's test-app and documentation. Callers (e.g. voice-commerce) may customize their own backends and routes (e.g. per-route `/api/functions/<name>` or custom request/response shapes); we stick to this common shape.
- **Third parties maintain their own contracts.** Third parties that expose different function-call shapes are responsible for their own backend contracts and tests. We do not support or test against their endpoints. Callers that need a different shape implement an adapter or their own backend.

---

## Endpoint

- **Method:** `POST`
- **Path:** `/function-call` (or e.g. `/api/function-call`; app chooses and documents)
- **Content-Type:** `application/json`

---

## Request body

Matches the component's `FunctionCallRequest` shape (see `src/types/index.ts`):

| Field       | Type   | Required | Description |
|------------|--------|----------|-------------|
| `id`       | string | Yes      | Function call ID from the agent (used by frontend when calling `sendFunctionCallResponse(id, name, content)`). |
| `name`     | string | Yes      | Function name (e.g. `get_weather`). |
| `arguments`| string | Yes      | JSON string of function arguments (may be `"{}"`). |

Example:

```json
{
  "id": "call_abc123",
  "name": "get_weather",
  "arguments": "{\"location\":\"Boston\",\"unit\":\"celsius\"}"
}
```

---

## Response

### Success (200 OK)

- **Content-Type:** `application/json`
- **Body:** `{ "content": "<string>" }`

`content` is the exact string the frontend will pass to `sendFunctionCallResponse(id, name, content)`. It may be plain text or a JSON string (e.g. `JSON.stringify(result)`).

Example:

```json
{
  "content": "{\"temperature\":22,\"unit\":\"celsius\",\"conditions\":\"Partly cloudy\"}"
}
```

### Error (4xx / 5xx or 200 with error payload)

- **Body:** `{ "error": "<string>" }`

The frontend should send this back as the response content (e.g. `JSON.stringify({ error: errorMessage })`) so the agent receives a structured error. HTTP status can be used for logging or retries; the component protocol only sees the `content` (or error string) in `FunctionCallResponse`.

Example:

```json
{
  "error": "Unknown function: get_forecast"
}
```

---

## Flow

1. Component receives `FunctionCallRequest` from the agent (Deepgram or via OpenAI proxy).
2. Frontend calls `POST /function-call` with `{ id, name, arguments }`.
3. App backend executes the function (common handlers; not Deepgram- or OpenAI-specific).
4. Backend returns `{ "content": "..." }` or `{ "error": "..." }`.
5. Frontend calls `sendFunctionCallResponse(id, name, content)` where `content` is the returned `content` string or `JSON.stringify({ error })`.

---

## Handler contract (backend implementation)

- **Common / DRY:** One set of handlers for both Deepgram and OpenAI. The same endpoint and handler code serve the frontend regardless of which backend (Deepgram or OpenAI proxy) the WebSocket is connected to.
- Handlers are keyed by `name`; they receive parsed `arguments` (object) and return a result (then serialized to `content` by the route).

---

## Optional: minimal frontend example

```ts
// In onFunctionCallRequest(request, sendResponse):
const baseUrl = getFunctionCallBackendBaseUrl(proxyEndpoint); // e.g. http://localhost:8080
const res = await fetch(`${baseUrl}/function-call`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: request.id, name: request.name, arguments: request.arguments ?? '{}' }),
});
const body = await res.json();
if (body.error) sendResponse({ id: request.id, error: body.error });
else sendResponse({ id: request.id, result: JSON.parse(body.content) });
```

Full flow and test-app example: [FRONTEND-TO-BACKEND-EXAMPLE.md](../issues/ISSUE-407/FRONTEND-TO-BACKEND-EXAMPLE.md) (Issue #407).

# Issue #412: Trace/request ID propagation contract

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md) | [DEVELOPMENT-PLAN.md](./DEVELOPMENT-PLAN.md)

This document defines how trace/request IDs are propagated so logs from backend, proxies, and test-app can be correlated.

---

## Headers

| Header | Purpose |
|--------|---------|
| `X-Trace-Id` | Single ID for the whole request/session; prefer this for correlation. |
| `X-Request-Id` | Alternative or synonym; some systems use this. Treated as trace ID when present. |

- **Origin:** Test-app (browser) or first backend that handles the request can generate the ID (e.g. UUID or nanoid).
- **Propagation:** Client sends `X-Trace-Id` (or `X-Request-Id`) on first HTTP request or includes it in the first WebSocket message payload. Backend and proxies read it and attach to logger context for the duration of that request.

---

## Logger context

- Use the shared logger’s **child** API to bind trace/request ID to all logs for a request:
  - `const requestLogger = logger.child({ traceId: req.headers['x-trace-id'] || generateId() });`
- All log calls in that request scope use `requestLogger` so every line includes the same ID.
- In Node (backend, proxy), create the child logger at request entry and pass it through (or use AsyncLocalStorage in a later iteration).

---

## Flow

1. **Test-app:** On session start or first request, generate or receive `traceId`; set `logger.child({ traceId })` for the session; when calling backend (e.g. fetch or WebSocket), send `X-Trace-Id: <traceId>` in headers or in the first message.
2. **Backend server:** On each request, read `X-Trace-Id` (or `X-Request-Id`); create `logger.child({ traceId })` and use it for all logs for that request.
3. **OpenAI proxy (or other proxies):** When the client connects via WebSocket, the trace ID is passed in the URL query (e.g. `ws://host/openai?traceId=xxx`). The backend forwarder passes the client’s query string through to the proxy; the proxy reads `traceId` from the request URL and attaches it to every log for that connection (OTel attribute `trace_id`).

---

## Querying logs

- **Same ID everywhere:** Grep or search logs by `traceId` (or the header value) to see test-app, backend, and proxy entries for one request/session.
- **OTLP:** When logs are exported to an OTLP backend, ensure `traceId` (and optional `spanId`) are set as attributes so traces can be grouped by ID.

---

## Last updated

- Initial contract for Phase 2.

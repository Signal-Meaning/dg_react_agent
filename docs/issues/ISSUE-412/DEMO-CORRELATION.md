# Issue #412: Demo — logs pulled together via trace ID

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md) | [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md)

This document shows how logs from test-app, backend, and (when wired) proxy share the same trace/request ID so a single flow can be observed across layers.

---

## Flow

1. **Test-app (browser):** User triggers a function call → `forwardFunctionCallToBackend()` sends `POST /function-call` with header `X-Trace-Id: <id>` (or generates one per request).
2. **Backend server:** Receives the request, reads `X-Trace-Id` (or `X-Request-Id`), creates `requestLog = rootLog.child({ traceId })`, and uses it for all logs for that request (e.g. "Function call executed", "Function call rejected").
3. **Query:** Search or grep logs by that `traceId` to see both client-side and server-side entries for the same logical request.

---

## Example log lines (same trace ID)

Trace ID for this example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`.

**Backend (Node)** — `test-app/scripts/backend-server.js` with logger for POST /function-call:

```
info Function call executed { traceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'get_current_time', id: 'call_abc' }
```

If the request had been invalid:

```
warn Function call rejected: missing or invalid id, name, or arguments { traceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id: undefined, name: 'get_current_time' }
```

**Test-app (browser):** If the test-app uses the shared logger and sets the same trace ID for the session or for the request, logs would look like:

```
info Forwarding function call to backend { traceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'get_current_time' }
```

---

## How to reproduce

1. Start the backend: `cd test-app && npm run backend`.
2. Run the test-app, connect with function calling enabled, and trigger a function call (e.g. "What time is it?").
3. The test-app sends `X-Trace-Id` (or the backend generates one). Backend logs for that request include `traceId` in the attributes.
4. Grep backend logs (or stdout) for that trace ID to see all entries for that request.

**Integration test:** `test-app/tests/function-call-endpoint-integration.test.js` includes a test that sends `X-Trace-Id` and `X-Request-Id` and asserts 200; the backend uses that ID in its request-scoped logger.

---

## Optional: OTLP export

When logs are exported to an OTLP backend (e.g. Jaeger, Grafana), set `traceId` (and optional `spanId`) as log attributes so the backend can group logs by trace. The shared logger’s structured output (level, message, timestamp, attributes) is compatible with that.

---

## References

- [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md) — headers and propagation
- [PARTNER-APP-LOGGING.md](./PARTNER-APP-LOGGING.md) — how to use in a partner app

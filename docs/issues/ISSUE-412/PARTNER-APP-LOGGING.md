# Issue #412: Using the improved logging in a partner app

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md)

This document gives clear instructions for integrating the shared logger and correlating logs with your app backend.

---

## 1. Use the package logger

The component exports a shared logger so your app can use the same abstraction and correlate with backend logs.

```ts
import { getLogger } from 'deepgram-voice-interaction-react';

const logger = getLogger({
  level: 'info',           // or 'debug' for verbose
  debug: false,            // set true to force debug level
});
logger.info('App started');
logger.debug('Detail', { extra: 'data' });
```

- **Levels:** `debug`, `info`, `warn`, `error`. Only messages at or above the configured level are emitted.
- **Attributes:** Pass an optional object as the second argument; it is included in the log (and in OTLP if you export). Use it for `traceId`, `sessionId`, etc.

---

## 2. Set trace/request ID for correlation

To pull together logs from the browser, your backend, and any proxies:

1. **Generate or receive an ID** at session or request start (e.g. when the user connects or when the first request is made):
   ```ts
   const traceId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
   ```

2. **Create a session- or request-scoped logger** so every log line carries that ID:
   ```ts
   const sessionLogger = logger.child({ traceId, sessionId: mySessionId });
   sessionLogger.info('Voice session started');
   ```

3. **Send the ID to your backend** on every request (e.g. fetch or WebSocket):
   - **HTTP:** Add header: `X-Trace-Id: <traceId>` (or `X-Request-Id`).
   - **WebSocket:** Include it in the first message payload or in a handshake/query param so the server can attach it to its logger context.

4. **Use the same logger (or same API) on the backend** and create a request-scoped logger from the incoming ID:
   ```ts
   const traceId = req.headers['x-trace-id'] || req.headers['x-request-id'] || generateTraceId();
   const requestLog = rootLog.child({ traceId });
   requestLog.info('Request received', { path: req.url });
   ```

Then all logs for that request/session (browser + backend + proxy) share the same `traceId` and can be queried together.

---

## 3. Correlate with your app backend

- **Backend:** Read `X-Trace-Id` (or `X-Request-Id`) from incoming requests. Create a child logger with that ID and use it for the lifetime of the request. If the client does not send an ID, generate one and (optionally) return it in the response so the client can use it for subsequent logs.
- **Same ID everywhere:** Ensure the value you send from the browser is the one your backend uses in its logger context. Then grep or search your log aggregation by that ID to see the full flow.
- **OTLP:** If you export logs to an OTLP backend, set `traceId` (and optional `spanId`) as log attributes so traces can be grouped by ID.

---

## 4. Gating verbose logs

- **Production:** Use `level: 'info'` or `'warn'` so `debug` logs are not emitted.
- **Development / support:** Use `level: 'debug'` or `debug: true` when you need full diagnostics.
- **Component `debug` prop:** When you pass `debug={true}` to the component, the component can use the same level for its internal logs; your app can pass the same logger (or a child) so all logs stay consistent.

---

## 5. Example: test-app pattern

In this repo, the test-app backend (`test-app/scripts/backend-server.js`) uses a Node logger with the same API. For `POST /function-call` it:

1. Reads `X-Trace-Id` or `X-Request-Id` from the request (or generates one).
2. Creates `requestLog = rootLog.child({ traceId })`.
3. Uses `requestLog.info` / `requestLog.warn` / `requestLog.error` for that request.

The test-app frontend can send `X-Trace-Id` when calling the backend (e.g. in `forwardFunctionCallToBackend`). See [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md) and the backend implementation for the exact headers and flow.

---

## References

- [LOGGING-STANDARD.md](./LOGGING-STANDARD.md) — levels, env, migration
- [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md) — headers and propagation flow

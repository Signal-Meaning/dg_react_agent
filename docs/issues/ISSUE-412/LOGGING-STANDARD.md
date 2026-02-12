# Issue #412: Logging standard

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md)

Use this standard for all logging in the component, test-app, and scripts so logs are level-based, consistent, and (with trace ID) correlatable across layers.

---

## Single abstraction

- **Use the shared logger** — do not call `console.log`, `console.warn`, or `console.error` except for fatal bootstrap failures (e.g. cannot load config). See [README](./README.md) and bootstrap exception in `src/utils/logger.ts`.
- **API:** `getLogger(options?)` returns a logger with:
  - `logger.debug(message, attributes?)`
  - `logger.info(message, attributes?)`
  - `logger.warn(message, attributes?)`
  - `logger.error(message, attributes?)`
  - `logger.child(attributes)` — returns a child logger that adds the given attributes to every log line (use for trace/request ID).

---

## Log levels

| Level   | When to use |
|--------|------------------|
| **debug** | Verbose diagnostics; only when `debug` prop or `LOG_LEVEL=debug` (or equivalent) is set. |
| **info**  | Normal operations (e.g. "Function call executed", "Connection established"). |
| **warn**  | Recoverable or expected problems (e.g. unknown function name, validation failure). |
| **error** | Failures that need attention (e.g. handler threw, upstream error). |

- **Filtering:** Only messages at or above the configured level are emitted. So `LOG_LEVEL=info` suppresses `debug`; `LOG_LEVEL=error` shows only `error`.
- **Debug flag:** When `debug: true` is passed to `getLogger()` (or equivalent), the effective level is treated as `debug` so verbose logs are emitted.

---

## Environment and configuration

- **Node (backend, scripts):** Set `LOG_LEVEL=debug` (or `info`, `warn`, `error`) in the environment. The logger reads it when no explicit `level` is passed to `getLogger()`.
- **Browser (component, test-app):** Pass `level` or `debug` into `getLogger()` based on app config or the component’s `debug` prop. Verbose logs should be gated so production stays minimal.
- **Production:** Prefer `info` or `warn`; use `debug` only for troubleshooting.
- **Development:** Use `debug` when you need full diagnostics.

---

## Correlation (trace/request ID)

- Use **one ID per request or session** (e.g. `traceId` or `requestId`).
- **Propagation:** Send the ID from client to backend via header (e.g. `X-Trace-Id`, `X-Request-Id`). See [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md).
- **Server:** For each request, create a request-scoped logger:  
  `const requestLog = rootLog.child({ traceId: req.headers['x-trace-id'] || generateTraceId() });`  
  Use `requestLog` for all logs in that request so every line carries the same ID.
- **OpenAI proxy (Issue #437):** The proxy in `scripts/openai-proxy` complies with this standard: it reads **LOG_LEVEL** and filters by level, and attaches **trace_id** to every log record. Pass `?traceId=xxx` in the WebSocket URL (e.g. `ws://host/openai?traceId=xxx`) so proxy logs can be correlated with client and backend. If omitted, the proxy uses the connection id as fallback. See [scripts/openai-proxy/README.md](../../scripts/openai-proxy/README.md).
- **Querying:** Search or grep logs by that ID to see test-app, backend, and proxy entries for one flow.

---

## Migration from console.*

1. Replace `console.log(...)` with `logger.info(...)` or `logger.debug(...)` depending on verbosity.
2. Replace `console.warn(...)` with `logger.warn(...)`.
3. Replace `console.error(...)` with `logger.error(...)`.
4. Add a request/session-scoped logger where needed: `logger.child({ traceId })` and use it for the duration of the request/session.
5. Gate verbose/debug logs on the `debug` prop or `LOG_LEVEL=debug`.

---

## References

- [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md) — headers and flow
- [PARTNER-APP-LOGGING.md](./PARTNER-APP-LOGGING.md) — how to use in a partner app

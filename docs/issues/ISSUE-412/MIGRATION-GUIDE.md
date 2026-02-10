# Issue #412: Migration guide for console.* call sites

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md) | [LOGGING-STANDARD.md](./LOGGING-STANDARD.md)

Use this guide to replace existing `console.log`, `console.warn`, and `console.error` with the shared logger.

---

## 1. Get a logger

- **Component / browser:**  
  `import { getLogger } from 'deepgram-voice-interaction-react';`  
  `const logger = getLogger({ level: 'info', debug: props.debug });`

- **Node (backend, scripts):**  
  Use the same package export if the script runs in a context where the package is built, or use a compatible implementation (e.g. `test-app/scripts/logger.js`) with the same API. Set `LOG_LEVEL` in the environment.

- **Request-scoped (backend):**  
  `const requestLog = rootLog.child({ traceId: req.headers['x-trace-id'] || generateTraceId() });`  
  Use `requestLog` for the lifetime of the request.

---

## 2. Replace by log type

| Before | After |
|--------|--------|
| `console.log('message')` | `logger.info('message')` or `logger.debug('message')` |
| `console.log('msg', data)` | `logger.info('msg', { data })` or `logger.debug('msg', { data })` |
| `console.warn('message')` | `logger.warn('message')` |
| `console.warn('msg', err)` | `logger.warn('msg', { error: err?.message ?? String(err) })` |
| `console.error('message')` | `logger.error('message')` |
| `console.error('msg', err)` | `logger.error('msg', { error: err?.message ?? String(err) })` |

Choose **info** for normal operations, **debug** for verbose/diagnostic output (and gate on `debug` prop or `LOG_LEVEL=debug`).

---

## 3. Search patterns

Use these to find call sites (then replace manually or with care):

- `console\.log\(`
- `console\.warn\(`
- `console\.error\(`

**Allowlist:** Fatal bootstrap-only use of `console.error` (e.g. "Cannot load config") is acceptable; document those in a comment and in [PROGRESS](./PROGRESS.md) allowlist.

---

## 4. Add context where needed

- **Request/session ID:** Where you have access to `traceId` or `requestId`, create a child logger and use it for all logs in that scope:
  ```ts
  const requestLog = logger.child({ traceId, spanId });
  requestLog.info('Request started');
  ```

- **Structured attributes:** Prefer attributes for queryability and OTLP:
  ```ts
  logger.info('Function call executed', { name: fnName, id: callId });
  logger.warn('Validation failed', { field, value });
  ```

---

## 5. Gate verbose logs

- **Component:** Use the `debug` prop: `getLogger({ debug: props.debug })` so verbose logs only run when the app enables debug.
- **Node:** Use `LOG_LEVEL=debug` in the environment when you need verbose output; otherwise keep `info` or `warn`.

---

## 6. Do not replace (bootstrap exception)

- **Single use:** One-off `console.error` at startup when the process cannot continue (e.g. missing required env, config load failure). Add a comment: `// Bootstrap exception (Issue #412): fatal startup only.`

---

## References

- [LOGGING-STANDARD.md](./LOGGING-STANDARD.md) — levels, env, correlation
- [PARTNER-APP-LOGGING.md](./PARTNER-APP-LOGGING.md) — integration in partner apps

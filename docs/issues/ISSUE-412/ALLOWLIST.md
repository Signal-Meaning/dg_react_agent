# Issue #412: Allowlist — justified direct console.* usage

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md) | [LOGGING-STANDARD.md](./LOGGING-STANDARD.md)

Only the following direct `console.log` / `console.warn` / `console.error` usages are allowed. All other logging must go through the shared logger.

---

## 1. Logger default sink

- **src/utils/logger.ts:** `defaultSink()` uses `console.log`, `console.warn`, `console.error` to emit log entries when no custom sink is provided. This is the implementation of the abstraction, not application logging.
- **test-app/scripts/logger.js:** Same: `defaultSink` uses `console.*` for output.

**Rule:** The shared logger’s default sink is the only place that may call `console.*` for normal logs. All other code must use `getLogger()` and the logger API.

---

## 2. Fatal bootstrap / startup

Use `console.error` only when the process cannot start and no logger is available yet.

| Location | Purpose |
|----------|---------|
| **scripts/openai-proxy/run.ts** ~40 | `OPENAI_API_KEY is required` before server starts; then `process.exit(1)`. |
| **test-app/scripts/backend-server.js** ~108–110, 141–143 | DEEPGRAM_API_KEY not found; at least one key required. Fatal before rootLog could be used (rootLog is created after config). |

**Rule:** If the process exits immediately after the message (e.g. `process.exit(1)`), `console.error` is acceptable. Add a comment: `// Bootstrap exception (Issue #412): fatal startup only.`

---

## 3. Startup / listen messages (optional allowlist)

| Location | Purpose |
|----------|---------|
| **scripts/openai-proxy/run.ts** ~73–74 | “OpenAI proxy listening on …” and E2E hint. Could be migrated to logger once logger is initialized. |
| **test-app/scripts/backend-server.js** ~340, 819–833 | “Backend server starting…”, “Backend server running…”, usage hints. Could use rootLog.info after rootLog exists. |

**Rule:** Prefer migrating these to `rootLog.info()` so all output is consistent. If left as `console.log` temporarily, document here and treat as technical debt.

---

## 4. CLI usage / help

| Location | Purpose |
|----------|---------|
| **scripts/openai-proxy/cli.ts** ~69 | Prints usage/help to stdout. CLI tools often use console for direct user output. |

**Rule:** CLI help text to stdout can remain `console.log`; document here.

---

## 5. No other exceptions

- **Component, hooks, utils, services:** No direct `console.*`; use the shared logger, gated by `debug` prop or level.
- **Backend request/connection handling:** Use rootLog or request-scoped logger (e.g. `rootLog.child({ traceId })`).
- **OpenAI proxy (server.ts):** Use `emitLog` with `connectionAttrs` (already includes trace_id when present). Replace any remaining `console.log` with `emitLog` or keep only if covered by OPENAI_PROXY_DEBUG and documented.

---

## Updating this allowlist

When adding a new justified use of `console.*`:

1. Add the file and line (or section) and a one-line purpose.
2. Ensure it fits one of the categories above (logger sink, fatal bootstrap, startup, CLI).
3. If in doubt, prefer migrating to the logger and not adding to the allowlist.

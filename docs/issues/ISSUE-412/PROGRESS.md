# Issue #412: Progress tracker

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md) | [DEVELOPMENT-PLAN.md](./DEVELOPMENT-PLAN.md)

Use this file to track work to conclusion. Update checkboxes and status as you go.

---

## Phase 1: Logger abstraction and OTel integration

| # | Task | Status |
|---|------|--------|
| 1.1 | Define logger API (debug, info, warn, error; level + debug gating) | [x] |
| 1.2 | Write unit tests for logger (level filtering, debug flag, attributes) | [x] |
| 1.3 | Implement `src/utils/logger.ts` (shared module) | [x] |
| 1.4 | Logger supports key-value attributes (traceId, spanId, sessionId) | [x] |
| 1.5 | Document bootstrap exception (minimal justified console.error only) | [x] |

**Phase 1 done when:** Shared logger exists, tests pass, level/env gating works, attributes supported.

---

## Phase 2: Trace/span context and ID threading

| # | Task | Status |
|---|------|--------|
| 2.1 | Add logger context API (e.g. `child(attrs)` or `withContext(attrs)`) | [x] |
| 2.2 | Define propagation contract (e.g. X-Trace-Id, X-Request-Id headers) | [x] |
| 2.3 | Backend/server: read IDs from headers, set logger context per request | [x] |
| 2.4 | Proxy (openai-proxy): attach caller trace/request ID to logger context | [x] |
| 2.5 | Test-app: generate or receive trace/request ID, send to backend | [x] |
| 2.6 | Integration test: same trace ID in backend + proxy logs for one request | [x] |

**Phase 2 done when:** One end-to-end path shows same ID in backend, proxy, and test-app logs. ✅ Done: test-app sends traceId on WS URL; backend forwarder passes query to proxy; proxy reads traceId from req.url and adds ATTR_TRACE_ID to all emitLog attributes.

---

## Phase 3: Adoption — component, test-app, scripts

| # | Task | Status |
|---|------|--------|
| 3.1 | Audit and list all console.* call sites (component, utils, services) | [x] |
| 3.2 | Component: replace console.* with logger; gate verbose on debug prop | [ ] |
| 3.3 | Test-app: use shared logger; set trace/request ID context for session | [ ] (sends X-Trace-Id to backend; full logger adoption pending) |
| 3.4 | backend-server: replace console.* with logger; attach request context | [x] (POST /function-call path; rest in follow-up) |
| 3.5 | openai-proxy: replace console.* with logger; attach caller ID context | [x] (server.ts uses emitLog; run.ts/cli.ts on allowlist) |
| 3.6 | Allowlist/bootstrap: document and keep minimal justified console.* | [x] |

**Phase 3 done when:** Single abstraction in use; minimal direct console.* outside allowlist.

---

## Phase 4: Documentation and demo

| # | Task | Status |
|---|------|--------|
| 4.1 | Logging standard doc (levels, when to use, dev vs prod) | [x] |
| 4.2 | Migration guide for existing console.* call sites | [x] |
| 4.3 | Correlation doc: how trace/request ID is propagated and queried | [x] (PROPAGATION-CONTRACT.md) |
| 4.4 | Partner-app developer instructions (use logger, set ID, correlate) | [x] |
| 4.5 | Demo or doc: same trace ID in test-app, backend, proxy logs | [x] |

**Phase 4 done when:** Docs and partner-app instructions published; correlation demonstrated or documented.

---

## Acceptance criteria (from README)

| Criterion | Status |
|-----------|--------|
| OpenTelemetry (or agreed logger) integrated; single abstraction | [x] |
| Direct console.log/warn/error rare and justified | [ ] (in progress; backend function-call path done) |
| Log levels and debug prop/env drive what is emitted | [x] |
| Docs describe standard and migration for console.* | [x] |
| Demo/doc: logs from backend, proxies, test-app pulled together via ID | [x] |
| Developer docs: clear instructions for partner app logging | [x] |

---

## Last updated

- 3.5 done: openai-proxy server.ts — all console.log replaced with emitLog (connectionAttrs + trace_id). run.ts/cli.ts remain on allowlist. Next: 3.2 (component), 3.3 (test-app).

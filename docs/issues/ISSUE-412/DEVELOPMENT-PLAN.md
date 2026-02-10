# Issue #412: Development plan — OpenTelemetry logging standard

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md)

---

## Overview

This plan delivers a single logging abstraction (OTel-compatible), reduces direct `console.*` usage, and enables log correlation across backend, proxies, and test-app via common trace/span ID threading.

---

## Phase 1: Logger abstraction and OTel integration

**Goal:** One logging API used everywhere; logs are level-based and exportable (e.g. OTLP).

1. **Choose or define the abstraction**
   - Option A: Use `@opentelemetry/api` + `@opentelemetry/sdk-logs` (or community logger that emits OTLP).
   - Option B: Thin wrapper that supports both console output and OTLP export, with a single API: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`.
   - Decision: Prefer a small shared module so component (browser), test-app (browser), and Node scripts (openai-proxy, backend-server) can all use it without heavy SDK divergence.

2. **Implement the shared logger**
   - **TDD:** Write unit tests for the logger: level filtering (e.g. `LOG_LEVEL=info` suppresses debug), `debug` flag / env gating, and structured output shape (e.g. level, message, timestamp, optional attributes).
   - Implement logger in a neutral location: e.g. `src/utils/logger.ts` (or a dedicated `packages/logger` if we want scripts to depend on it without pulling the full component). For scripts, either share the same module or a small Node-specific entry that uses the same contract.
   - Ensure logs can carry key-value attributes for later correlation (e.g. `traceId`, `spanId`, `sessionId`).

3. **Bootstrap / startup**
   - Keep minimal, justified `console.error` only for fatal bootstrap failures (e.g. cannot load config). Document these as the only allowed direct `console.*` call sites.

**Deliverables:** Shared logger API; unit tests; level and env-driven behavior; no OTLP export required in Phase 1 (can be Phase 2 or 3).

---

## Phase 2: Trace/span context and ID threading

**Goal:** Logs from backend, proxies, and test-app can be correlated with a common request/session identity.

1. **Define correlation identifiers**
   - **Trace ID:** One per logical request or session (e.g. one voice session, or one HTTP request that triggers function-call + proxy).
   - **Span ID:** Optional per operation (e.g. “handle function call”, “proxy request to Deepgram”). Enables parent-child relationship in backends that support it.
   - **Session/request ID:** If not using full OTel trace, a single `requestId` or `sessionId` propagated across layers is sufficient for “pull logs together”.

2. **Propagation**
   - **Test-app (browser) → backend:** On first request (e.g. WebSocket connect or first HTTP call), generate or receive a trace/request ID; send it in headers (e.g. `X-Trace-Id`, `X-Request-Id`) or in first message payload.
   - **Backend server:** Read `X-Trace-Id` / `X-Request-Id` from incoming requests; set logger context (or OTel context) so all logs for that request carry the ID.
   - **OpenAI proxy (and other proxies):** When invoked by the backend (or by test-app), receive trace/request ID from caller; attach to logger context for all log lines emitted while handling that call.
   - **Backend → test-app:** If backend generates the ID, include it in response headers or first WebSocket message so the test-app can attach the same ID to its client-side logs.

3. **Logger context**
   - Logger API must support “context” (e.g. `logger.withContext({ traceId, spanId })().info(...)` or `logger.child({ traceId })`) so every log line in that scope automatically includes the IDs.
   - In Node scripts: use AsyncLocalStorage (or similar) to carry trace/span context per request so no need to pass context into every function.

**Deliverables:** Propagation contract (headers or payload fields); logger context support; one end-to-end path where a single ID appears in backend logs, proxy logs, and test-app logs for the same flow.

---

## Phase 3: Adoption — component, test-app, scripts

**Goal:** Replace or wrap `console.*` with the logger; keep `debug` prop gating.

1. **Component** (`DeepgramVoiceInteraction`, utils, services)
   - Audit and list all `console.log` / `console.warn` / `console.error` call sites.
   - Replace with `logger.debug` / `logger.info` / `logger.warn` / `logger.error`; gate verbose logs on `debug` prop (and optionally env).
   - Where the component is used in test-app, ensure trace/request ID from test-app can be passed in (e.g. via a logger context set by the app before rendering the component).

2. **Test-app**
   - Use the same logger; set context with trace/request ID when starting a session or when forwarding to backend.
   - Remove or reduce duplicate/noisy logs (build on Issue #410); ensure addLog-style UI updates are not the only observability — logs still go to the logger for OTLP/aggregation.

3. **Scripts (openai-proxy, backend-server)**
   - Replace direct `console.*` with the shared logger (or Node-specific entry that shares the same contract).
   - In backend-server: attach request context (trace/request ID from headers) to the logger for each request.
   - In openai-proxy: when handling a request, attach caller-provided trace/request ID to logger context.

**Deliverables:** No (or minimal) direct `console.*` outside bootstrap; single abstraction in use; `debug` prop and env drive verbosity.

---

## Phase 4: Documentation and demo

**Goal:** Document the standard and demonstrate cross-layer correlation.

1. **Docs**
   - **Logging standard:** Where to log (single abstraction), levels (debug, info, warn, error), when to use each; how to enable debug/trace in dev vs production.
   - **Migration:** How to replace existing `console.*` call sites (search pattern, replace with logger, add context where needed).
   - **Correlation:** How trace/request ID is propagated (headers, payload), and how to use it to pull together backend, proxy, and test-app logs (e.g. grep by ID, or OTLP backend query by trace ID).

2. **Partner-app developer instructions**
   - Add to developer documentation **clear instructions for using the improved logging in a partner app:** how to integrate the logger, set or propagate trace/request ID, and correlate component logs with the partner’s app/backend logs (e.g. same ID in headers, logger context, or OTLP).

3. **Demo / evidence**
   - **Demonstrate or document** (per acceptance criteria): Run a single flow (e.g. connect, send message, function call) and show that the same trace/request ID appears in:
     - Test-app (browser) logs
     - Backend-server logs (e.g. POST /function-call, WebSocket)
     - OpenAI-proxy logs (if used)
   - Optional: Export logs to an OTLP backend (e.g. Jaeger, Grafana) and show one trace spanning frontend and backend; if out of scope, a markdown example with sample log lines and the same ID is sufficient.

**Deliverables:** Logging standard doc; migration guide; **partner-app developer instructions** (how to use the logger and correlate with app backend); correlation doc or demo with sample IDs and log lines (or OTLP screenshot).

---

## Phase summary

| Phase | Focus | Key deliverable |
|-------|--------|------------------|
| 1 | Logger abstraction + OTel-ready API | Single logger; level/env gating; unit tests |
| 2 | ID threading | Trace/request ID propagation; logger context; correlation contract |
| 3 | Adoption | Component, test-app, scripts use logger; minimal console.* |
| 4 | Docs + demo | Standard, migration, partner-app instructions, and “logs pulled together” demo or doc |

---

## TDD and testing

- **Phase 1:** Unit tests for logger (levels, gating, attributes).
- **Phase 2:** Integration test: backend and proxy emit logs with the same trace ID when request includes `X-Trace-Id` (or equivalent).
- **Phase 3:** Existing tests still pass; optional lint or audit script to flag new `console.log`/`warn`/`error` outside allowlist.
- **Phase 4:** No new automated tests required; doc and manual demo satisfy “demonstrate or document.”

---

## Dependencies and order

- Phase 2 depends on Phase 1 (logger must support context/attributes).
- Phase 3 depends on Phase 1 and ideally Phase 2 (so adoption immediately uses ID threading).
- Phase 4 can be done in parallel with Phase 3 (docs can be drafted once the contract is decided in Phase 2).

---

## Progress tracking

- **[PROGRESS.md](./PROGRESS.md)** — phase checklists and acceptance criteria; update as you go.

## References

- [README.md](./README.md) — acceptance criteria and scope
- Issue #410 — reduced duplicate/noisy logs in test-app
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/) — logging and OTLP

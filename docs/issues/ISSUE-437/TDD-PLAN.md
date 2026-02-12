# Issue #437: TDD plan — Proxy logging and OpenTelemetry standard

**Parent:** [GitHub Issue #437](https://github.com/Signal-Meaning/dg_react_agent/issues/437) | [README.md](./README.md)

---

## Overview

This document is the **Test-Driven Development** plan for correcting the OpenAI proxy logging defects. All work follows the project rule: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goals:**

1. Proxy reads **LOG_LEVEL** and filters logs by level; no reliance on OPENAI_PROXY_DEBUG for level behavior (optional: treat OPENAI_PROXY_DEBUG as alias for LOG_LEVEL=debug).
2. **Tests** validate that each executable (backend, proxy, component) treats logging per the standard; these tests are required and maintained.
3. Proxy meets our **OpenTelemetry (pico)** standards: single abstraction, level filtering, structured output.
4. Proxy supports **tracing and correlation**: accepts and propagates trace/request IDs and includes them in all log records.

---

## Phase 1: Proxy respects LOG_LEVEL (level-based filtering) ✅ DONE

**Goal:** Proxy reads `LOG_LEVEL` from the environment and only emits logs at or above that level. Replace the all-or-nothing `debug` gate with level-aware filtering.

### 1.1 RED — Tests: proxy log output depends on LOG_LEVEL ✅

**Location:** `tests/logging-standard-proxy.test.ts`.

1. **Write failing tests** that:
   - Start the proxy (or the proxy’s logger module) with `LOG_LEVEL=error` in the environment. Trigger an event that would currently log at INFO (e.g. session.created received). **Assert:** No such log line appears in captured stdout/log output.
   - With `LOG_LEVEL=info`, trigger the same event. **Assert:** The INFO-level log (e.g. session.created received) appears.
   - With `LOG_LEVEL=debug`, trigger an event that logs at DEBUG. **Assert:** The DEBUG-level log appears.
   - With `LOG_LEVEL=warn`, trigger an INFO-level event. **Assert:** INFO is suppressed; only WARN/ERROR appear when triggered.
2. Run tests → **RED** (current behavior: no LOG_LEVEL; only OPENAI_PROXY_DEBUG enables all logs).

### 1.2 GREEN — Implement LOG_LEVEL in proxy ✅

1. In `run.ts`: Read `process.env.LOG_LEVEL` (and optionally treat `OPENAI_PROXY_DEBUG=1` as “effective LOG_LEVEL=debug” for backward compatibility). Pass the resolved level into `createOpenAIProxyServer({ ..., logLevel })`.
2. In `server.ts`: Accept `logLevel` (or equivalent). Replace the single `debug` boolean with level-aware filtering in the logger; call `initProxyLogger({ logLevel })` and always call `emitLog` (filtering in logger).
3. In `logger.ts`: Initialize the OTel logger when a level is set. In `emitLog`, compare `SeverityNumber` to the configured level and skip emission if below threshold. Map LOG_LEVEL string to numeric severity (debug=5, info=9, warn=13, error=17). Export `getLoggerForTesting()` for tests.
4. Run tests → **GREEN**.

### 1.3 REFACTOR ✅

- Level parsing is in `logger.ts` (`severityNumberFromLevel`). run.ts only passes `logLevel`; no duplicate parsing.
- `scripts/openai-proxy/README.md` updated to document LOG_LEVEL and OPENAI_PROXY_DEBUG alias.

**Deliverables:** Proxy respects LOG_LEVEL; session.created and all other proxy logs are gated by level; tests in `tests/logging-standard-proxy.test.ts` pass.

---

## Phase 2: Tests that enforce logging standard per executable

**Goal:** Require and maintain tests that validate each executable (backend, proxy, component) treats logging per the standard (respects LOG_LEVEL / level filtering).

### 2.1 RED — Tests for each executable

**Location:** e.g. `tests/logging-standard-executables.test.ts` or split: `tests/logging-standard-backend.test.ts`, `tests/logging-standard-proxy.test.ts`, `tests/logging-standard-component.test.ts`.

1. **Backend:** With LOG_LEVEL=error, start or load the backend (e.g. require the backend entry or spawn it); trigger a code path that would log at INFO. Assert no INFO line in captured output. With LOG_LEVEL=info, assert INFO appears. (If backend already uses a shared logger that reads LOG_LEVEL, this may already pass; test enforces it.)
2. **Proxy:** Covered by Phase 1; add a single “executable” test that runs the proxy process with LOG_LEVEL set and asserts level filtering (can reuse Phase 1 tests or wrap them in an “executable contract” describe block).
3. **Component:** In a unit test, render the component with a logger that captures calls; set level to `warn`. Trigger an action that would log at info. Assert no info call (or that the logger filters). Set level to info and assert info is called. (Component uses `src/utils/logger.ts`; test that when level is info, debug is not emitted; when level is debug, debug is emitted.)
2. Run tests → **RED** for any executable that does not yet respect the standard.

### 2.2 GREEN — Fix any failing executable

1. For any executable that fails the test, implement LOG_LEVEL (or level) support so that only messages at or above the configured level are emitted.
2. Run tests → **GREEN**.

### 2.3 REFACTOR

- Document in LOGGING-STANDARD.md or in a “Testing the standard” section that these tests are required and must be maintained for each executable.
- Add a short comment in each test file that these tests enforce the logging standard (Issue #437 / #412).

**Deliverables:** Tests exist and pass for backend, proxy, and component; standard is enforced by CI.

---

## Phase 3: Tracing and correlation in the proxy

**Goal:** Proxy accepts trace/request ID (e.g. from WebSocket URL query `traceId=xxx`), creates a request-scoped logger (child with that ID), and includes the ID in all proxy log records so logs can be correlated with client and backend.

### 3.1 RED — Tests: proxy includes traceId in log records

**Location:** e.g. `scripts/openai-proxy/__tests__/tracing.test.ts` or `tests/logging-standard-proxy.test.ts`.

1. **Write failing tests** that:
   - Connect to the proxy with a URL that includes `traceId=test-trace-123` (or equivalent). Trigger an event that causes the proxy to log (e.g. session.created or client connected).
   - **Assert:** The emitted log record (or captured stdout/OTel export) includes an attribute `trace_id` (or `traceId`) with value `test-trace-123`.
   - Without `traceId` in the URL, trigger the same event. **Assert:** The proxy still logs and generates or uses a fallback trace ID so every record has some trace ID.
2. Run tests → **RED** (current proxy does not read traceId from URL or attach to logs).

### 3.2 GREEN — Implement tracing in the proxy

1. In `server.ts`, on connection: parse the request URL query for `traceId` (or `X-Trace-Id` if passed in a header the WebSocket upgrade receives). Generate a new trace ID if missing. Create a connection-scoped logger (e.g. `logger.child({ traceId })` or pass traceId into emitLog so every `emitLog` call for that connection includes the attribute).
2. In `logger.ts` (or wherever emitLog is implemented): Accept optional attributes (e.g. traceId); merge them into every LogRecord so OTLP and stdout show the same ID for the connection.
3. Run tests → **GREEN**.

### 3.3 REFACTOR

- Align attribute names with PROPAGATION-CONTRACT.md (e.g. `trace_id` for OTel, or `traceId` for consistency with our docs). Document in README that the client can pass `?traceId=xxx` for correlation.
- Update PROPAGATION-CONTRACT.md or OPENAI-PROXY docs to state that the proxy reads `traceId` from the WebSocket URL query and attaches it to all log records.

**Deliverables:** Proxy accepts and propagates trace/request ID; all proxy logs for a connection carry the same ID; tests pass.

---

## Phase 4: Documentation and acceptance

1. Update **scripts/openai-proxy/README.md**: Document LOG_LEVEL, optional OPENAI_PROXY_DEBUG alias, and traceId query param for correlation.
2. Update **docs/issues/ISSUE-412/LOGGING-STANDARD.md** (or PARTNER-APP-LOGGING): Note that the proxy is now compliant and how to correlate (traceId in URL).
3. Mark acceptance criteria in GitHub Issue #437 as complete when all phases are done.

---

## Order and dependencies

- **Phase 1** must be done first (proxy LOG_LEVEL); Phase 2 tests for the proxy depend on it.
- **Phase 2** can be done in parallel with Phase 1 for backend and component; proxy executable test can follow Phase 1.
- **Phase 3** can start after Phase 1 (or in parallel if different files); tracing does not block level filtering.
- **Phase 4** after all implementation and tests pass.

---

## References

- [LOGGING-STANDARD.md](../ISSUE-412/LOGGING-STANDARD.md)
- [PROPAGATION-CONTRACT.md](../ISSUE-412/PROPAGATION-CONTRACT.md)
- [Issue #412](https://github.com/Signal-Meaning/dg_react_agent/issues/412)
- `scripts/openai-proxy/run.ts`, `server.ts`, `logger.ts`

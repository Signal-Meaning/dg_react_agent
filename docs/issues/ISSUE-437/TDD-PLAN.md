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

### 2.1 RED — Tests for each executable ✅ (proxy + component)

**Location:** `tests/logging-standard-proxy.test.ts` (Phase 1), `tests/logging-standard-component.test.ts`.

1. **Backend:** Deferred — backend currently reports LOG_LEVEL at startup only; no level-filtered logs elsewhere. Add test when backend adopts level-aware logger for its routes.
2. **Proxy:** Covered by Phase 1 (`tests/logging-standard-proxy.test.ts`).
3. **Component:** `tests/logging-standard-component.test.ts` — getLogger({ level }) with custom sink; assert info suppressed when level is warn, debug suppressed when level is info, etc. **GREEN** (component logger already filters).

### 2.2 GREEN — Fix any failing executable

1. For any executable that fails the test, implement LOG_LEVEL (or level) support so that only messages at or above the configured level are emitted.
2. Run tests → **GREEN**.

### 2.3 REFACTOR

- Document in LOGGING-STANDARD.md or in a “Testing the standard” section that these tests are required and must be maintained for each executable.
- Add a short comment in each test file that these tests enforce the logging standard (Issue #437 / #412).

**Deliverables:** Tests exist and pass for backend, proxy, and component; standard is enforced by CI.

---

## Phase 3: Tracing and correlation in the proxy ✅ DONE

**Goal:** Proxy accepts trace/request ID (e.g. from WebSocket URL query `traceId=xxx`), and includes the ID in all proxy log records so logs can be correlated with client and backend.

### 3.1 RED — Tests: proxy includes traceId in log records ✅

**Location:** `tests/logging-standard-proxy.test.ts` (describe 'tracing (Phase 3)').

1. **Tests added:** (1) When emitLog is called with attributes containing `trace_id`, the OTel record includes `trace_id`. (2) Emitted record has `attributes.trace_id` for correlation.
2. Run tests → **GREEN** (server already passed connectionAttrs with traceId to emitLog; logger merges attributes into OTel record).

### 3.2 GREEN — Implement tracing in the proxy ✅

1. **server.ts:** Already parsed `traceId` from URL query and set `connectionAttrs[ATTR_TRACE_ID]`. Added fallback: when client does not send `?traceId=`, use `connId` so every connection has a `trace_id` in every log record.
2. **logger.ts:** No change; emitLog already merges `params.attributes` (including `trace_id`) into the OTel LogRecord.
3. Run tests → **GREEN**.

### 3.3 REFACTOR ✅

- Attribute name is `trace_id` (OTel-style); README documents `?traceId=xxx` for correlation and fallback to connection id.
- PROPAGATION-CONTRACT.md already stated proxy reads `traceId` from WebSocket URL query.

**Deliverables:** Proxy accepts and propagates trace/request ID; all proxy logs for a connection carry the same ID; tests pass.

---

## Phase 4: Documentation and acceptance ✅

1. **scripts/openai-proxy/README.md**: LOG_LEVEL, OPENAI_PROXY_DEBUG alias, and traceId query param documented (Phases 1 and 3).
2. **docs/issues/ISSUE-412/LOGGING-STANDARD.md**: Added "OpenAI proxy (Issue #437)" bullet under Correlation — proxy compliant, LOG_LEVEL, trace_id, ?traceId= in URL, fallback.
3. **docs/issues/ISSUE-412/PARTNER-APP-LOGGING.md**: WebSocket (OpenAI proxy) bullet — pass traceId in URL query.
4. Mark acceptance criteria in GitHub Issue #437 when ready (or close issue).

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

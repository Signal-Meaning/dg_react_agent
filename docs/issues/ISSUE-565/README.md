# Issue #565 — OpenAI proxy OTel console logs: trace fields and service name

**Status:** **In progress (first slice landed on `issue-565`)** — `LoggerProvider` now uses an explicit resource and trace context; compact console output avoids noisy `undefined` trace keys.

**GitHub:** [#565 — OpenAI proxy OTel console logs: undefined traceId/spanId/traceFlags and unknown_service name](https://github.com/Signal-Meaning/dg_react_agent/issues/565)

**Labels:** bug, priority: low, logging

**Branch:** `issue-565` (linked via `gh issue develop`).

---

## What this issue was

Log records from the proxy used the SDK default resource (`unknown_service:…`) and `ConsoleLogRecordExporter` always printed **`traceId` / `spanId` / `traceFlags`** even when unset (**`undefined`**). The proxy already set **`attributes.trace_id`** for correlation (#437) but did not attach OTel log trace context.

---

## What we implemented (slice 1)

**Code:** [`packages/voice-agent-backend/scripts/openai-proxy/logger.ts`](../../../packages/voice-agent-backend/scripts/openai-proxy/logger.ts)

| Item | Behavior |
|------|-----------|
| **`service.name` / `service.version`** | `Resource.default().merge(new Resource({ 'service.name': 'dg-openai-proxy', 'service.version': '1.0.0' }))` so the merged resource overrides `unknown_service` (SDK merge: configured resource wins on collision). Public constant **`PROXY_OTEL_SERVICE_NAME`**. |
| **Trace context** | When **`trace_id`** is a non-empty string attribute, `emitLog` builds a valid W3C `SpanContext`: 32-hex trace id = UUID without dashes if valid, else SHA-256(correlation) first 32 hex; span id = SHA-256(`openai-proxy\|${correlation}`) first 16 hex; `TraceFlags.NONE`. Passed via `logger.emit({ …, context })`. |
| **Human correlation** | **`attributes.trace_id`** is unchanged (still the raw proxy correlation string, e.g. `c1` or query `traceId`). OTel `traceId` on the record is the normalized/id for backends. |
| **Compact console** | Replaced raw `ConsoleLogRecordExporter` with **`CompactProxyConsoleLogRecordExporter`**: same shape as before, but **`traceId` / `spanId` / `traceFlags`** are omitted entirely when there is no span context (no useless `undefined` lines). |
| **Tests** | `tests/logging-standard-proxy.test.ts` — resource, span context, compact console; `InMemoryLogRecordExporter` via **`initProxyLogger({ logRecordExporter })`** (test-only hook). **`tests/packaging/voice-agent-backend-runtime-dependencies.test.ts`** — declares `@opentelemetry/api`, `@opentelemetry/core`, `@opentelemetry/resources`. |

**Helpers exported for tests and reuse:** `w3cTraceIdFromCorrelation`, `w3cSpanIdForProxyCorrelation`.

---

## Local docs

| Doc | Purpose |
|-----|---------|
| [CURRENT-STATUS.md](./CURRENT-STATUS.md) | Snapshot and acceptance checklist. |
| [NEXT-STEP.md](./NEXT-STEP.md) | Merge / qualification / optional follow-ups. |
| [REFACTOR-PR-TDD.md](./REFACTOR-PR-TDD.md) | Pre-PR refactor TDD (W3C spec tests + cleanup checklist). |

---

## Related

- [Issue #437](https://github.com/Signal-Meaning/dg_react_agent/issues/437) — `trace_id` on proxy attributes for correlation.
- [Issue #560](../ISSUE-560/README.md) — proxy debug / `backend-*.log` triage.

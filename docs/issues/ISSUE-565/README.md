# Issue #565 — OpenAI proxy OTel console logs: trace fields and service name

**Status:** **Open** — improve OpenTelemetry log records from the OpenAI proxy so aggregators get a stable `service.name` and coherent trace context (or documented, compact output).

**GitHub:** [#565 — OpenAI proxy OTel console logs: undefined traceId/spanId/traceFlags and unknown_service name](https://github.com/Signal-Meaning/dg_react_agent/issues/565)

**Labels:** bug, priority: low, logging

**Branch:** `issue-565` (linked via `gh issue develop`).

---

## What this issue is

Log records emitted by the OpenAI proxy (via `ConsoleLogRecordExporter`) currently show:

- **`traceId`**, **`spanId`**, **`traceFlags`** as **`undefined`** at the LogRecord top level.
- **`resource.attributes['service.name']`** as **`unknown_service:<node binary path>`**.

The proxy already sets a logical correlation id as attribute **`trace_id`** (`ATTR_TRACE_ID` in `emitLog` call sites), but that does not populate the OTel trace fields on the record.

**Primary code:** `packages/voice-agent-backend/scripts/openai-proxy/logger.ts` — `LoggerProvider` is constructed without a `Resource`; `logger.emit` runs without an active span / log context.

---

## Desired direction (from the issue)

1. Set **`service.name`** (and ideally **`service.version`**) explicitly via `LoggerProvider` resource and semantic conventions (e.g. `dg-openai-proxy` or scoped under `@signal-meaning/voice-agent-backend`).
2. Where feasible, align OTel log **trace context** with the connection’s correlation id; otherwise **document** that `attributes.trace_id` is canonical and avoid useless **`undefined`** trace keys in console output if the SDK/exporter allows.
3. No regression to **`LOG_LEVEL`** filtering or existing `emitLog` attribute keys.

---

## Local docs

| Doc | Purpose |
|-----|---------|
| [CURRENT-STATUS.md](./CURRENT-STATUS.md) | Short snapshot; update as work lands. |
| [NEXT-STEP.md](./NEXT-STEP.md) | Immediate next actions for implementers. |

---

## Related

- [Issue #437](https://github.com/Signal-Meaning/dg_react_agent/issues/437) — introduced `trace_id` on proxy attributes for correlation.
- [Issue #560](../ISSUE-560/README.md) — proxy debug / `backend-*.log` triage; NEXT-STEP points here for OTel follow-up.

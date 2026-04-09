# Issue #565 — current status

**Last updated:** 2026-04-08

**GitHub:** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565) — **open** (close after PR review / optional real-backend spot-check)

**Branch:** `issue-565`

---

## Snapshot

| Area | State |
|------|--------|
| **Resource** | `service.name` = **`dg-openai-proxy`**, `service.version` = logger version string; merged over SDK default resource. |
| **Trace fields** | When **`trace_id`** attribute is set, exported logs carry valid **`traceId` / `spanId` / `traceFlags`** aligned with that correlation (W3C ids derived per `logger.ts`). |
| **Console shape** | Without span context, compact exporter **omits** trace keys (no `undefined`). |
| **Tests** | `logging-standard-proxy.test.ts` Issue #565 block + packaging deps; existing #437 / #531 cases still green. |

---

## Acceptance criteria (from GitHub)

- [x] `service.name` is a stable, human-readable value (not `unknown_service:...`).
- [x] LogRecord trace fields reflect the same correlation as `attributes.trace_id` where feasible (W3C-derived ids); **`trace_id` attribute remains the human/query correlation**; console avoids useless `undefined` trace keys when there is no context.
- [x] No regression to `LOG_LEVEL` filtering or existing `emitLog` attribute keys.

---

## Next

See [NEXT-STEP.md](./NEXT-STEP.md).

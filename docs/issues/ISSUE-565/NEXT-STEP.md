# Issue #565 — next step

**GitHub:** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565)

---

## First implementation slice (TDD)

1. **RED:** Add a focused unit or integration test that captures exported log record shape from the proxy logger path (or a thin test harness around the same `LoggerProvider` / exporter setup) — assert stable `service.name` and either populated trace context aligned with `trace_id` or absence of misleading `undefined` trace keys, per the acceptance criteria on the issue.
2. **GREEN:** In `packages/voice-agent-backend/scripts/openai-proxy/logger.ts`, attach an explicit `Resource` (`@opentelemetry/resources` + semantic conventions) and implement the chosen trace-context strategy (non-recording span / context binding vs documented attribute-only correlation + compact export).
3. **REFACTOR:** Keep `emitLog` attribute contract unchanged; dedupe resource setup if shared with other backend OTel later.

---

## References

- [README.md](./README.md) — scope and related issues.
- [OpenTelemetry Logs specification](https://opentelemetry.io/docs/specs/otel/logs/) — log record and trace context fields.

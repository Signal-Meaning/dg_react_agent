# Issue #437: OpenAI proxy — align logging with LOG_LEVEL and full OpenTelemetry standard

**Branch:** `davidrmcgee/issue437`  
**GitHub:** [Issue #437](https://github.com/Signal-Meaning/dg_react_agent/issues/437)

---

## Summary

The OpenAI proxy (`scripts/openai-proxy`) does not comply with our logging and OpenTelemetry standards. Logging is gated by `OPENAI_PROXY_DEBUG` instead of `LOG_LEVEL`, and the proxy does not fully support level-based filtering, tracing, or correlation. This issue is corrected via **TDD**; see [TDD-PLAN.md](./TDD-PLAN.md).

---

## Defects (to be fixed)

| # | Defect | Requirement |
|---|--------|-------------|
| 1 | Proxy reads only `OPENAI_PROXY_DEBUG`; never `LOG_LEVEL`. All logs are all-or-nothing. | Proxy must read `LOG_LEVEL` and filter by level (debug, info, warn, error) per [LOGGING-STANDARD.md](../ISSUE-412/LOGGING-STANDARD.md). |
| 2 | No tests validate that each executable (backend, proxy, component) treats logging per the standard. | Add and maintain tests that enforce LOG_LEVEL and level filtering per executable. |
| 3 | Proxy logger is init-only when `debug === true`; severity is never compared to a configured level. | Align with OpenTelemetry (pico) standard: single abstraction, level filtering, structured output. |
| 4 | Tracing and correlation not implemented in proxy. | Proxy must accept/propagate trace/request IDs and include them in all log records per [PROPAGATION-CONTRACT.md](../ISSUE-412/PROPAGATION-CONTRACT.md). |

---

## References

- [TDD-PLAN.md](./TDD-PLAN.md) — RED/GREEN/REFACTOR plan to correct defects
- [Issue #412](https://github.com/Signal-Meaning/dg_react_agent/issues/412) — OpenTelemetry logging standard
- [LOGGING-STANDARD.md](../ISSUE-412/LOGGING-STANDARD.md)
- [PROPAGATION-CONTRACT.md](../ISSUE-412/PROPAGATION-CONTRACT.md)
- `scripts/openai-proxy/run.ts`, `server.ts`, `logger.ts`

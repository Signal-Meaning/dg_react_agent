# Issue #412: Enforce OpenTelemetry logging standard and limit direct console logging

**Branch:** `davidrmcgee/issue412`  
**GitHub:** [#412](https://github.com/Signal-Meaning/dg_react_agent/issues/412)

---

## Summary

Introduce an OpenTelemetry-based logging standard across the codebase and severely limit direct `console.log` / `console.warn` / `console.error` usage.

---

## Goals

- **Structured logging:** Use OpenTelemetry (or an OTel-compatible logger) so logs are traceable, level-based, and can be exported to backends (e.g. OTLP).
- **Reduce console noise:** Replace ad-hoc `console.*` calls with a single logging abstraction that respects log levels and environment (e.g. minimal in production, verbose only when `debug` or env is set).
- **Consistency:** One way to log in the component, test-app, and any scripts (e.g. openai-proxy, backend-server) so that integration and production deployments get consistent, observable behavior.

---

## Scope

- **Component** (`DeepgramVoiceInteraction`, utils, services): Replace or wrap `console.*` with OTel/logger; keep `debug` prop gating for verbose logs.
- **Test-app:** Use same logging abstraction; avoid duplicate or noisy logs (already reduced in Issue #410).
- **Scripts** (openai-proxy, backend-server): Align with the same standard where applicable.
- **Documentation:** Document the logging standard, recommended levels, and how to enable debug/trace in dev vs production.

---

## Acceptance criteria

- [x] OpenTelemetry (or agreed logger) integrated; logging goes through a single abstraction.
- [x] Direct `console.log` / `warn` / `error` usage is rare and justified (e.g. bootstrap errors only).
- [x] Log levels (e.g. debug, info, warn, error) and `debug` prop/env drive what is emitted.
- [x] Docs describe the standard and migration for existing `console.*` call sites.
- [x] Demonstrate or document how logs from backend, proxies, and test-app can be pulled together via OTel logging with common ID threading (e.g. trace/span context) so a single request or session is observable across all layers.
- [x] Developer documentation includes clear instructions on how to use the improved logging in a partner app (e.g. integrating the logger, setting trace/request ID, and correlating with app backend logs).

---

## Backlog

Improvement for observability and maintainability; prioritize after current release/backlog items.

---

## Progress

Track implementation to conclusion: **[PROGRESS.md](./PROGRESS.md)** (phase checklists and acceptance criteria).

## Development plan

See **[DEVELOPMENT-PLAN.md](./DEVELOPMENT-PLAN.md)** for phased implementation: logger abstraction, trace/span ID threading (backend, proxies, test-app), adoption, and docs/demo.

---

## Docs in this directory

| Doc | Purpose |
|-----|--------|
| [PROGRESS.md](./PROGRESS.md) | Phase checklists and acceptance criteria; update as work proceeds. |
| [DEVELOPMENT-PLAN.md](./DEVELOPMENT-PLAN.md) | Phased implementation plan. |
| [LOGGING-STANDARD.md](./LOGGING-STANDARD.md) | Log levels, env, migration from `console.*`. |
| [PROPAGATION-CONTRACT.md](./PROPAGATION-CONTRACT.md) | Trace/request ID headers and flow. |
| [PARTNER-APP-LOGGING.md](./PARTNER-APP-LOGGING.md) | How to use the logger in a partner app and correlate with backend. |
| [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) | Replace existing `console.*` call sites with the logger. |
| [DEMO-CORRELATION.md](./DEMO-CORRELATION.md) | Example: same trace ID in test-app and backend logs. |
| [CONSOLE-AUDIT.md](./CONSOLE-AUDIT.md) | Audit of all console.* call sites (Phase 3 migration). |
| [ALLOWLIST.md](./ALLOWLIST.md) | Justified direct console.* usage (logger sink, bootstrap, CLI). |

---

## References

- Issue #410: Backend consolidation and test-app polish (reduced duplicate/noisy logs).
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/) — logging and trace export (OTLP).

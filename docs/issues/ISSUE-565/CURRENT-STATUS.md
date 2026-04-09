# Issue #565 — current status

**Last updated:** 2026-04-08

**GitHub:** [#565](https://github.com/Signal-Meaning/dg_react_agent/issues/565) — **open**

**Branch:** `issue-565`

---

## Snapshot

| Area | State |
|------|--------|
| **Problem** | Console OTel log lines show `undefined` trace fields and `unknown_service:…` for `service.name`. |
| **Correlation today** | `attributes.trace_id` on proxy logs (see issue #437). |
| **Fix target** | `packages/voice-agent-backend/scripts/openai-proxy/logger.ts` + tests (TDD per repo rules). |

---

## Acceptance criteria (from GitHub)

- [ ] `service.name` is a stable, human-readable value (not `unknown_service:...`).
- [ ] Either LogRecord trace fields reflect the same correlation as `attributes.trace_id` where feasible, or docs + tests state that `trace_id` is the correlation source and console output avoids useless `undefined` trace keys.
- [ ] No regression to `LOG_LEVEL` filtering or existing `emitLog` attribute keys.

---

## Next

See [NEXT-STEP.md](./NEXT-STEP.md).

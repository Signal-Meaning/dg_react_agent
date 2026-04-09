# Issue #559 — Cleanup idle timeout logging (level + debounce resets)

**Status:** **Implemented (pending merge)** — logging + 100ms debounce in `IdleTimeoutService`; disconnect line at debug in `useIdleTimeoutManager`; Issue #222 E2E anchors on `__idleTimeoutStarted__`.

**GitHub:** [#559 — Cleanup idle timeout logging (level + debounce resets)](https://github.com/Signal-Meaning/dg_react_agent/issues/559)

**Labels:** (none on issue at creation)

---

## What this issue is

Browser console noise during normal use: each time the idle timer is **re-armed** (e.g. rapid keystrokes), the same **`info`** line repeats many times:

- `[IDLE_TIMEOUT_SERVICE] Started idle timeout (…ms)`

The issue asks for:

1. **Log level** — Move these idle-timeout–related messages from **`info`** to **`debug`** so default consoles stay quiet.
2. **Reset coalescing** — When the idle timeout is reset repeatedly within **100 ms**, treat that as a **single** reset for **logging and scheduling** so we do not emit (or re-arm) a burst of identical “started” logs.

**Product constraint:** Idle timeout **semantics** must stay correct: the connection still closes after the configured idle period with no real activity. Debouncing/coalescing applies only to how often we **log** and **re-schedule** within the 100 ms window (per issue text).

---

## Code map (starting points)

| Area | Path | Notes |
|------|------|--------|
| Idle timer start / reset | [`src/utils/IdleTimeoutService.ts`](../../../src/utils/IdleTimeoutService.ts) | `startTimeout()` emits `Started idle timeout` at **`debug`**, debounced **100ms** (`IDLE_TIMEOUT_START_LOG_DEBOUNCE_MS`). |
| User-visible “closing” line | [`src/hooks/useIdleTimeoutManager.ts`](../../../src/hooks/useIdleTimeoutManager.ts) | `logger.debug('Idle timeout reached - closing agent connection')` when the countdown fires. |
| Logger levels | [`src/utils/logger.ts`](../../../src/utils/logger.ts) | Default effective level is **`info`** unless `debug: true` or `level: 'debug'`. |
| E2E anchor | [`test-app/tests/e2e/idle-timeout-behavior.spec.js`](../../../test-app/tests/e2e/idle-timeout-behavior.spec.js) | Issue #222 test waits for **`window.__idleTimeoutStarted__`** (stable when the start line is debug-only). |

---

## Acceptance criteria (from GitHub)

- Default log level no longer floods with `[IDLE_TIMEOUT_SERVICE] Started idle timeout` on each keypress burst.
- **Debug** logging still available for diagnosing idle-timeout behavior (`IdleTimeoutConfig.debug` / logger `debug` path).
- Idle timeout **behavior** remains correct; 100 ms coalescing affects logging/re-arm frequency only, not the underlying idle period after real inactivity.

---

## Local docs

| Doc | Purpose |
|-----|---------|
| [TDD-PLAN.md](./TDD-PLAN.md) | RED → GREEN → REFACTOR: unit tests, debounce semantics, E2E updates, commands. |
| [NEXT-STEP.md](./NEXT-STEP.md) | Immediate implementation queue and post-merge checklist. |

---

## Related

- [Issue #58](../ISSUE-58-Idle-Timeout-Synchronization.md) — idle timeout synchronization (historical).
- [Issue #489](../ISSUE-489/IDLE-TIMEOUT-AFTER-FUNCTION-RESULT-DESIGN.md) — idle timeout after function result; `__idleTimeoutStarted__` / `__idleTimeoutStopped__` diagnostics in `IdleTimeoutService`.
- [Issue #412](../ISSUE-412/README.md) — shared logger standard.

# Issue #559 — next step

**GitHub:** [#559](https://github.com/Signal-Meaning/dg_react_agent/issues/559)

---

## Queue (done for this branch)

1. ~~Jest: `tests/IdleTimeoutService.issue-559-logging-debounce.test.ts`~~
2. ~~`IdleTimeoutService`: debug + 100ms debounce for `Started idle timeout`~~
3. ~~`useIdleTimeoutManager`: disconnect line at `debug`~~
4. ~~E2E Issue #222: `__idleTimeoutStarted__` anchor~~
5. **You:** `cd test-app && npm run test:e2e -- idle-timeout-behavior.spec.js` with backend/API env as in CI or local `.env`.

---

## After merge

- Close **#559** on GitHub.
- Set **Status** in [README.md](./README.md) to **Closed** and add a one-line “What we shipped” table row.

---

## References

- [README.md](./README.md) — problem statement, file map, acceptance criteria.
- [TDD-PLAN.md](./TDD-PLAN.md) — detailed RED cases and E2E options.

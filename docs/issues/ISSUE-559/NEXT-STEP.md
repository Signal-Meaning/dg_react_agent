# Issue #559 — next step

**GitHub:** [#559](https://github.com/Signal-Meaning/dg_react_agent/issues/559)

---

## Queue (do in order)

1. **Add failing Jest tests** per [TDD-PLAN.md](./TDD-PLAN.md) (log level + 100 ms coalesce). Confirm **RED**.
2. **Implement** in `IdleTimeoutService` (and `useIdleTimeoutManager` if disconnect `info` line is in scope).
3. **Update E2E** `idle-timeout-behavior.spec.js` so Issue #222 no longer depends on **`info`** console text for `Started idle timeout` unless the test app forces debug.
4. **GREEN** — `npm test` and `cd test-app && npm run test:e2e -- idle-timeout-behavior.spec.js`.
5. **REFACTOR** — simplify debounce state; keep tests green.

---

## After merge

- Close **#559** on GitHub.
- Set **Status** in [README.md](./README.md) to **Closed** and add a one-line “What we shipped” table row.

---

## References

- [README.md](./README.md) — problem statement, file map, acceptance criteria.
- [TDD-PLAN.md](./TDD-PLAN.md) — detailed RED cases and E2E options.

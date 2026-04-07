# Issue #561 — next step

**Last updated:** 2026-04-05 (Phase A slice 1 done)

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

> **Maintenance:** After each meaningful slice of work, update **this file** (what to do next) and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)** (where we are, decisions, artifacts).

---

## Immediate next step (do this first)

**Phase A (continued) or Phase B — pick one:**

1. **Optional:** `LiveModeView.test.tsx` (RTL) — props-only, assert `data-testid`s for `live-mode-root`, `live-agent-state`, `live-session-phase`, etc. — see [TDD-PLAN.md](./TDD-PLAN.md) §3.2.

**— or —**

2. **Phase B — RED:** Add `test-app/tests/e2e/live-mode.spec.js` — minimum: **enter Live** / **exit Live** smoke with `live-mode-root` and `debug-main-layout` (or agreed ids). Tests fail until `App.tsx` implements Live shell.

---

## Done recently

- **2026-04-05:** `test-app/src/live-mode/liveModePresentation.ts` with `getLiveAgentPresentation` / `getLiveSessionPhase`; `test-app/tests/unit/live-mode-presentation.test.ts` (15 tests, green).

---

## After that (queue; do not skip updating this doc)

1. **Phase B (idle + resume):** E2E or integration test plan for **observable stopped state** after idle/disconnect and **mic reactivation** while still in Live shell (may be `test.skip` with env gate until stable).
2. **Phase C — GREEN:** `liveMode` state, `LiveModeView`, rewire **Start** with **mic on by default** + shared start/mic helper; wire **session ended** + **resume mic** UI per [CURRENT-STATUS.md](./CURRENT-STATUS.md).

---

## When you finish a step

1. Mark checkboxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md) (phase table, artifacts table, blockers).
3. Replace the **Immediate next step** section above with the new first action (or “Done — see GitHub #561”).

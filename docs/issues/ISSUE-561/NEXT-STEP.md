# Issue #561 — next step

**Last updated:** 2026-04-05 (Phase A complete)

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

> **Maintenance:** After each meaningful slice of work, update **this file** (what to do next) and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)** (where we are, decisions, artifacts).

---

## Immediate next step (do this first)

**Phase B — RED:** Add `test-app/tests/e2e/live-mode.spec.js` — **enter Live** / **exit Live** smoke: `live-mode-root` visible, `debug-main-layout` hidden when Live is on; reverse on exit. Tests fail until `App.tsx` wires `LiveModeView` and `data-testid="debug-main-layout"` on the dense panel.

---

## Done recently

- **2026-04-05:** `LiveModeView.tsx` + `LiveModeView.test.tsx` (7 tests); `data-testid`s: root, voice, agent, session phase, end Live, resume mic.
- **2026-04-05:** `liveModePresentation.ts` + `live-mode-presentation.test.ts` (15 tests).

---

## After that (queue; do not skip updating this doc)

1. **Phase B (idle + resume):** E2E or integration test plan for **observable stopped state** after idle/disconnect and **mic reactivation** while still in Live shell (may be `test.skip` with env gate until stable).
2. **Phase C — GREEN:** `liveMode` state, `LiveModeView`, rewire **Start** with **mic on by default** + shared start/mic helper; wire **session ended** + **resume mic** UI per [CURRENT-STATUS.md](./CURRENT-STATUS.md).

---

## When you finish a step

1. Mark checkboxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md) (phase table, artifacts table, blockers).
3. Replace the **Immediate next step** section above with the new first action (or “Done — see GitHub #561”).

# Issue #561 — next step

**Last updated:** 2026-04-05 (after App + E2E smoke)

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

> **Maintenance:** After each meaningful slice of work, update **this file** (what to do next) and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)** (where we are, decisions, artifacts).

---

## Immediate next step (do this first)

1. **Idle disconnect + resume E2E:** Assert `live-session-phase` / resume control after disconnect (may `test.skip` without stable env) — [TDD-PLAN.md](./TDD-PLAN.md) §4.1 third bullet.
2. **Live polish:** Larger typography, glanceable agent copy (vehicle use), optional `?live=1` deep-link.

---

## Done recently

- **2026-04-05:** `functionCallInFlight` + wrapped `sendResponse` in `handleFunctionCallRequest` → Live **`tool`** row during function calls.
- **2026-04-05:** `App.tsx`: `liveMode`, `enterLiveMode` (Start), `startServicesAndMicrophone` (shared with mic button), `stopInteraction` clears Live, `debug-main-layout`, `LiveModeView` wiring; `live-mode.spec.js` E2E.
- **2026-04-05:** `LiveModeView` + RTL; presentation helpers + unit tests.

---

## After that (queue; do not skip updating this doc)

See **Immediate next step** above (tool state, idle E2E, polish).

---

## When you finish a step

1. Mark checkboxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md) (phase table, artifacts table, blockers).
3. Replace the **Immediate next step** section above with the new first action (or “Done — see GitHub #561”).

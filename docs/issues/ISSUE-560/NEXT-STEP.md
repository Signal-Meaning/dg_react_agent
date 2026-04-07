# Issue #560 — next step

**Last updated:** 2026-04-05 (isolation: deliverable vs test-app)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

> After each meaningful slice, update **this file** and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)**.

---

## Immediate next step (do this first)

Manual repro from **#561** is in place; **#560** should **isolate** the defect.

| # | Item | Human-only? |
|---|------|-------------|
| 1 | **Pick one failing invariant** from the manual repro (e.g. “no assistant after mic OK”, “capture never starts”, “wrong `start` options for proxy”). Write it as one sentence in [CURRENT-STATUS.md](./CURRENT-STATUS.md) under symptom / isolation. | **Partially** |
| 2 | **Trace the call chain** from test-app (`LiveModeView`, ref `start` / `startAudioCapture`, connection state) into **`src/`** (voice-agent package). Mark the **first line** that is wrong *or* confirm the package path matches spec and the bug is **test-app-only**. | **No** (code + logs); **yes** if only audible in room |
| 3 | **Minimal reproduction outside test-app (if needed):** smallest Jest/integration test under `tests/` that hits the same **package** API surface without the full app—**only** if step 2 points at `src/` and ambiguity remains. | **No** |
| 4 | **Build track (parallel if blocking):** `cd test-app && npm run build` — record first `tsc`/Vite error in CURRENT-STATUS. | **No** |

---

## When you finish a step

1. Check boxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md).
3. Replace the **Immediate next step** table above.

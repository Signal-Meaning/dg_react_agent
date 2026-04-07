# Issue #560 — current status

**Last updated:** 2026-04-05 (phase: isolation in deliverable)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Branch:** `issue-560`

---

## Where we are (phase)

| Phase | Status |
|-------|--------|
| **Repro (manual, local)** | **Done** — exercised during [Issue #561](../ISSUE-561/README.md) (Live mode, OpenAI proxy vs Deepgram, mic / `start()` / `startAudioCapture()` policy, idle disconnect sync). See [#561 CURRENT-STATUS](../ISSUE-561/CURRENT-STATUS.md) for bug tables and locked decisions. |
| **Isolation** | **In progress** — determine whether the regression is in **`@signal-meaning/voice-agent-react`** (WebSocket, audio, `start()` semantics) or **test-app** (layout, refs, flags, env). |
| **Fix + tests** | Pending — smallest change in the **correct layer** once isolation is clear. |

---

## Problem statement (from issue scope)

1. **Voice-commerce / partner:** Reported **microphone activation regression** — compare against known-good integration after we know which layer failed.
2. **test-app:** Manual repro **available** from #561 work; use it to **stress the same paths** the partner hits while bisecting package vs app.
3. **Build:** **`npm run build`** in `test-app` (includes **`tsc -b`**) may fail — blocks a clean demo artifact until fixed.

---

## What we know

| Area | Detail |
|------|--------|
| Local manual repro | **Yes** — from #561: Live entry, proxy OpenAI vs direct Deepgram, mic enable / resume after disconnect, `ref.start(...)` + `startAudioCapture()` policy. Cross-check [ISSUE-561 TDD-PLAN](../ISSUE-561/TDD-PLAN.md) §2 (microphone / `start()` rules). |
| Symptom (to narrow during isolation) | *Record the smallest failing invariant: e.g. no audio upstream, wrong flags on `start`, connection drops, UI shows “on” while agent is dead — tie each to package vs app once traced.* |
| Deliverable vs test-app | **Open** — use isolation steps in [NEXT-STEP.md](./NEXT-STEP.md) (trace from UI/ref into `src/` vs stop at app boundary). |
| `tsc` / build errors | *Paste first failing file + error when known (orthogonal to mic isolation but same issue bucket).* |

---

## Locked decisions

*(None yet. Add only when something must not regress during #560 work.)*

---

## Artifacts

| Artifact | Location / note |
|----------|-----------------|
| E2E logs | `logs/` when using `npm run test:e2e:log` (see repo root / test-app `package.json`) |

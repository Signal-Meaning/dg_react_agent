# TDD Plan: Issue #560 — Mic regression repro + test-app build

**Issue:** [#560 — Backlog: voice-commerce mic activation regression; test-app build](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

**Principle:** **Red → Green → Refactor.** Tests first where they define behavior; minimal implementation to go green. The headless `@signal-meaning/voice-agent-react` package must stay compatible with the [Voice Agent API](https://developers.deepgram.com/docs/voice-agent). Prefer **npm scripts** from `test-app` per [.cursorrules](../../../.cursorrules).

**Recovery (new chat):** Read [CURRENT-STATUS.md](./CURRENT-STATUS.md), [NEXT-STEP.md](./NEXT-STEP.md), this file, [README.md](./README.md). **Repro:** manual steps live under [#561](../ISSUE-561/README.md); **#560** is isolation + fix in the **correct layer**.

---

## Checkbox legend

- `[ ]` — Not done.
- `[x]` — Done (tests green; update this doc when complete).

---

## 1. Goals

| Goal | Notes |
|------|--------|
| **G1** | **Isolate** mic-related failure: **`@signal-meaning/voice-agent-react`** (`src/`) vs **test-app** integration. Manual repro already exists from [#561](../ISSUE-561/README.md). |
| **G2** | Add or extend **tests** at the **layer that owns the bug** (package `tests/` vs `test-app/tests/`) so the regression cannot return silently. |
| **G3** | Fix **`test-app` `npm run build`** / **`tsc -b`** until clean (may proceed in parallel). |

---

## 2. Constraints

- Do **not** weaken partner-reported scenarios: see [#462](../ISSUE-462/README.md) for voice-commerce lessons.
- **Mic / `start()` semantics** overlap [Issue #561](../ISSUE-561/README.md) Live work — **#561** carried manual repro and UI policy; **#560** decides if the remaining partner gap is **deliverable** code. Cross-link PRs and update both CURRENT-STATUS files if work splits across issues.
- E2E that need real APIs: follow repo rules (proxy, keys, `test-app` as cwd).

---

## 3. Phase A — Inventory

- [x] **Local manual repro** — satisfied by [#561](../ISSUE-561/README.md) work (Live, proxy, mic paths); keep using that flow while isolating.
- [x] Run `cd test-app && npm run build` — **green** on `issue-560` (2026-04-05); failures (if any in CI) go in [CURRENT-STATUS.md](./CURRENT-STATUS.md).
- [x] **Isolation conclusion (round 1)** — call chain + boundary in [CURRENT-STATUS.md](./CURRENT-STATUS.md) §Isolation trace.

---

## 4. Phase B — RED: failing tests

*(Prefer the smallest contract at the failing layer.)*

- [x] **Build:** `npm run build` sufficient when green; no extra Jest guard needed yet.
- [ ] **Package (`src/`):** add under repo `tests/` **if** partner matches test-app wiring and defect is inside `DeepgramVoiceInteraction`.
- [x] **test-app integration contract:** `test-app/tests/unit/voiceAgentStartOptions.test.ts` + `voiceAgentStartOptions.ts` (OpenAI proxy vs Deepgram `start()` flags for mic/Live).

---

## 5. Phase C — GREEN: fixes

- [x] **Refactor / lock:** `App.tsx` `startServicesAndMicrophone` uses `getVoiceAgentStartOptions` (tests green).
- [ ] **Partner-visible fix** — pending parity check; may be **`src/`** or **docs for integrators** once root cause is confirmed.
- [x] Ran `test-app` tests + build for this slice (`npm test -- voiceAgentStartOptions.test.ts`, `npm run build`).

---

## 6. Phase D — REFACTOR

- [ ] Dedupe only **within the layer that owns the bug**; keep tests green; avoid moving logic across package/app boundary without a clear API reason.

---

## 7. Commands (reference)

```bash
cd test-app && npm run build
cd test-app && npm test
cd test-app && npm run test:e2e -- <spec>.spec.js   # targeted E2E
```

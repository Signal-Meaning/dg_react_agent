# Issue #561 — tracking

**GitHub:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

**Living docs:** [CURRENT-STATUS.md](./CURRENT-STATUS.md) · [NEXT-STEP.md](./NEXT-STEP.md)

| Item | Status |
|------|--------|
| Branch `issue-561` | Created from `main` |
| [TDD-PLAN.md](./TDD-PLAN.md) | Updated — Live entry, Phase A extensions, Bug 1–3 notes |
| Phase A unit tests (test-app) | **Extended** — presentation + `LiveModeView` + **`syncMicFromAgentConnection`** |
| Phase B E2E `live-mode.spec.js` | Smoke — **`live-entry-button`** |
| Phase C App wiring + Live UX | **In progress** — full-screen Live, history, visual placeholder, mic sync on disconnect |
| Phase D refactor / dedupe start+mic | Not started |
| Bug 1 (proxy / no replies) | **Open** — conversation visible; root cause TBD |
| Bug 2 (mic UI vs disconnect) | **Mitigated** in app + unit policy tests |
| Bug 3 (duplicate idle / layout) | **Mitigated** — labels + footer + centered column |

Notes: After each slice, edit **CURRENT-STATUS**, **NEXT-STEP**, and checkboxes in **TDD-PLAN**.

# Issue #433: Enforce no user message until channel ready (queue or block)

**Branch:** `davidrmcgee/issue433`  
**GitHub:** [#433](https://github.com/Signal-Meaning/dg_react_agent/issues/433)

---

## Summary

The component must **enforce** that no user message (text or audio) is sent to the backend until the channel has reported ready (SettingsApplied for Deepgram, session.created for OpenAI). Today the component **reports** readiness via `onSettingsApplied` (Issue #428) but does not prevent sends before ready—it can send after a wait timeout and only warn. The fix: gate all send paths on “channel ready” and either **queue** sends until ready or **reject/block** until ready.

---

## Requirement

| # | Item | Status |
|---|------|--------|
| 1 | Readiness reporting | Done (Issue #428 / v0.8.2): `onSettingsApplied` when SettingsApplied or session.created. |
| 2 | Enforcement | **Open:** No user message on the wire until ready; queue or block early sends. |

---

## Docs in this directory

| Doc | Purpose |
|-----|--------|
| [README.md](./README.md) | This file — issue summary. |
| [TDD-PLAN.md](./TDD-PLAN.md) | TDD plan: phases, RED/GREEN/REFACTOR, queue vs block decision, progress. |

---

## References

- [GitHub Issue #433](https://github.com/Signal-Meaning/dg_react_agent/issues/433)
- Issue #428 — onSettingsApplied on session.created (readiness reporting)

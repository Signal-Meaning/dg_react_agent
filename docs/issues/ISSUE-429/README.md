# Issue #429: OpenAI proxy path — expose agentManagerRef / disableIdleTimeoutResets (handle API parity)

**Branch:** `davidrmcgee/issue429`  
**GitHub:** [#429](https://github.com/Signal-Meaning/dg_react_agent/issues/429)  
**Labels:** bug  
**Severity:** High

---

## Summary

When the app uses the component with **provider = openai** and a proxy endpoint, the component ref (or the exposed handle) does not provide the same **agentManagerRef** (and methods such as **disableIdleTimeoutResets** / **enableIdleTimeoutResets**) as in the Deepgram path. The Voice Commerce app uses these in `idleTimeoutManager.ts`: when a "thinking" activity starts they call `disableIdleTimeoutResets()` on the agent manager; when it ends they call `enableIdleTimeoutResets()`. This works for the Deepgram path but not for OpenAI.

---

## Evidence

- **E2E / real run:** Console output when running with OpenAI and real API:
  - "disableIdleTimeoutResets method not available"
  - "Available methods: []"
- **App code:** `frontend/src/utils/idleTimeoutManager.ts` checks for `component.agentManager.disableIdleTimeoutResets` and logs a warning when it's missing.
- **Docs:** `frontend/docs/IDLE-TIMEOUT.md` describes the expected behavior (Deepgram component's disableIdleTimeoutResets / enableIdleTimeoutResets).

So for the OpenAI proxy path, the ref/handle either does not expose **agentManagerRef** or the manager does not expose **disableIdleTimeoutResets** / **enableIdleTimeoutResets**, leading to "method not available" and empty "Available methods" in diagnostics.

---

## Requested fix

For the OpenAI proxy path, expose the same handle shape as for Deepgram where possible:

1. **Expose agentManagerRef (or equivalent)** so the app can access the agent manager.
2. **On that manager,** expose **disableIdleTimeoutResets** and **enableIdleTimeoutResets** (or equivalent behavior), so idle-timeout management works the same way for both providers.

If the OpenAI backend protocol does not support the same idle-timeout semantics, document the difference so the app can adapt (e.g. no-op or different behavior when provider is OpenAI).

---

## Docs in this directory

| Doc | Purpose |
|-----|--------|
| [README.md](./README.md) | This file — issue summary. |
| [RESOLUTION.md](./RESOLUTION.md) | Resolution plan: location, TDD steps, and implementation notes. |

---

## References

- Issue body: GitHub [#429](https://github.com/Signal-Meaning/dg_react_agent/issues/429)
- Context: Issue #901; E2E real-API runs (OpenAI provider) — E2E-FAILURES-2026-02-11.md §5
- Related: Issue #428 (onSettingsApplied / session.created), Issue #373 (idle timeout during function calls)

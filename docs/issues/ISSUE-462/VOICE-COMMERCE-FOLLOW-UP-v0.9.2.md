# Follow-up to voice-commerce: Release v0.9.2 / 0.2.2 (Issue #462)

**For:** voice-commerce  
**From:** dg_react_agent team  
**Re:** `conversation_already_has_active_response` still occurring on 0.9.1 / 0.2.1  
**Date:** 2026-02-16  
**Tracking:** [Issue #462](https://github.com/Signal-Meaning/dg_react_agent/issues/462)

---

## Release

We’ve released a patch that fixes the remaining path:

- **@signal-meaning/voice-agent-react@0.9.2**
- **@signal-meaning/voice-agent-backend@0.2.2**

**Release:** [v0.9.2](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.9.2)

---

## What changed in v0.9.2 / 0.2.2

The proxy was clearing “response in progress” when it received **`response.output_audio.done`**. The upstream API can send **audio.done before text.done**. That allowed a subsequent Settings → `session.update` while the API still had an active response, which triggered `conversation_already_has_active_response`.

**Fix:** The proxy now clears “response in progress” only when it receives **`response.output_text.done`**, so it no longer sends `session.update` until the full response (audio + text) is done.

---

## What we’d like you to do

1. Upgrade to **voice-agent-react@0.9.2** and **voice-agent-backend@0.2.2**.
2. Re-run your flow; the error should be resolved.
3. If you still see the error, send a proxy log excerpt (with `LOG_LEVEL=debug`) from connect through the error so we can check for any other paths.

Documentation and analysis: [docs/issues/ISSUE-462/](https://github.com/Signal-Meaning/dg_react_agent/tree/main/docs/issues/ISSUE-462).

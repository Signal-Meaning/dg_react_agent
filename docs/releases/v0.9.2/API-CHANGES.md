# API Changes - v0.9.2

## Overview

**There are no component API changes in v0.9.2.** The public API of `@signal-meaning/voice-agent-react` (props, methods, callbacks, state) is unchanged.

This release is a patch that includes:

- **Backend (voice-agent-backend 0.2.2):** Fix for Issue #462 — proxy no longer clears “response active” on `response.output_audio.done`; it clears only on `response.output_text.done`, avoiding `conversation_already_has_active_response` when the API sends audio.done before text.done.

## Component (voice-agent-react)

- **Props:** No new or changed props.
- **Methods:** No new or changed methods.
- **Callbacks / state:** No changes.

## Backend (voice-agent-backend 0.2.2)

- Backend package version is **0.2.2** in this release. Behavior change: “response active” is cleared only on `response.output_text.done`, not on `response.output_audio.done`. See the voice-agent-backend package and `PROTOCOL-AND-MESSAGE-ORDERING.md` for details.

## References

- [API-REFERENCE.md](../../API-REFERENCE.md) — Full API reference; “API Evolution Since Fork” should include a v0.9.2 entry.
- [Issue #462](https://github.com/Signal-Meaning/dg_react_agent/issues/462) — conversation_already_has_active_response fix

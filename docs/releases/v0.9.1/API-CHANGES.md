# API Changes - v0.9.1

## Overview

**There are no component API changes in v0.9.1.** The public API of `@signal-meaning/voice-agent-react` (props, methods, callbacks, state) is unchanged.

This release is a patch that includes:

- **Backend (voice-agent-backend 0.2.1):** Fix for Issue #459 — proxy no longer sends `session.update` to upstream while a response is active, avoiding `conversation_already_has_active_response` errors.

## Component (voice-agent-react)

- **Props:** No new or changed props.
- **Methods:** No new or changed methods.
- **Callbacks / state:** No changes.

## Backend (voice-agent-backend 0.2.1)

- Backend package version is **0.2.1** in this release. Behavior change: session/config updates are gated so they are not sent while a response is in progress. See the voice-agent-backend package and `PROTOCOL-AND-MESSAGE-ORDERING.md` for details.

## References

- [API-REFERENCE.md](../../API-REFERENCE.md) — Full API reference; “API Evolution Since Fork” should include a v0.9.1 entry.
- [Issue #459](https://github.com/Signal-Meaning/dg_react_agent/issues/459) — session.update race fix

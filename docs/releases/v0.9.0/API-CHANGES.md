# API Changes - v0.9.0

## Overview

**There are no component API changes in v0.9.0.** The public API of `@signal-meaning/voice-agent-react` (props, methods, callbacks, state) is unchanged.

This release focuses on:

- Real-API test support and documentation (Epic #455, Issue #451)
- Function-call backend contract and third-party scope documentation (Issues #452–#454)
- Backend package **@signal-meaning/voice-agent-backend** release **0.2.0** (see that package’s docs for backend API details)

## Component (voice-agent-react)

- **Props:** No new or changed props.
- **Methods:** No new or changed methods.
- **Callbacks / state:** No changes.

## Backend (voice-agent-backend 0.2.0)

- Backend package version is **0.2.0** in this release. For backend API and behavior changes (OpenAI proxy, `openai.upstreamOptions` merge, function-call handler contract), see the voice-agent-backend package README and release notes.

## References

- [API-REFERENCE.md](../../API-REFERENCE.md) — Full API reference; “API Evolution Since Fork” includes a v0.9.0 entry.
- [Epic #455](https://github.com/Signal-Meaning/dg_react_agent/issues/455) — Real-API tests, function-call contract, 3pp scope

# API Changes - v0.10.0

## Overview

**There are no component API changes in v0.10.0.** The public API of `@signal-meaning/voice-agent-react` (props, methods, callbacks, state) is unchanged.

This release focuses on:

- Epic #493: OpenAI proxy event mapping (transcription, UtteranceEnd, ConversationText, warnings for unmapped events)
- Issue #490: Component-owned context and Settings pipeline (internal; tests and docs)
- Issue #379: Settings structure verification and test suite improvements
- Issue #489 / #346 / #333: Idle timeout behavior, context on reconnect, E2E and release process
- Backend package **@signal-meaning/voice-agent-backend** **0.2.6** (see that package for backend API details)

## Component (voice-agent-react)

- **Props:** No new or changed props.
- **Methods:** No new or changed methods.
- **Callbacks / state:** No changes.

## Backend (voice-agent-backend 0.2.6)

- Backend package version is **0.2.6** in this release. For proxy and backend behavior (OpenAI proxy, function-call handling, event mapping), see the voice-agent-backend package README and release notes.

## References

- [API-REFERENCE.md](../../API-REFERENCE.md) — Full API reference and evolution.
- [CHANGELOG.md](./CHANGELOG.md) — Full changelog for v0.10.0.

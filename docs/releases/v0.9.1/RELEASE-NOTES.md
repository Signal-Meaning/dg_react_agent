# Release Notes - v0.9.1

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.1 is a **patch** release that fixes the OpenAI proxy session.update race (Issue #459), preventing `conversation_already_has_active_response` errors. There are **no component API changes**. The **voice-agent-backend** package is released as **0.2.1** with the proxy gating fix.

## Highlights

- **Backend fix (Issue #459):** Proxy no longer sends `session.update` to upstream while a response is active; session/config updates are gated until the response completes.
- **No component changes:** Upgrade is drop-in; no code changes required.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.1` and optionally `@signal-meaning/voice-agent-backend@0.2.1`.

See [CHANGELOG.md](./CHANGELOG.md), [MIGRATION.md](./MIGRATION.md), and [API-CHANGES.md](./API-CHANGES.md) for details.

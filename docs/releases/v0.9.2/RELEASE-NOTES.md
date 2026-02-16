# Release Notes - v0.9.2

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.2 is a **patch** release that fixes `conversation_already_has_active_response` still occurring on 0.9.1/0.2.1 (Issue #462). The proxy no longer clears “response active” on `response.output_audio.done`; it clears only on `response.output_text.done`. There are **no component API changes**. The **voice-agent-backend** package is released as **0.2.2** with this fix.

## Highlights

- **Backend fix (Issue #462):** Proxy treats a response as in progress until `response.output_text.done`; clearing on `response.output_audio.done` alone allowed a subsequent Settings → session.update while the API still had an active response.
- **No component changes:** Upgrade is drop-in; no code changes required.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.2` and optionally `@signal-meaning/voice-agent-backend@0.2.2`.

See [CHANGELOG.md](./CHANGELOG.md), [MIGRATION.md](./MIGRATION.md), and [API-CHANGES.md](./API-CHANGES.md) for details.

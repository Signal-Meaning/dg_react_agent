# Changelog - v0.9.1

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **OpenAI proxy (voice-agent-backend, Issue #459):** Resolved session.update race that could cause `conversation_already_has_active_response`. The proxy now gates `session.update` so it is not sent to the upstream while a response is active (e.g. after `response.create` until `response.output_text.done` / `response.output_audio.done`). See `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md`.

## Backward Compatibility

✅ **Fully backward compatible** — No component API changes. Backend 0.2.1 is backward compatible; behavior change is internal (message ordering) and avoids upstream errors.

## References

- Issue #459: session.update race / conversation_already_has_active_response
- Release #461: Release v0.9.1 checklist
- docs/issues/ISSUE-459/, docs/issues/ISSUE-461/
- packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md

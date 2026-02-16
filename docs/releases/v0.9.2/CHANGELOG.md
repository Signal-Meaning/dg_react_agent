# Changelog - v0.9.2

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **OpenAI proxy (voice-agent-backend, Issue #462):** Fixed `conversation_already_has_active_response` still occurring on 0.9.1/0.2.1. The proxy no longer clears the “response active” flag on `response.output_audio.done`; it clears only on `response.output_text.done`. When the real API sends `output_audio.done` before `output_text.done`, a subsequent client Settings could previously trigger `session.update` while the API still had an active response. See `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` and `docs/issues/ISSUE-462/`.

## Backward Compatibility

✅ **Fully backward compatible** — No component API changes. Backend 0.2.2 is backward compatible; behavior change is internal (when response is considered “done”) and avoids upstream errors.

## References

- Issue #462: conversation_already_has_active_response still on 0.9.1/0.2.1 (follow-up to #459)
- PR #463: Do not clear responseInProgress on output_audio.done
- docs/issues/ISSUE-462/, docs/issues/ISSUE-459/
- packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md

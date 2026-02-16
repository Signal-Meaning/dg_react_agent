# Release Notes - v0.9.3

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.3 is a **patch** release with process, test, and documentation updates only. No component or backend API changes.

## Highlights

- **Process (#466):** Release checklist and cursor rules now require real-API qualification for proxy/API behavior releases; mock-only success is not sufficient.
- **Issue #462 test:** The integration test for the 0.9.2 proxy fix now runs with both mock and real API (single test) so we can qualify against the live OpenAI API.
- **Customer message:** Added copy-paste message for voice-commerce follow-up (MESSAGE-TO-VOICE-COMMERCE.md).

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.3` and optionally `@signal-meaning/voice-agent-backend@0.2.3` if you want the latest tooling/docs; the 0.9.2/0.2.2 fix for `conversation_already_has_active_response` is unchanged.

See [CHANGELOG.md](./CHANGELOG.md) for details.

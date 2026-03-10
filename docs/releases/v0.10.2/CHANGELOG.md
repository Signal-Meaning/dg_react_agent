# Changelog - v0.10.2

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #512 (voice-commerce #908):** Unmapped upstream events from the OpenAI Realtime API are no longer treated as fatal. The translation proxy now logs a warning (event type, payload length, and truncated payload) and continues; it does **not** send `Error` with `unmapped_upstream_event` to the client. This prevents retry and re-Settings loops when the API sends event types the proxy does not map.

- **Issue #513:** Release gate for upstream event types: regression test (`tests/openai-proxy-event-coverage.test.ts`) ensures every canonical OpenAI Realtime server event type has an explicit handler; release checklist and documentation (supported / ignored / unknown) added. Unmapped path is reserved for unknown future event types only.

- **Issue #514 (voice-commerce #908):** After a successful function call (host sends result), the component no longer retries or re-sends Settings in a way that causes duplicate function calls. Fix is primarily via #512 (no Error for unmapped events); integration test added to assert exactly one FunctionCallRequest per successful turn.

- **Issue #517:** Root cause of unmapped events addressed: proxy now has explicit branches for all known OpenAI Realtime server event types (e.g. `conversation.created`, `conversation.item.deleted`, `input_audio_buffer.dtmf_event_received`, `mcp_list_tools.*`), so they no longer hit the generic unmapped path. Canonical event list and coverage plan documented.

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes to the public component API.

## References

- Issues [#512](https://github.com/Signal-Meaning/dg_react_agent/issues/512), [#513](https://github.com/Signal-Meaning/dg_react_agent/issues/513), [#514](https://github.com/Signal-Meaning/dg_react_agent/issues/514), [#515](https://github.com/Signal-Meaning/dg_react_agent/issues/515), [#517](https://github.com/Signal-Meaning/dg_react_agent/issues/517) — OpenAI proxy unmapped events and retries (voice-commerce #908)
- PR [#516](https://github.com/Signal-Meaning/dg_react_agent/pull/516)
- docs/issues/ISSUE-512-515/ — TDD plans and release checklist

# Changelog - v0.10.5

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Added

- **Epic #542 / PR #543 (Voice Commerce OpenAI proxy defect register, §1–§6):** Delivers the epic’s proxy, component, test, and documentation work as a published patch: observability for Realtime errors, protocol ordering (including `InjectUserMessage` gating and Settings+tools paths), hardened client JSON handling with an explicit passthrough escape hatch, Settings → OpenAI Realtime `session` field mapping (`tool_choice`, `output_modalities`, `max_output_tokens`, managed prompt, audio output, and honest `temperature` surface), lifecycle and `SettingsApplied` idempotence alignment, and updates to BACKEND-PROXY and proxy protocol docs. See [ISSUE-542 README](../../issues/ISSUE-542/README.md) and child issue docs under `docs/issues/ISSUE-542/`.

## Changed

- **@signal-meaning/voice-agent-backend** published at **0.2.10** with the OpenAI proxy changes above (prior patch line was 0.2.9 with v0.10.4).

## Backward Compatibility

✅ **Fully backward compatible** — Patch release; no intentional breaking changes to the public Voice Agent API surface. Proxy defaults may be stricter (e.g. client JSON) where documented; use env flags such as `OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH` only when required.

## References

- Epic [#542](https://github.com/Signal-Meaning/dg_react_agent/issues/542) — Voice Commerce OpenAI proxy defect register
- PR [#543](https://github.com/Signal-Meaning/dg_react_agent/pull/543) — Epic implementation merge
- Issue [#544](https://github.com/Signal-Meaning/dg_react_agent/issues/544) — release v0.10.5 / backend 0.2.10
- [ISSUE-544 release checklist](../../issues/ISSUE-544/RELEASE-CHECKLIST.md)

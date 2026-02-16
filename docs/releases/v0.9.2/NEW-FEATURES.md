# New Features - v0.9.2

This is a **patch** release. No new component features or APIs were added.

## Backend fix (Issue #462)

The **voice-agent-backend** package (0.2.2) includes a fix for the OpenAI proxy: the “response active” flag is now cleared only when the upstream sends `response.output_text.done`, not when it sends `response.output_audio.done`. This prevents `conversation_already_has_active_response` when the real API sends audio.done before text.done and the client sends Settings in between. No integration changes are required.

See [CHANGELOG.md](./CHANGELOG.md) and [Issue #462](https://github.com/Signal-Meaning/dg_react_agent/issues/462) for details.

## References

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog for v0.9.2
- docs/issues/ISSUE-462/

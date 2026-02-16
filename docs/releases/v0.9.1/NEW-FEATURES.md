# New Features - v0.9.1

This is a **patch** release. No new component features or APIs were added.

## Backend fix (Issue #459)

The **voice-agent-backend** package (0.2.1) includes a fix for the OpenAI proxy: `session.update` is no longer sent to the upstream while a response is active, which prevents `conversation_already_has_active_response` errors. This is an internal behavior fix; no integration changes are required.

See [CHANGELOG.md](./CHANGELOG.md) and [Issue #459](https://github.com/Signal-Meaning/dg_react_agent/issues/459) for details.

## References

- [Release #461](https://github.com/Signal-Meaning/dg_react_agent/issues/461) — Release v0.9.1 checklist
- [CHANGELOG.md](./CHANGELOG.md) — Full changelog for v0.9.1

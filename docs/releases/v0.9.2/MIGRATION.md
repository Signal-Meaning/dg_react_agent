# Migration - v0.9.2

## Breaking changes

**None.** v0.9.2 is fully backward compatible with v0.9.1, v0.9.0, and v0.8.x.

- **Component:** No props, methods, or callbacks were added, changed, or removed.
- **Backend (0.2.2):** Backward compatible; internal “response active” timing fix only. Existing proxy and function-call usage continues to work.

## Upgrading

1. **Component:** Update dependency to `@signal-meaning/voice-agent-react@0.9.2`. No code changes required.
2. **Backend (optional):** If you use `@signal-meaning/voice-agent-backend`, upgrade to `0.2.2` for the Issue #462 fix (no session.update between output_audio.done and output_text.done). No required code changes for existing usage.

## References

- [CHANGELOG.md](./CHANGELOG.md) — Full list of changes
- [API-CHANGES.md](./API-CHANGES.md) — API surface summary (no component changes)
